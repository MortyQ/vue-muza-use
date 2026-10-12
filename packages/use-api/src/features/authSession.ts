import axios, {
    isAxiosError,
    type AxiosError,
    type AxiosInstance,
    type AxiosResponse,
    type InternalAxiosRequestConfig,
} from "axios";
import type {
    AuthMode,
    AuthSession,
    AuthSessionEvent,
    AuthSessionEventMap,
    AuthSessionOptions,
    DeclarativeRefreshOptions,
    RefreshResult,
} from "../types";
import { trackAuthEvent, AuthEventType } from "./monitor";
import { tokenManager as defaultTokenManager, LocalStorageTokenStorage, TOKEN_TYPE } from "./tokenManager";
import { devtoolsBridge, nextRequestId, isDevtoolsExpected, redactTokenFields } from "../devtools";
import { parseApiError } from "../utils/errorParser";
import { normalizeHeaders } from "../utils/headerUtils";

export const DEFAULT_REFRESH_LOCK_NAME = "vue-muza-use:auth-refresh";

const AUTH_HEADER = "Authorization";

/** Same request extensions the legacy interceptor reads (see interceptors.ts). */
interface SessionRequestConfig extends InternalAxiosRequestConfig {
    authMode?: AuthMode;
    _retry?: boolean;
    /** Devtools record id of the originating request; set by useApi so the 401→refresh retry can be flagged. */
    _devtoolsRequestId?: string;
}

// Copy of the legacy interceptor's flagAuthRetry — kept private there on purpose
// (interceptors.ts is not edited by the session). Marks the originating request's
// devtools record as "401 → token refreshed & retried".
function flagAuthRetry(request: SessionRequestConfig): void {
    if (request._devtoolsRequestId && isDevtoolsExpected()) {
        devtoolsBridge.onRequestAuthRetry(request._devtoolsRequestId);
    }
}

/** A body `fetch` can send twice — everything except a one-shot stream. */
function isReplayableBody(body: BodyInit | null | undefined): boolean {
    if (body === undefined || body === null || typeof body === "string") return true;
    if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return true;
    if (typeof FormData !== "undefined" && body instanceof FormData) return true;
    if (typeof Blob !== "undefined" && body instanceof Blob) return true;
    return body instanceof ArrayBuffer || ArrayBuffer.isView(body);
}

function isRequest(input: RequestInfo | URL): input is Request {
    return typeof Request !== "undefined" && input instanceof Request;
}

function requestUrl(input: RequestInfo | URL): string {
    if (typeof input === "string") return input;
    return isRequest(input) ? input.url : input.toString();
}

/** The bearer token a request was sent with, or null. */
function tokenFromHeader(request: SessionRequestConfig): string | null {
    const value = request.headers?.get?.(AUTH_HEADER);
    if (typeof value !== "string") return null;
    const prefix = `${TOKEN_TYPE} `;
    return value.startsWith(prefix) ? value.slice(prefix.length) : null;
}

/** A transport result plus the raw response the declarative form hands to events and hooks. */
interface TransportOutcome {
    tokens: RefreshResult;
    response: AxiosResponse | null;
}

/** Monitor metadata of the request that triggered a refresh — internal to the session. */
interface RefreshTrigger {
    staleAccessToken: string | null;
    url?: string;
}

type Listener<E extends AuthSessionEvent> = (payload: AuthSessionEventMap[E]) => void;

interface LockManagerLike {
    request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

function getLockManager(): LockManagerLike | null {
    if (typeof navigator === "undefined") return null;
    const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks;
    return locks && typeof locks.request === "function" ? locks : null;
}

/**
 * Create a shared authentication session — one owner of the access token and
 * of the token refresh for any number of axios instances and non-axios
 * consumers (Apollo links, WebSocket `connectionParams`, `fetch`).
 *
 * The legacy `createApiClient({ authOptions })` path is unaffected: a session
 * only does something for the code that uses it.
 *
 * @example
 * ```ts
 * const session = createAuthSession({
 *     refresh: { url: "/auth/refresh", baseURL: "/api", withCredentials: true },
 * });
 *
 * session.on("refreshFailed", () => router.push("/login"));
 *
 * // Function transport — e.g. a GraphQL refresh mutation
 * const gqlSession = createAuthSession({
 *     refresh: async ({ refreshToken }) => {
 *         const { data } = await publicAxios.post("/graphql", { query: REFRESH, variables: { refreshToken } });
 *         return { accessToken: data.data.refresh.accessToken };
 *     },
 * });
 * ```
 */
export function createAuthSession(options: AuthSessionOptions): AuthSession {
    const tokens = options.tokens ?? defaultTokenManager;

    // Explicit replacement for the implicit setStorage side effect of the
    // legacy createApiClient — applied only when the caller asks for it.
    if (options.storeRefreshToken !== undefined) {
        tokens.setStorage(new LocalStorageTokenStorage({ storeRefreshToken: options.storeRefreshToken }));
    }

    const crossTab = options.crossTab ?? false;
    const lockName =
        typeof crossTab === "object" ? crossTab.lockName ?? DEFAULT_REFRESH_LOCK_NAME : DEFAULT_REFRESH_LOCK_NAME;

    const listeners: { [E in AuthSessionEvent]: Set<Listener<E>> } = {
        refreshStart: new Set(),
        refreshed: new Set(),
        refreshFailed: new Set(),
        cleared: new Set(),
    };

    const emit = <E extends AuthSessionEvent>(event: E, payload: AuthSessionEventMap[E]): void => {
        // Iterate a copy: a listener may unsubscribe itself (or others) while running
        for (const listener of [...listeners[event]]) {
            try {
                listener(payload);
            } catch (err) {
                console.error("[vue-muza-use] auth session listener failed", err);
            }
        }
    };

    const transport = createTransport(options.refresh, () => tokens.getRefreshToken());

    const withLock = <T>(fn: () => Promise<T>): Promise<T> => {
        if (!crossTab) return fn();
        const locks = getLockManager();
        return locks ? locks.request(lockName, fn) : fn();
    };

    let inflight: Promise<string> | null = null;

    const run = async (trigger: RefreshTrigger): Promise<string> => {
        const { staleAccessToken } = trigger;
        emit("refreshStart", { staleAccessToken });
        trackAuthEvent(AuthEventType.REFRESH_START, trigger.url !== undefined ? { url: trigger.url } : {});

        try {
            const outcome = await withLock(async (): Promise<TransportOutcome> => {
                if (crossTab) {
                    // Another tab may have refreshed while this one waited for the lock
                    const current = tokens.getAccessToken();
                    if (current && current !== staleAccessToken) {
                        return { tokens: { accessToken: current }, response: null };
                    }
                }

                const result = await transport.run({
                    refreshToken: tokens.getRefreshToken(),
                    staleAccessToken,
                });
                if (!result.tokens.accessToken) {
                    throw new Error("No access token in refresh response");
                }
                tokens.setTokens(result.tokens);
                if (result.response && transport.onTokenRefreshed) {
                    await transport.onTokenRefreshed(result.response);
                }
                return result;
            });

            trackAuthEvent(AuthEventType.REFRESH_SUCCESS);
            emit("refreshed", { accessToken: outcome.tokens.accessToken, response: outcome.response });
            return outcome.tokens.accessToken;
        } catch (error) {
            tokens.clearTokens();
            trackAuthEvent(AuthEventType.REFRESH_ERROR, { error });
            emit("refreshFailed", { error });
            throw error;
        }
    };

    /** Single-flight entry point shared by `refresh()` and the attached instances. */
    const refreshInternal = (trigger: RefreshTrigger): Promise<string> => {
        if (inflight) return inflight;
        inflight = run(trigger).finally(() => {
            inflight = null;
        });
        return inflight;
    };

    const session: AuthSession = {
        getAccessToken: () => tokens.getAccessToken(),
        getAuthHeader: () => {
            const token = tokens.getAccessToken();
            return token ? `${TOKEN_TYPE} ${token}` : null;
        },
        refresh: (refreshOptions = {}) =>
            refreshInternal({
                staleAccessToken:
                    refreshOptions.staleAccessToken !== undefined
                        ? refreshOptions.staleAccessToken
                        : tokens.getAccessToken(),
            }),
        get isRefreshing() {
            return inflight !== null;
        },
        on: (event, listener) => {
            listeners[event].add(listener);
            return () => {
                listeners[event].delete(listener);
            };
        },
        clear: () => {
            tokens.clearTokens();
            emit("cleared", {});
        },
        attach: (instance) => attachInstance(instance),
        // Arrow property: stays bound when handed to Apollo/graphql clients as-is
        fetch: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const impl = options.fetch ?? globalThis.fetch;

            // init.headers replaces a Request's own headers, exactly as fetch does
            const callerHeaders = new Headers(init?.headers ?? (isRequest(input) ? input.headers : undefined));
            if (callerHeaders.has(AUTH_HEADER)) return impl(input, init);

            const withToken = (token: string | null): RequestInit => {
                const headers = new Headers(callerHeaders);
                if (token) headers.set(AUTH_HEADER, `${TOKEN_TYPE} ${token}`);
                return { ...init, headers };
            };

            // A Request's body can be read once — keep a copy for the repeat
            const replayInput = isRequest(input) ? input.clone() : input;
            const replayable = isRequest(input) || isReplayableBody(init?.body);

            const token = tokens.getAccessToken();
            const response = await impl(input, withToken(token));
            if (response.status !== 401 || !token) return response;

            let freshToken: string;
            try {
                freshToken = await refreshInternal({ staleAccessToken: token, url: requestUrl(input) });
            } catch {
                // refreshFailed is already emitted; the caller sees the real 401
                return response;
            }

            if (!replayable) return response;
            return impl(replayInput, withToken(freshToken));
        },
    };

    /**
     * The legacy 401 contract (interceptors.ts), with the refresh routed to the
     * session: same authMode rules, same guard order, one retry per request.
     * Unlike the legacy queue, every waiting request is marked `_retry`, so a
     * request that is still 401 after the refresh is never refreshed again.
     */
    function attachInstance(instance: AxiosInstance): void {
        instance.interceptors.request.use(
            (config: InternalAxiosRequestConfig) => {
                if ((config as SessionRequestConfig).authMode === "public") return config;

                const header = session.getAuthHeader();
                if (header) {
                    config.headers.set(AUTH_HEADER, header);
                } else {
                    config.headers.delete(AUTH_HEADER);
                }
                return config;
            },
            (error) => Promise.reject(error),
        );

        instance.interceptors.response.use(
            (response) => response,
            async (error: AxiosError) => {
                const originalRequest = error.config as SessionRequestConfig | undefined;

                if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
                    return Promise.reject(error);
                }

                if (originalRequest.authMode === "public" || originalRequest.authMode === "optional") {
                    return Promise.reject(error);
                }

                originalRequest._retry = true;
                if (inflight) {
                    trackAuthEvent(AuthEventType.REQUEST_QUEUED, { url: originalRequest.url });
                }

                // Rejects with the refresh error — tokens are already cleared and
                // refreshFailed already emitted by the session
                const token = await refreshInternal({
                    staleAccessToken: tokenFromHeader(originalRequest),
                    url: originalRequest.url,
                });

                originalRequest.headers.set(AUTH_HEADER, `${TOKEN_TYPE} ${token}`);
                flagAuthRetry(originalRequest);
                return instance(originalRequest);
            },
        );
    }

    return session;
}

interface Transport {
    run(context: { refreshToken: string | null; staleAccessToken: string | null }): Promise<TransportOutcome>;
    onTokenRefreshed?: (response: AxiosResponse) => void | Promise<void>;
}

function createTransport(
    refresh: AuthSessionOptions["refresh"],
    getRefreshToken: () => string | null,
): Transport {
    if (typeof refresh === "function") {
        return {
            run: async (context) => ({ tokens: await refresh(context), response: null }),
        };
    }
    return createDeclarativeTransport(refresh, getRefreshToken);
}

/**
 * The legacy interceptor's refresh request (`interceptors.ts`), sent through a
 * private axios instance with no interceptors — so a 401 from the refresh
 * endpoint can never recurse into another refresh.
 */
function createDeclarativeTransport(
    options: DeclarativeRefreshOptions,
    getRefreshToken: () => string | null,
): Transport {
    const { url, baseURL, withCredentials = false, payload: payloadOption, extractTokens, timeout = 60000 } = options;
    let client: AxiosInstance | null = null;

    const getClient = (): AxiosInstance => {
        client ??= axios.create({
            baseURL,
            timeout,
            headers: { "Content-Type": "application/json" },
        });
        return client;
    };

    return {
        onTokenRefreshed: options.onTokenRefreshed,
        run: async () => {
            let devtoolsId: string | null = null;
            let devtoolsStartedAt = 0;

            try {
                let payload: Record<string, unknown> = {};
                if (payloadOption) {
                    payload = typeof payloadOption === "function" ? await payloadOption() : payloadOption;
                }

                // Same rule as the legacy interceptor: without a stored refresh
                // token the refresh token must be travelling in a cookie
                const shouldUseCredentials = withCredentials || !getRefreshToken();

                if (isDevtoolsExpected()) {
                    devtoolsId = nextRequestId();
                    devtoolsStartedAt = Date.now();
                    devtoolsBridge.onRequestStart({
                        id: devtoolsId,
                        instanceId: null,
                        url,
                        method: "POST",
                        startedAt: devtoolsStartedAt,
                        status: "pending",
                        statusCode: null,
                        requestHeaders: {},
                        payload: redactTokenFields(payload),
                        queryParams: null,
                    });
                }

                const response = await getClient().post<{
                    accessToken?: string;
                    access_token?: string;
                    refreshToken?: string;
                    refresh_token?: string;
                }>(url, payload, { withCredentials: shouldUseCredentials });

                if (devtoolsId !== null) {
                    devtoolsBridge.onRequestEnd(devtoolsId, {
                        status: "success",
                        statusCode: response.status,
                        response: redactTokenFields(response.data),
                        duration: Date.now() - devtoolsStartedAt,
                        requestHeaders: normalizeHeaders(response.config?.headers),
                        responseHeaders: normalizeHeaders(response.headers),
                    });
                }

                let accessToken: string | undefined;
                let refreshToken: string | undefined;
                if (extractTokens) {
                    const extracted = extractTokens(response);
                    accessToken = extracted.accessToken;
                    refreshToken = extracted.refreshToken;
                } else {
                    const data = response.data ?? {};
                    accessToken = data.accessToken || data.access_token;
                    refreshToken = data.refreshToken || data.refresh_token;
                }

                // An empty accessToken is rejected by the session, like the legacy path
                return { tokens: { accessToken: accessToken ?? "", refreshToken }, response };
            } catch (refreshError) {
                if (devtoolsId !== null) {
                    const apiError = parseApiError(refreshError);
                    devtoolsBridge.onRequestEnd(devtoolsId, {
                        status: "error",
                        error: { ...apiError, details: redactTokenFields(apiError.details) },
                        statusCode: apiError.status || null,
                        duration: Date.now() - devtoolsStartedAt,
                        ...(isAxiosError(refreshError)
                            ? {
                                  requestHeaders: normalizeHeaders(refreshError.config?.headers),
                                  responseHeaders: normalizeHeaders(refreshError.response?.headers),
                              }
                            : {}),
                    });
                }
                throw refreshError;
            }
        },
    };
}
