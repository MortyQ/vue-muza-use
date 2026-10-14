/**
 * Token Manager
 *
 * Centralized authorization token management
 * Solves problems:
 * - Tight coupling with localStorage
 * - Easy to mock in tests
 * - Single point of access to tokens
 */

import type { AuthTokens, LocalStorageTokenStorageOptions, TokenStorage, TokenStorageKeys } from "../types";

export type { AuthTokens, TokenStorage };

export const TOKEN_TYPE = "Bearer";
export const ACCESS_TOKEN_KEY = "accessToken";
export const REFRESH_TOKEN_KEY = "refreshToken";
export const TOKEN_EXPIRES_KEY = "tokenExpiresAt";


// localStorage can throw (Safari private mode, storage-blocked iframes).
// Degrade to "no token" instead of crashing the request interceptor.
function safeGetItem(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSetItem(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // storage unavailable — token lives only for this request cycle
    }
}

function safeRemoveItem(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        // storage unavailable — nothing to remove
    }
}

const DEFAULT_KEYS: TokenStorageKeys = {
    accessToken: ACCESS_TOKEN_KEY,
    refreshToken: REFRESH_TOKEN_KEY,
    expiresAt: TOKEN_EXPIRES_KEY,
};

const KEY_ROLES = ["accessToken", "refreshToken", "expiresAt"] as const;

// Reject a key set that would corrupt storage later: an empty name, or two
// roles writing to one key. Runs once, before any localStorage access.
function resolveKeys(keys: TokenStorageKeys | undefined): TokenStorageKeys {
    if (keys === undefined) return DEFAULT_KEYS;

    for (const role of KEY_ROLES) {
        const name: unknown = keys[role];
        if (typeof name !== "string" || name === "") {
            throw new TypeError(
                `LocalStorageTokenStorage: keys.${role} must be a non-empty string.`,
            );
        }
    }

    for (let i = 0; i < KEY_ROLES.length; i++) {
        for (let j = i + 1; j < KEY_ROLES.length; j++) {
            if (keys[KEY_ROLES[i]] === keys[KEY_ROLES[j]]) {
                throw new TypeError(
                    `LocalStorageTokenStorage: keys.${KEY_ROLES[i]} and keys.${KEY_ROLES[j]} ` +
                    `must be different (both are "${keys[KEY_ROLES[i]]}").`,
                );
            }
        }
    }

    return { accessToken: keys.accessToken, refreshToken: keys.refreshToken, expiresAt: keys.expiresAt };
}

/**
 * Token storage backed by localStorage, shared by every tab of the origin.
 * It is the storage of the `tokenManager` singleton.
 *
 * Two modes:
 * 1. `storeRefreshToken: true` (default) — both tokens in localStorage
 * 2. `storeRefreshToken: false` — only the access token in localStorage, the refresh token in an httpOnly cookie
 *
 * By default it uses the keys `accessToken`, `refreshToken` and `tokenExpiresAt`.
 * Pass `keys` to keep a second, independent token (for example for a backend
 * that only accepts a token another backend mints). Two storages must never
 * share a key name: the library cannot detect it, and they would overwrite
 * each other's tokens.
 *
 * @throws {TypeError} when a name in `keys` is empty or two roles share one name.
 *
 * @example
 * ```ts
 * const partnerTokens = new TokenManager(new LocalStorageTokenStorage({
 *     keys: {
 *         accessToken: "partner:accessToken",
 *         refreshToken: "partner:refreshToken",
 *         expiresAt: "partner:expiresAt",
 *     },
 * }));
 * partnerTokens.setTokens({ accessToken: partnerAccessToken, expiresIn: 300 });
 * ```
 */
class LocalStorageTokenStorage implements TokenStorage {
    private storeRefreshToken: boolean;
    private keys: TokenStorageKeys;

    constructor(options: LocalStorageTokenStorageOptions = {}) {
        this.keys = resolveKeys(options.keys);
        this.storeRefreshToken = options.storeRefreshToken ?? true;  // Default: store in localStorage
    }

    getAccessToken(): string | null {
        return safeGetItem(this.keys.accessToken);
    }

    getRefreshToken(): string | null {
        if (!this.storeRefreshToken) {
            return null; // Refresh token is stored in httpOnly cookie
        }
        return safeGetItem(this.keys.refreshToken);
    }

    setTokens(tokens: AuthTokens): void {
        if (!tokens.accessToken) {
            return;
        }

        safeSetItem(this.keys.accessToken, tokens.accessToken);

        if (this.storeRefreshToken) {
            if (tokens.refreshToken) {
                safeSetItem(this.keys.refreshToken, tokens.refreshToken);
            }
        }

        if (tokens.expiresIn) {
            const expiresAt = Date.now() + tokens.expiresIn * 1000;
            safeSetItem(this.keys.expiresAt, expiresAt.toString());
        }
    }

    clearTokens(): void {
        safeRemoveItem(this.keys.accessToken);
        if (this.storeRefreshToken) {
            safeRemoveItem(this.keys.refreshToken);
        }
        safeRemoveItem(this.keys.expiresAt);
    }

    getTokenExpiresAt(): number | null {
        const expiresAt = safeGetItem(this.keys.expiresAt);
        return expiresAt ? parseInt(expiresAt, 10) : null;
    }

    isTokenExpired(): boolean {
        const expiresAt = this.getTokenExpiresAt();
        if (!expiresAt) return false;

        // Add 5 seconds buffer to prevent race conditions
        return Date.now() >= expiresAt - 5000;
    }
}

/**
 * A token store: reads, writes and clears one set of auth tokens through a
 * `TokenStorage`.
 *
 * The exported `tokenManager` singleton is the default store of every auth
 * session and legacy `createApiClient`. Build a second instance only for a
 * second, independent token — for example for a backend that only accepts a
 * token another backend mints — and pass it as `createAuthSession({ tokens })`.
 *
 * @example
 * ```ts
 * const partnerTokens = new TokenManager(new LocalStorageTokenStorage({
 *     keys: {
 *         accessToken: "partner:accessToken",
 *         refreshToken: "partner:refreshToken",
 *         expiresAt: "partner:expiresAt",
 *     },
 * }));
 * const partnerSession = createAuthSession({ refresh: fetchPartnerToken, tokens: partnerTokens });
 * ```
 */
class TokenManager {
    private storage: TokenStorage;
    private refreshPromise: Promise<string | null> | null = null;

    /**
     * @param storage Where the tokens live. Default: a `LocalStorageTokenStorage`
     * with the default keys — **the same keys as the `tokenManager` singleton**,
     * so `new TokenManager()` is not a separate store. For a second store pass
     * `new LocalStorageTokenStorage({ keys })` with key names of its own.
     */
    constructor(storage: TokenStorage = new LocalStorageTokenStorage()) {
        this.storage = storage;
    }

    /**
     * Get access token
     */
    getAccessToken(): string | null {
        return this.storage.getAccessToken();
    }

    /**
     * Get refresh token
     */
    getRefreshToken(): string | null {
        return this.storage.getRefreshToken();
    }

    /**
     * Save tokens
     */
    setTokens(tokens: AuthTokens): void {
        this.storage.setTokens(tokens);
    }

    /**
     * Clear tokens
     */
    clearTokens(): void {
        this.storage.clearTokens();
        this.refreshPromise = null;
    }

    /**
     * Check if token is expired
     */
    isTokenExpired(): boolean {
        return this.storage.isTokenExpired();
    }

    /**
     * Get token expiration time
     */
    getTokenExpiresAt(): number | null {
        return this.storage.getTokenExpiresAt();
    }

    /**
     * Check if tokens exist
     */
    hasTokens(): boolean {
        // We only check for access token because refresh token is in HttpOnly cookie
        return !!this.getAccessToken();
    }

    /**
     * Get Authorization header
     */
    getAuthHeader(): string | null {
        const token = this.getAccessToken();
        return token ? `${TOKEN_TYPE} ${token}` : null;
    }

    /**
     * Set token refresh promise (to prevent race conditions)
     *
     * @deprecated Not used by the library — the 401 refresh mutex lives in
     * `setupInterceptors()` (`isRefreshing` + `failedQueue`). Will be removed in v2.0.
     */
    setRefreshPromise(promise: Promise<string | null>): void {
        this.refreshPromise = promise;
    }

    /**
     * Get token refresh promise
     *
     * @deprecated Not used by the library — the 401 refresh mutex lives in
     * `setupInterceptors()` (`isRefreshing` + `failedQueue`). Will be removed in v2.0.
     */
    getRefreshPromise(): Promise<string | null> | null {
        return this.refreshPromise;
    }

    /**
     * Clear token refresh promise
     *
     * @deprecated Not used by the library — the 401 refresh mutex lives in
     * `setupInterceptors()` (`isRefreshing` + `failedQueue`). Will be removed in v2.0.
     */
    clearRefreshPromise(): void {
        this.refreshPromise = null;
    }

    /**
     * Set storage (useful for tests and configuration)
     */
    setStorage(storage: TokenStorage): void {
        this.storage = storage;
    }
}

// Export singleton instance
export const tokenManager = new TokenManager();

// Export class for configuration and tests
export { TokenManager, LocalStorageTokenStorage };

