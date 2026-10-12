import type { AxiosInstance } from "axios";
import type { ApiClientConfig, ApiError, ApiPluginOptions } from "../types";

/** Name of the client backed by `createApi({ axios })`. Reserved in `clients`. */
export const DEFAULT_CLIENT = "default";

/** The axios instance and error parser a request should use. */
export interface ResolvedClient {
    name: string;
    axios: AxiosInstance;
    errorParser?: (error: unknown) => ApiError;
}

// Named clients per plugin config object — built once, on first lookup. The default
// client is not cached: it is read from the config on every call, as before 1.9.
const registries = new WeakMap<ApiPluginOptions, Map<string, ResolvedClient>>();

// An axios instance is itself a function with `.request`; the full form is a
// plain object whose `axios` key holds the instance.
function isClientConfig(value: AxiosInstance | ApiClientConfig): value is ApiClientConfig {
    return "axios" in value && typeof (value as { request?: unknown }).request !== "function";
}

/**
 * Throw if `clients` uses the reserved `default` name. Called by `createApi`, so a
 * misconfiguration fails at startup rather than on the first request.
 */
export function assertValidClients(clients: ApiPluginOptions["clients"]): void {
    if (clients && Object.prototype.hasOwnProperty.call(clients, DEFAULT_CLIENT)) {
        throw new Error(
            `[vue-muza-use] createApi: the client name "${DEFAULT_CLIENT}" is reserved for the main \`axios\` instance — ` +
            "rename the entry in `clients`.",
        );
    }
}

function buildRegistry(config: ApiPluginOptions): Map<string, ResolvedClient> {
    const registry = new Map<string, ResolvedClient>();
    for (const [name, value] of Object.entries(config.clients ?? {})) {
        if (name === DEFAULT_CLIENT) continue; // rejected by createApi; never shadow the main instance
        registry.set(
            name,
            isClientConfig(value)
                ? { name, axios: value.axios, errorParser: value.errorParser ?? config.errorParser }
                : { name, axios: value, errorParser: config.errorParser },
        );
    }
    return registry;
}

/**
 * Resolve the client a request uses. `undefined` and `"default"` are the main
 * `axios`. An unknown name throws, listing the registered names.
 */
export function resolveClient(config: ApiPluginOptions, name: string | undefined): ResolvedClient {
    if (name === undefined || name === DEFAULT_CLIENT) {
        return { name: DEFAULT_CLIENT, axios: config.axios, errorParser: config.errorParser };
    }

    let registry = registries.get(config);
    if (!registry) {
        registry = buildRegistry(config);
        registries.set(config, registry);
    }

    const resolved = registry.get(name);
    if (!resolved) {
        const registered = [DEFAULT_CLIENT, ...registry.keys()].join(", ");
        throw new Error(`[vue-muza-use] Unknown API client "${name}". Registered: ${registered}`);
    }
    return resolved;
}
