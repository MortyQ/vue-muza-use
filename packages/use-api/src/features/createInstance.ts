import axios, { type AxiosInstance, type CreateAxiosDefaults } from "axios";
import type { AuthSession } from "../types";
import { setupInterceptors, type InterceptorOptions } from "./interceptors";
import { tokenManager, LocalStorageTokenStorage } from "./tokenManager";

export interface CreateApiClientOptions extends CreateAxiosDefaults {
    withAuth?: boolean;
    authOptions?: InterceptorOptions;
    /**
     * Share an auth session (see `createAuthSession`) with this instance: it sends
     * the session's token and refreshes through the session on a 401, together
     * with every other instance attached to the same session.
     *
     * When set, `withAuth` and `authOptions` are ignored and the global token
     * storage is **not** reconfigured. New in 1.9.
     */
    authSession?: AuthSession;
}

export function createApiClient(options: CreateApiClientOptions = {}): AxiosInstance {
    const {
        withAuth = true,
        authOptions,
        authSession,
        ...axiosConfig
    } = options;

    if (authSession) {
        const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";
        if (isDev && (authOptions !== undefined || options.withAuth === false)) {
            console.warn(
                "[vue-muza-use] createApiClient: `authSession` is set, so `authOptions` / `withAuth` are ignored — " +
                "the instance uses the auth session.",
            );
        }

        const sessionInstance = axios.create({
            timeout: 60000,
            headers: { "Content-Type": "application/json" },
            ...axiosConfig,
        });
        authSession.attach(sessionInstance);
        return sessionInstance;
    }

    // Configure token storage based on refreshWithCredentials
    //
    // Two modes:
    // 1. refreshWithCredentials: false (default) → storeRefreshToken: true
    //    - Both access & refresh tokens stored in localStorage
    //    - Use when: standard REST API without httpOnly cookies
    //
    // 2. refreshWithCredentials: true → storeRefreshToken: false
    //    - Only access token in localStorage
    //    - Refresh token sent via httpOnly cookie (more secure)
    //    - Use when: high security requirements
    //
    const storeRefreshToken = !authOptions?.refreshWithCredentials;

    tokenManager.setStorage(new LocalStorageTokenStorage({ storeRefreshToken }));

    const instance = axios.create({
        timeout: 60000,
        headers: { "Content-Type": "application/json" },
        ...axiosConfig,
    });

    if (withAuth) {
        setupInterceptors(instance, authOptions);
    }

    return instance;
}
