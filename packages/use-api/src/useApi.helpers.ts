import type { MaybeRefOrGetter } from "vue";
import type { UseApiOptions, UseApiReturn } from "./types";
import { useApi } from "./useApi";

/**
 * Helper for GET requests
 *
 * @example
 * ```ts
 * const { data, loading, error } = useApiGet<User[]>('/users', {
 *   immediate: true
 * })
 *
 * // With select:
 * const { data } = useApiGet<ApiResponse, User[]>('/users', {
 *   select: (res) => res.data,
 * })
 * ```
 */
export function useApiGet<T = unknown, TSelected = T>(
    url: MaybeRefOrGetter<string | undefined>,
    options?: Omit<UseApiOptions<T, unknown, TSelected>, "method">,
): UseApiReturn<TSelected> {
    return useApi<T, unknown, TSelected>(url, { ...options, method: "GET" });
}

/**
 * Helper for POST requests
 *
 * @example
 * ```ts
 * const { data, loading, execute } = useApiPost<User, CreateUserDto>('/users')
 * await execute({ data: { name: 'John' } })
 * ```
 */
export function useApiPost<T = unknown, D = unknown, TSelected = T>(
    url: MaybeRefOrGetter<string | undefined>,
    options?: Omit<UseApiOptions<T, D, TSelected>, "method">,
): UseApiReturn<TSelected, D> {
    return useApi<T, D, TSelected>(url, { ...options, method: "POST" });
}

/**
 * Helper for PUT requests
 *
 * @example
 * ```ts
 * const { execute } = useApiPut<User, UpdateUserDto>('/users/1')
 * await execute({ data: { name: 'John Doe' } })
 * ```
 */
export function useApiPut<T = unknown, D = unknown, TSelected = T>(
    url: MaybeRefOrGetter<string | undefined>,
    options?: Omit<UseApiOptions<T, D, TSelected>, "method">,
): UseApiReturn<TSelected, D> {
    return useApi<T, D, TSelected>(url, { ...options, method: "PUT" });
}

/**
 * Helper for PATCH requests
 *
 * @example
 * ```ts
 * const { execute } = useApiPatch<User, Partial<User>>('/users/1')
 * await execute({ data: { name: 'John' } })
 * ```
 */
export function useApiPatch<T = unknown, D = unknown, TSelected = T>(
    url: MaybeRefOrGetter<string | undefined>,
    options?: Omit<UseApiOptions<T, D, TSelected>, "method">,
): UseApiReturn<TSelected, D> {
    return useApi<T, D, TSelected>(url, { ...options, method: "PATCH" });
}

/**
 * Helper for DELETE requests
 *
 * @example
 * ```ts
 * const { execute } = useApiDelete('/users/1')
 * await execute()
 * ```
 */
export function useApiDelete<T = unknown, TSelected = T>(
    url: MaybeRefOrGetter<string | undefined>,
    options?: Omit<UseApiOptions<T, unknown, TSelected>, "method">,
): UseApiReturn<TSelected> {
    return useApi<T, unknown, TSelected>(url, { ...options, method: "DELETE" });
}
