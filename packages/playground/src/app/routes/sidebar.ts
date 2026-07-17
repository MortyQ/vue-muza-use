import { createSidebar } from "@ametie/ui";

export const sidebar = createSidebar({
    brandName: "vue-muza-use",
    storageKey: "playground-sidebar",
    persistCollapse: true,
    items: [
        { id: "core", label: "Core", icon: "mdi:code-braces", children: [
            { id: "core-basic", label: "Basic Fetch", to: "/core/basic" },
            { id: "core-dynamic-url", label: "Dynamic URL", to: "/core/dynamic-url" },
            { id: "core-lazy", label: "Lazy Mode", to: "/core/lazy" },
            { id: "core-debounce", label: "Debounce", to: "/core/debounce" },
            { id: "core-coalesce", label: "Coalesce (1.7)", to: "/core/coalesce" },
            { id: "core-select", label: "Select Transform", to: "/core/select" },
            { id: "core-auto-cache-keys", label: "Auto Cache Keys", to: "/core/auto-cache-keys" },
        ]},
        { id: "batch", label: "Batch", icon: "mdi:layers-triple", children: [
            { id: "batch-basic", label: "Basic Batch", to: "/batch/basic" },
            { id: "batch-concurrency", label: "Concurrency", to: "/batch/concurrency" },
            { id: "batch-settled", label: "Settled Errors", to: "/batch/settled" },
            { id: "batch-reactive", label: "Reactive Getter", to: "/batch/reactive" },
        ]},
        { id: "cache", label: "Cache", icon: "mdi:database-clock", children: [
            { id: "cache-ttl", label: "TTL Cache", to: "/cache/ttl" },
            { id: "cache-swr", label: "SWR", to: "/cache/swr" },
            { id: "cache-invalidation", label: "Invalidation", to: "/cache/invalidation" },
        ]},
        { id: "polling", label: "Polling", icon: "mdi:refresh", children: [
            { id: "polling-basic", label: "Basic Polling", to: "/polling/basic" },
            { id: "polling-when-hidden", label: "When Hidden", to: "/polling/when-hidden" },
            { id: "polling-dynamic", label: "Dynamic Interval", to: "/polling/dynamic" },
        ]},
        { id: "triggers", label: "Triggers", icon: "mdi:lightning-bolt", children: [
            { id: "triggers-focus", label: "Refetch on Focus", to: "/triggers/focus" },
            { id: "triggers-reconnect", label: "Refetch on Reconnect", to: "/triggers/reconnect" },
        ]},
        { id: "retry", label: "Retry", icon: "mdi:reload", children: [
            { id: "retry-basic", label: "Auto Retry", to: "/retry/basic" },
            { id: "retry-custom-codes", label: "Custom Status Codes", to: "/retry/custom-codes" },
        ]},
        { id: "auth", label: "Auth", icon: "mdi:shield-account", children: [
            { id: "auth-login", label: "Login / Logout", to: "/auth/login" },
            { id: "auth-refresh", label: "Token Refresh", to: "/auth/refresh" },
            { id: "auth-modes", label: "Auth Modes", to: "/auth/modes" },
        ]},
        { id: "state", label: "State", icon: "mdi:state-machine", children: [
            { id: "state-mutate", label: "Mutate", to: "/state/mutate" },
            { id: "state-reset", label: "Reset", to: "/state/reset" },
            { id: "state-ignore-updates", label: "Ignore Updates", to: "/state/ignore-updates" },
        ]},
        { id: "devtools", label: "Devtools", icon: "mdi:bug-outline", children: [
            { id: "devtools-kitchen-sink", label: "Kitchen Sink", to: "/devtools/kitchen-sink" },
            { id: "devtools-stress-test", label: "Stress Test", to: "/devtools/stress-test" },
            { id: "devtools-errors", label: "Error States", to: "/devtools/errors" },
        ]},
    ],
});
