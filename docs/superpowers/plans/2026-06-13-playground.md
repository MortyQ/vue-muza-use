# Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished FSD-structured playground with 28 live examples covering every `@ametie/vue-muza-use` feature, plus 3 devtools testing scenarios.

**Architecture:** Two new workspace packages (`libs/config`, `libs/ui`) copied from muzakit and renamed to the `@ametie/` namespace. The playground is fully rebuilt with FSD layers (app → pages → features → shared), Vue Router (example-per-page), and a `NavigationSidebar` from `@ametie/ui`. Each example is a feature component wrapped in `DemoWrapper` with a Show Code toggle.

**Tech Stack:** Vue 3.5, Vue Router 4, Pinia 3, @ametie/ui (workspace), @ametie/config (workspace), @ametie/vue-muza-use (workspace), Axios, Vite 6, TypeScript 5, Tailwind CSS v4, highlight.js

---

## File Map

### New: `libs/config/` (@ametie/config)
- `package.json` — rename from @muzakit/config
- `src/tailwind/theme.css` — OKLCH tokens, unchanged
- `src/index.ts` — exports nprogress + config

### New: `libs/ui/` (@ametie/ui)
- `package.json` — rename, @muzakit/config → @ametie/config
- `src/index.ts` — exports all components, unchanged
- `src/style.css` — **new file**: `@import "./styles/tokens.css"`
- `src/styles/tokens.css` — CSS variables, unchanged
- `src/styles/components/**` — SCSS per component, unchanged
- `src/components/**` — all Vue components, unchanged
- `vite.config.ts` — update @muzakit/config → @ametie/config in devDependency comment

### Modified: `pnpm-workspace.yaml`
- Add `libs/*` to packages list

### Modified: `packages/playground/` (full rebuild)
- `package.json` — new dependencies
- `vite.config.ts` — add `@/` alias, Tailwind plugin
- `tsconfig.json` — add paths for `@/`
- `src/app/main.ts` — createApp + createApi + pinia + router
- `src/app/App.vue` — RouterView in DefaultLayout
- `src/app/assets/main.css` — import theme + ui styles
- `src/app/layouts/DefaultLayout.vue` — sidebar + router-view
- `src/app/routes/index.ts` — createRouter
- `src/app/routes/modules.ts` — assemble route files
- `src/app/routes/sidebar.ts` — createSidebar config
- `src/app/routes/paths/coreRoutes.ts`
- `src/app/routes/paths/batchRoutes.ts`
- `src/app/routes/paths/cacheRoutes.ts`
- `src/app/routes/paths/pollingRoutes.ts`
- `src/app/routes/paths/triggersRoutes.ts`
- `src/app/routes/paths/retryRoutes.ts`
- `src/app/routes/paths/authRoutes.ts`
- `src/app/routes/paths/stateRoutes.ts`
- `src/app/routes/paths/devtoolsRoutes.ts`
- `src/shared/api/axios.ts` — createApiClient
- `src/shared/components/DemoWrapper.vue` — title + description + Show Code
- `src/shared/composables/useCodeBlock.ts` — highlight.js wrapper
- `packages/playground/.env` — API URL + auth credentials
- 28 × `src/pages/<group>/<Name>Page.vue` — thin router wrappers
- 28 × `src/features/<group>/<Name>.vue` — live demo components
- `src/features/auth/store/useAuthDemoStore.ts` — Pinia auth store

---

## Part 1 — libs setup + workspace

---

### Task 1: Copy and configure libs/config

**Files:**
- Create: `libs/config/` (copied from muzakit, name updated)
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Copy libs/config from muzakit**

```bash
cp -r /Users/serhii/Desktop/Mine/muzakit/libs/config libs/config
rm -rf libs/config/node_modules libs/config/dist
```

- [ ] **Step 2: Update package name**

Open `libs/config/package.json` and change `"name": "@muzakit/config"` to `"name": "@ametie/config"`. The file should look like:

```json
{
  "name": "@ametie/config",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./tailwind/theme.css": "./src/tailwind/theme.css",
    "./tsconfig.base.json": "./tsconfig.base.json",
    "./eslint.base.mjs": "./src/eslint/eslint.base.mjs"
  },
  "devDependencies": {
    "@types/nprogress": "^0.2.3",
    "tailwindcss": "^4.1.0"
  },
  "dependencies": {
    "nprogress": "^0.2.0"
  }
}
```

- [ ] **Step 3: Update pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
  - 'libs/*'
```

- [ ] **Step 4: Verify install**

```bash
pnpm install
```

Expected: installs without errors, `@ametie/config` appears in workspace.

- [ ] **Step 5: Commit**

```bash
git add libs/config pnpm-workspace.yaml
git commit -m "feat: add @ametie/config workspace package"
```

---

### Task 2: Copy and configure libs/ui

**Files:**
- Create: `libs/ui/` (copied from muzakit, name + dep updated)
- Create: `libs/ui/src/style.css` (new — points to tokens for dev)

- [ ] **Step 1: Copy libs/ui from muzakit**

```bash
cp -r /Users/serhii/Desktop/Mine/muzakit/libs/ui libs/ui
rm -rf libs/ui/node_modules libs/ui/dist
```

- [ ] **Step 2: Update package.json**

Replace `libs/ui/package.json` with:

```json
{
  "name": "@ametie/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    },
    "./style.css": "./src/style.css"
  },
  "scripts": {
    "build": "vite build",
    "build:lib": "vite build",
    "build:watch": "vite build --watch",
    "type-check": "vue-tsc --noEmit"
  },
  "peerDependencies": {
    "vue": "^3.5.0",
    "vue-router": "^4.0.0"
  },
  "devDependencies": {
    "@ametie/config": "workspace:*",
    "@tailwindcss/vite": "^4.1.0",
    "@vitejs/plugin-vue": "^5.2.0",
    "sass-embedded": "^1.97.3",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.7.0",
    "vite": "^6.3.0",
    "vite-plugin-dts": "^4.0.0",
    "vue": "^3.5.0",
    "vue-router": "^4.0.0",
    "vue-tsc": "^2.0.0",
    "@types/luxon": "^3.4.2"
  },
  "dependencies": {
    "@iconify/vue": "^5.0.0",
    "@tanstack/vue-virtual": "^3.13.23",
    "@vuepic/vue-datepicker": "^12.0.0",
    "@vueuse/core": "^14.2.1",
    "keyv-browser": "^0.1.1",
    "vue-multiselect": "^3.0.0",
    "vue-sonner": "^2.0.9",
    "luxon": "^3.5.0"
  }
}
```

Key changes: `name` → `@ametie/ui`, `./style.css` → `./src/style.css`, `@muzakit/config` → `@ametie/config`.

- [ ] **Step 3: Create src/style.css**

```css
/* libs/ui/src/style.css */
@import "./styles/tokens.css";
```

This allows the playground to `@import "@ametie/ui/style.css"` without a build step.

- [ ] **Step 4: Update @source path in theme.css**

Open `libs/config/src/tailwind/theme.css`. Verify the `@source` line reads:

```css
@source "../../../ui/src";
```

The path resolves to `libs/ui/src` — same relative structure as muzakit, no change needed.

- [ ] **Step 5: Install and verify**

```bash
pnpm install
```

Expected: `@ametie/ui` and `@ametie/config` both appear in workspace, no errors.

- [ ] **Step 6: Commit**

```bash
git add libs/ui pnpm-workspace.yaml
git commit -m "feat: add @ametie/ui workspace package"
```

---

### Task 3: Update playground package.json and vite.config.ts

**Files:**
- Modify: `packages/playground/package.json`
- Modify: `packages/playground/vite.config.ts`
- Modify: `packages/playground/tsconfig.app.json`

- [ ] **Step 1: Update package.json**

Replace `packages/playground/package.json` with:

```json
{
  "name": "playground",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@ametie/config": "workspace:*",
    "@ametie/ui": "workspace:*",
    "@ametie/vue-muza-use": "workspace:*",
    "axios": "^1.6.0",
    "pinia": "^3.0.4",
    "vue": "^3.5.24",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "@types/node": "^24.10.1",
    "@vitejs/plugin-vue": "^6.0.1",
    "@vue/tsconfig": "^0.8.1",
    "sass-embedded": "^1.97.3",
    "tailwindcss": "^4.1.0",
    "typescript": "~5.9.3",
    "vite": "npm:rolldown-vite@7.2.5",
    "vue-tsc": "^3.1.4"
  },
  "pnpm": {
    "overrides": {
      "vite": "npm:rolldown-vite@7.2.5"
    }
  }
}
```

- [ ] **Step 2: Update vite.config.ts**

```typescript
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [tailwindcss(), vue()],
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
            "@ametie/vue-muza-use": resolve(__dirname, "../use-api/src/index.ts"),
        },
    },
    server: {
        port: 5174,
        host: true,
    },
});
```

- [ ] **Step 3: Update tsconfig.app.json paths**

Add `paths` to `packages/playground/tsconfig.app.json` compilerOptions:

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "include": ["env.d.ts", "src/**/*", "src/**/*.vue"],
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 4: Install dependencies**

```bash
pnpm install
```

Expected: `vue-router`, `pinia`, `@ametie/ui`, `@ametie/config` all resolve.

- [ ] **Step 5: Commit**

```bash
git add libs/ pnpm-workspace.yaml packages/playground/package.json packages/playground/vite.config.ts packages/playground/tsconfig.app.json
git commit -m "feat: configure playground dependencies and build setup"
```

---

## Part 2 — Playground foundation (app layer + shared)

---

### Task 4: Scaffold FSD structure and app layer

**Files:**
- Create: `packages/playground/src/app/main.ts`
- Create: `packages/playground/src/app/App.vue`
- Create: `packages/playground/src/app/assets/main.css`
- Create: `packages/playground/src/app/layouts/DefaultLayout.vue`
- Create: `packages/playground/.env`

- [ ] **Step 1: Clear old src/ and create FSD skeleton**

```bash
cd packages/playground
rm -rf src
mkdir -p src/app/assets src/app/layouts src/app/routes/paths
mkdir -p src/pages/core src/pages/batch src/pages/cache src/pages/polling
mkdir -p src/pages/triggers src/pages/retry src/pages/auth src/pages/state src/pages/devtools
mkdir -p src/features/core src/features/batch src/features/cache src/features/polling
mkdir -p src/features/triggers src/features/retry src/features/auth/store src/features/state src/features/devtools
mkdir -p src/shared/api src/shared/components src/shared/composables src/shared/types
```

- [ ] **Step 2: Create .env**

`packages/playground/.env`:
```
VITE_API_URL=https://todo-list-backend-seven-mauve.vercel.app/api
VITE_AUTH_EMAIL=ametie@gmail.com
VITE_AUTH_PASSWORD=Password123!
```

- [ ] **Step 3: Create main.css**

`packages/playground/src/app/assets/main.css`:
```css
@import "@ametie/config/tailwind/theme.css";
@import "@ametie/ui/style.css";
@import "highlight.js/styles/github-dark.css";

body {
    margin: 0;
    background-color: var(--ui-background);
    color: var(--ui-foreground);
}
```

- [ ] **Step 4: Create main.ts**

`packages/playground/src/app/main.ts`:
```typescript
import { createApp } from "vue";
import { createPinia } from "pinia";
import { createApi } from "@ametie/vue-muza-use";
import { VToaster, useToast } from "@ametie/ui";

import App from "./App.vue";
import { router } from "./routes/index";
import { apiAxios } from "../shared/api/axios";
import "./assets/main.css";

const app = createApp(App);
app.use(createPinia());
app.use(router);

const { error } = useToast();
app.use(createApi({
    axios: apiAxios,
    onError: (err) => error(err.message),
}));

app.component("VToaster", VToaster);
app.mount("#app");
```

- [ ] **Step 5: Create App.vue**

`packages/playground/src/app/App.vue`:
```vue
<script setup lang="ts">
import DefaultLayout from "./layouts/DefaultLayout.vue";
</script>

<template>
    <DefaultLayout />
    <VToaster />
</template>
```

- [ ] **Step 6: Create DefaultLayout.vue**

`packages/playground/src/app/layouts/DefaultLayout.vue`:
```vue
<script setup lang="ts">
import { NavigationSidebar } from "@ametie/ui";
import { sidebar } from "../routes/sidebar";
</script>

<template>
    <div class="layout">
        <NavigationSidebar :sidebar="sidebar" />
        <main class="layout__content">
            <RouterView />
        </main>
    </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.layout__content { flex: 1; overflow-y: auto; padding: 32px; }
</style>
```

- [ ] **Step 7: Update index.html entry point**

`packages/playground/index.html` — update script src:
```html
<script type="module" src="/src/app/main.ts"></script>
```

- [ ] **Step 8: Commit**

```bash
git add libs/
git commit -m "feat: scaffold playground FSD structure and app layer"
```

---

### Task 5: Router and sidebar config

**Files:**
- Create: `packages/playground/src/app/routes/index.ts`
- Create: `packages/playground/src/app/routes/modules.ts`
- Create: `packages/playground/src/app/routes/sidebar.ts`
- Create: all 9 route path files

- [ ] **Step 1: Create routes/index.ts**

`packages/playground/src/app/routes/index.ts`:
```typescript
import { createRouter, createWebHistory } from "vue-router";
import { routes } from "./modules";

export const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: "/", redirect: "/core/basic" },
        ...routes,
        { path: "/:pathMatch(.*)*", redirect: "/core/basic" },
    ],
});
```

- [ ] **Step 2: Create routes/modules.ts**

`packages/playground/src/app/routes/modules.ts`:
```typescript
import type { RouteRecordRaw } from "vue-router";
import { coreRoutes } from "./paths/coreRoutes";
import { batchRoutes } from "./paths/batchRoutes";
import { cacheRoutes } from "./paths/cacheRoutes";
import { pollingRoutes } from "./paths/pollingRoutes";
import { triggersRoutes } from "./paths/triggersRoutes";
import { retryRoutes } from "./paths/retryRoutes";
import { authRoutes } from "./paths/authRoutes";
import { stateRoutes } from "./paths/stateRoutes";
import { devtoolsRoutes } from "./paths/devtoolsRoutes";

export const routes: RouteRecordRaw[] = [
    ...coreRoutes, ...batchRoutes, ...cacheRoutes, ...pollingRoutes,
    ...triggersRoutes, ...retryRoutes, ...authRoutes, ...stateRoutes, ...devtoolsRoutes,
];
```

- [ ] **Step 3: Create all 9 route path files**

`src/app/routes/paths/coreRoutes.ts`:
```typescript
import type { RouteRecordRaw } from "vue-router";
export const coreRoutes: RouteRecordRaw[] = [
    { path: "/core/basic", component: () => import("../../../pages/core/BasicFetchPage.vue") },
    { path: "/core/dynamic-url", component: () => import("../../../pages/core/DynamicUrlPage.vue") },
    { path: "/core/lazy", component: () => import("../../../pages/core/LazyPage.vue") },
    { path: "/core/debounce", component: () => import("../../../pages/core/DebouncePage.vue") },
    { path: "/core/select", component: () => import("../../../pages/core/SelectTransformPage.vue") },
];
```

`src/app/routes/paths/batchRoutes.ts`:
```typescript
import type { RouteRecordRaw } from "vue-router";
export const batchRoutes: RouteRecordRaw[] = [
    { path: "/batch/basic", component: () => import("../../../pages/batch/BasicBatchPage.vue") },
    { path: "/batch/concurrency", component: () => import("../../../pages/batch/ConcurrencyPage.vue") },
    { path: "/batch/settled", component: () => import("../../../pages/batch/SettledErrorsPage.vue") },
    { path: "/batch/reactive", component: () => import("../../../pages/batch/ReactiveBatchPage.vue") },
];
```

`src/app/routes/paths/cacheRoutes.ts`:
```typescript
import type { RouteRecordRaw } from "vue-router";
export const cacheRoutes: RouteRecordRaw[] = [
    { path: "/cache/ttl", component: () => import("../../../pages/cache/TtlCachePage.vue") },
    { path: "/cache/swr", component: () => import("../../../pages/cache/SwrPage.vue") },
    { path: "/cache/invalidation", component: () => import("../../../pages/cache/InvalidationPage.vue") },
];
```

`src/app/routes/paths/pollingRoutes.ts`:
```typescript
import type { RouteRecordRaw } from "vue-router";
export const pollingRoutes: RouteRecordRaw[] = [
    { path: "/polling/basic", component: () => import("../../../pages/polling/BasicPollingPage.vue") },
    { path: "/polling/when-hidden", component: () => import("../../../pages/polling/WhenHiddenPage.vue") },
    { path: "/polling/dynamic", component: () => import("../../../pages/polling/DynamicIntervalPage.vue") },
];
```

`src/app/routes/paths/triggersRoutes.ts`:
```typescript
import type { RouteRecordRaw } from "vue-router";
export const triggersRoutes: RouteRecordRaw[] = [
    { path: "/triggers/focus", component: () => import("../../../pages/triggers/RefetchOnFocusPage.vue") },
    { path: "/triggers/reconnect", component: () => import("../../../pages/triggers/RefetchOnReconnectPage.vue") },
];
```

`src/app/routes/paths/retryRoutes.ts`:
```typescript
import type { RouteRecordRaw } from "vue-router";
export const retryRoutes: RouteRecordRaw[] = [
    { path: "/retry/basic", component: () => import("../../../pages/retry/AutoRetryPage.vue") },
    { path: "/retry/custom-codes", component: () => import("../../../pages/retry/CustomStatusCodesPage.vue") },
];
```

`src/app/routes/paths/authRoutes.ts`:
```typescript
import type { RouteRecordRaw } from "vue-router";
export const authRoutes: RouteRecordRaw[] = [
    { path: "/auth/login", component: () => import("../../../pages/auth/LoginPage.vue") },
    { path: "/auth/refresh", component: () => import("../../../pages/auth/TokenRefreshPage.vue") },
    { path: "/auth/modes", component: () => import("../../../pages/auth/AuthModesPage.vue") },
];
```

`src/app/routes/paths/stateRoutes.ts`:
```typescript
import type { RouteRecordRaw } from "vue-router";
export const stateRoutes: RouteRecordRaw[] = [
    { path: "/state/mutate", component: () => import("../../../pages/state/MutatePage.vue") },
    { path: "/state/reset", component: () => import("../../../pages/state/ResetPage.vue") },
    { path: "/state/ignore-updates", component: () => import("../../../pages/state/IgnoreUpdatesPage.vue") },
];
```

`src/app/routes/paths/devtoolsRoutes.ts`:
```typescript
import type { RouteRecordRaw } from "vue-router";
export const devtoolsRoutes: RouteRecordRaw[] = [
    { path: "/devtools/kitchen-sink", component: () => import("../../../pages/devtools/KitchenSinkPage.vue") },
    { path: "/devtools/stress-test", component: () => import("../../../pages/devtools/StressTestPage.vue") },
    { path: "/devtools/errors", component: () => import("../../../pages/devtools/ErrorStatesPage.vue") },
];
```

- [ ] **Step 4: Create sidebar.ts**

`packages/playground/src/app/routes/sidebar.ts`:
```typescript
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
            { id: "core-select", label: "Select Transform", to: "/core/select" },
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
```

- [ ] **Step 5: Commit**

```bash
git add libs/
git commit -m "feat: add playground router and sidebar config"
```

---

### Task 6: Shared layer (axios, DemoWrapper, useCodeBlock)

**Files:**
- Create: `packages/playground/src/shared/api/axios.ts`
- Create: `packages/playground/src/shared/components/DemoWrapper.vue`
- Create: `packages/playground/src/shared/composables/useCodeBlock.ts`

- [ ] **Step 1: Install highlight.js**

```bash
pnpm --filter playground add highlight.js
```

- [ ] **Step 2: Create axios.ts**

`packages/playground/src/shared/api/axios.ts`:
```typescript
import { createApiClient } from "@ametie/vue-muza-use";

export const apiAxios = createApiClient({
    baseURL: import.meta.env.VITE_API_URL as string,
});
```

- [ ] **Step 3: Create useCodeBlock.ts**

`packages/playground/src/shared/composables/useCodeBlock.ts`:
```typescript
import { onMounted, ref, type Ref } from "vue";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";

hljs.registerLanguage("typescript", typescript);

export function useCodeBlock(code: string | Ref<string>) {
    const highlighted = ref("");

    function highlight(raw: string): void {
        highlighted.value = hljs.highlight(raw.trim(), { language: "typescript" }).value;
    }

    const raw = typeof code === "string" ? code : code.value;
    onMounted(() => highlight(raw));

    return { highlighted };
}
```

- [ ] **Step 4: Create DemoWrapper.vue**

`packages/playground/src/shared/components/DemoWrapper.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useCodeBlock } from "../composables/useCodeBlock";

const props = defineProps<{
    title: string;
    description?: string;
    code?: string;
}>();

const showCode = ref(false);
const { highlighted } = useCodeBlock(props.code ?? "");
</script>

<template>
    <div class="demo-wrapper">
        <div class="demo-wrapper__header">
            <div>
                <h2 class="demo-wrapper__title">{{ title }}</h2>
                <p v-if="description" class="demo-wrapper__description">{{ description }}</p>
            </div>
            <button v-if="code" class="demo-wrapper__code-btn" :class="{ active: showCode }" @click="showCode = !showCode">
                &lt;/&gt; Code
            </button>
        </div>
        <div class="demo-wrapper__content"><slot /></div>
        <div v-if="showCode && code" class="demo-wrapper__code">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <pre><code class="hljs" v-html="highlighted" /></pre>
        </div>
    </div>
</template>

<style scoped>
.demo-wrapper { background: var(--ui-surface); border: 1px solid var(--ui-border-subtle); border-radius: var(--ui-radius-lg); overflow: hidden; max-width: 800px; }
.demo-wrapper__header { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 24px 16px; border-bottom: 1px solid var(--ui-border-subtle); }
.demo-wrapper__title { margin: 0 0 4px; font-size: 16px; font-weight: 600; color: var(--ui-foreground); }
.demo-wrapper__description { margin: 0; font-size: 13px; color: var(--ui-foreground-muted); }
.demo-wrapper__code-btn { flex-shrink: 0; padding: 6px 12px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-md); background: transparent; color: var(--ui-foreground-secondary); font-size: 12px; cursor: pointer; font-family: inherit; }
.demo-wrapper__code-btn.active { background: var(--ui-primary-subtle); color: var(--ui-primary); border-color: var(--ui-primary-muted); }
.demo-wrapper__content { padding: 24px; }
.demo-wrapper__code { border-top: 1px solid var(--ui-border-subtle); background: var(--ui-surface-sunken); }
.demo-wrapper__code pre { margin: 0; padding: 20px 24px; overflow-x: auto; font-size: 13px; line-height: 1.6; }
</style>
```

- [ ] **Step 5: Verify dev server**

```bash
pnpm --filter playground dev
```

Open http://localhost:5174. Expected: sidebar renders with 9 groups, navigation works, no console errors.

- [ ] **Step 6: Commit**

```bash
git add libs/
git commit -m "feat: add playground shared layer (axios, DemoWrapper, useCodeBlock)"
```


## Part 3 — Core and Batch demos

---

### Task 7: Core feature demos (5 pages)

**Files:**
- Create: `src/pages/core/BasicFetchPage.vue` (and 4 more)
- Create: `src/features/core/BasicFetch.vue` (and 4 more)

**Page pattern (identical for all 28 pages):**
```vue
<!-- Example: src/pages/core/BasicFetchPage.vue -->
<script setup lang="ts">
import BasicFetch from "@/features/core/BasicFetch.vue";
</script>
<template><BasicFetch /></template>
```

- [ ] **Step 1: Create all 5 Core page wrappers**

Create each file with its corresponding feature import (same pattern shown above):
- `src/pages/core/BasicFetchPage.vue` → imports `BasicFetch`
- `src/pages/core/DynamicUrlPage.vue` → imports `DynamicUrl`
- `src/pages/core/LazyPage.vue` → imports `Lazy`
- `src/pages/core/DebouncePage.vue` → imports `Debounce`
- `src/pages/core/SelectTransformPage.vue` → imports `SelectTransform`

- [ ] **Step 2: Create BasicFetch.vue**

`src/features/core/BasicFetch.vue`:
```vue
<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string; email: string }

const { data, loading, error, execute } = useApi<User[]>("/users", { immediate: true });

const code = `const { data, loading, error, execute } = useApi<User[]>('/users', {
  immediate: true,
})`;
</script>

<template>
    <DemoWrapper title="Basic Fetch" description="Fetch data on mount with reactive loading and error state." :code="code">
        <div v-if="loading" style="color: var(--ui-foreground-muted)">Loading...</div>
        <div v-else-if="error" style="color: var(--ui-danger)">{{ error.message }}</div>
        <ul v-else style="margin: 0; padding: 0 0 0 16px;">
            <li v-for="user in data" :key="user.id">{{ user.name }} — {{ user.email }}</li>
        </ul>
        <button style="margin-top: 16px; padding: 8px 16px; cursor: pointer;" @click="execute()">Refetch</button>
    </DemoWrapper>
</template>
```

- [ ] **Step 3: Create DynamicUrl.vue**

`src/features/core/DynamicUrl.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string; email: string }

const userId = ref(1);
const { data, loading } = useApi<User>(() => `/users/${userId.value}`, { immediate: true });

const code = `const userId = ref(1)
const { data, loading } = useApi<User>(() => \`/users/\${userId.value}\`, {
  immediate: true,
})
// changing userId.value auto-triggers a new request`;
</script>

<template>
    <DemoWrapper title="Dynamic URL" description="Reactive URL — changing userId triggers a new request automatically." :code="code">
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button v-for="id in [1, 2, 3]" :key="id" @click="userId = id"
                :style="{ padding: '6px 14px', cursor: 'pointer', fontWeight: userId === id ? 700 : 400 }">
                User {{ id }}
            </button>
        </div>
        <div v-if="loading">Loading...</div>
        <div v-else-if="data">{{ data.name }} — {{ data.email }}</div>
    </DemoWrapper>
</template>
```

- [ ] **Step 4: Create Lazy.vue**

`src/features/core/Lazy.vue`:
```vue
<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string }

const { data, loading, execute } = useApi<User[]>("/users", { lazy: true });

const code = `const { data, loading, execute } = useApi<User[]>('/users', {
  lazy: true, // no auto-fetch, no reactive tracking
})
// call execute() manually when needed`;
</script>

<template>
    <DemoWrapper title="Lazy Mode" description="lazy: true disables auto-tracking. Fetch only when execute() is called." :code="code">
        <div v-if="!data && !loading" style="color: var(--ui-foreground-muted)">No data yet — click Fetch.</div>
        <div v-if="loading">Loading...</div>
        <div v-if="data">Loaded {{ data.length }} users.</div>
        <button style="margin-top: 12px; padding: 8px 16px; cursor: pointer;" @click="execute()">Fetch</button>
    </DemoWrapper>
</template>
```

- [ ] **Step 5: Create Debounce.vue**

`src/features/core/Debounce.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string; email: string }

const search = ref("");
const { data, loading } = useApi<User[]>(
    () => search.value ? `/users?search=${search.value}` : "/users",
    { immediate: true, debounce: 500 },
);

const code = `const search = ref('')
const { data, loading } = useApi<User[]>(
  () => search.value ? \`/users?search=\${search.value}\` : '/users',
  { immediate: true, debounce: 500 },
)`;
</script>

<template>
    <DemoWrapper title="Debounce" description="debounce: 500 waits 500ms after the last change before firing the request." :code="code">
        <input v-model="search" placeholder="Search users..." style="width: 100%; padding: 8px; box-sizing: border-box; margin-bottom: 12px;" />
        <div v-if="loading" style="color: var(--ui-foreground-muted)">Searching...</div>
        <ul v-else style="margin: 0; padding: 0 0 0 16px;">
            <li v-for="user in data" :key="user.id">{{ user.name }}</li>
        </ul>
    </DemoWrapper>
</template>
```

- [ ] **Step 6: Create SelectTransform.vue**

`src/features/core/SelectTransform.vue`:
```vue
<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string; email: string }

const { data } = useApi<User[], unknown, string[]>(
    "/users",
    { immediate: true, select: (users) => users.map((u) => u.name) },
);

const code = `const { data } = useApi<User[], unknown, string[]>(
  '/users',
  {
    immediate: true,
    select: (users) => users.map((u) => u.name),
  },
)
// data is string[], not User[]`;
</script>

<template>
    <DemoWrapper title="Select Transform" description="select transforms the raw response before storing it. data is typed as the output of select." :code="code">
        <p style="color: var(--ui-foreground-muted); font-size: 13px;">data type: string[] (names only)</p>
        <ul style="margin: 0; padding: 0 0 0 16px;">
            <li v-for="name in data" :key="name">{{ name }}</li>
        </ul>
    </DemoWrapper>
</template>
```

- [ ] **Step 7: Verify Core demos in browser**

```bash
pnpm --filter playground dev
```

Navigate to http://localhost:5174/core/basic through /core/select. Each demo should show live data, loading states, and work correctly. Click "Show Code" on each — snippet appears below.

- [ ] **Step 8: Commit**

```bash
git add libs/
git commit -m "feat: add Core demo pages (basic, dynamic-url, lazy, debounce, select)"
```

---

### Task 8: Batch feature demos (4 pages)

**Files:**
- Create: `src/pages/batch/*.vue` (4 thin wrappers)
- Create: `src/features/batch/*.vue` (4 demos)

- [ ] **Step 1: Create 4 Batch page wrappers**

Same thin-wrapper pattern:
- `src/pages/batch/BasicBatchPage.vue` → imports `BasicBatch`
- `src/pages/batch/ConcurrencyPage.vue` → imports `Concurrency`
- `src/pages/batch/SettledErrorsPage.vue` → imports `SettledErrors`
- `src/pages/batch/ReactiveBatchPage.vue` → imports `ReactiveBatch`

- [ ] **Step 2: Create BasicBatch.vue**

`src/features/batch/BasicBatch.vue`:
```vue
<script setup lang="ts">
import { useApiBatch } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const { data, loading, progress, execute } = useApiBatch(
    ["/users/1", "/users/2", "/users/3", "/users/4", "/users/5"],
    { immediate: true },
);

const code = `const { data, loading, progress } = useApiBatch(
  ['/users/1', '/users/2', '/users/3', '/users/4', '/users/5'],
  { immediate: true },
)`;
</script>

<template>
    <DemoWrapper title="Basic Batch" description="Execute 5 requests in parallel. progress tracks completed / total." :code="code">
        <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                <span>{{ progress.completed }} / {{ progress.total }}</span>
                <span>{{ progress.percentage }}%</span>
            </div>
            <div style="height: 6px; background: var(--ui-border-subtle); border-radius: 3px;">
                <div :style="{ width: progress.percentage + '%', height: '100%', background: 'var(--ui-primary)', borderRadius: '3px', transition: 'width 0.3s' }" />
            </div>
        </div>
        <div v-if="loading" style="color: var(--ui-foreground-muted)">Loading...</div>
        <ul v-else style="margin: 0; padding: 0 0 0 16px;">
            <li v-for="item in data" :key="item.index">
                {{ item.success ? (item.data as { name: string }).name : `Error: ${item.error?.message}` }}
            </li>
        </ul>
        <button style="margin-top: 12px; padding: 8px 16px; cursor: pointer;" @click="execute()">Re-run</button>
    </DemoWrapper>
</template>
```

- [ ] **Step 3: Create Concurrency.vue**

`src/features/batch/Concurrency.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApiBatch } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const concurrency = ref(2);
const { loading, progress, execute } = useApiBatch(
    ["/users/1", "/users/2", "/users/3", "/users/4", "/users/5", "/users/6"],
    { immediate: false, concurrency },
);

const code = `const concurrency = ref(2)
const { progress, execute } = useApiBatch(urls, {
  concurrency, // reactive — change and re-run to see the difference
})`;
</script>

<template>
    <DemoWrapper title="Concurrency" description="Limit parallel requests. concurrency: 2 means at most 2 in-flight at once." :code="code">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <label>Concurrency:</label>
            <select v-model="concurrency" style="padding: 4px 8px;">
                <option :value="1">1</option>
                <option :value="2">2</option>
                <option :value="6">unlimited (6)</option>
            </select>
        </div>
        <div style="height: 6px; background: var(--ui-border-subtle); border-radius: 3px; margin-bottom: 12px;">
            <div :style="{ width: progress.percentage + '%', height: '100%', background: 'var(--ui-primary)', borderRadius: '3px', transition: 'width 0.2s' }" />
        </div>
        <div style="font-size: 13px; color: var(--ui-foreground-muted);">{{ progress.completed }} / {{ progress.total }} complete</div>
        <button style="margin-top: 12px; padding: 8px 16px; cursor: pointer;" :disabled="loading" @click="execute()">
            {{ loading ? 'Running...' : 'Run Batch' }}
        </button>
    </DemoWrapper>
</template>
```

- [ ] **Step 4: Create SettledErrors.vue**

`src/features/batch/SettledErrors.vue`:
```vue
<script setup lang="ts">
import { useApiBatch } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const { data, loading, execute } = useApiBatch(
    ["/users/1", "/users/999", "/users/2", "/users/998"],
    { immediate: true, settled: true, skipErrorNotification: true },
);

const code = `const { data } = useApiBatch(
  ['/users/1', '/users/999', '/users/2', '/users/998'],
  { settled: true }, // failed requests don't stop the batch
)`;
</script>

<template>
    <DemoWrapper title="Settled Errors" description="settled: true — failed requests are collected, not thrown. Batch always completes." :code="code">
        <div v-if="loading">Loading...</div>
        <div v-else style="display: flex; flex-direction: column; gap: 6px;">
            <div v-for="item in data" :key="item.index"
                :style="{ padding: '8px 12px', borderRadius: '6px', fontSize: '13px', background: item.success ? 'var(--ui-success-subtle)' : 'var(--ui-danger-subtle)', color: item.success ? 'var(--ui-success)' : 'var(--ui-danger)' }">
                {{ item.url }}: {{ item.success ? 'OK' : item.error?.message }}
            </div>
        </div>
        <button style="margin-top: 12px; padding: 8px 16px; cursor: pointer;" @click="execute()">Re-run</button>
    </DemoWrapper>
</template>
```

- [ ] **Step 5: Create ReactiveBatch.vue**

`src/features/batch/ReactiveBatch.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApiBatch } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const count = ref(3);
const { data, loading } = useApiBatch(
    () => Array.from({ length: count.value }, (_, i) => `/users/${i + 1}`),
    { immediate: true },
);

const code = `const count = ref(3)
const { data } = useApiBatch(
  () => Array.from({ length: count.value }, (_, i) => \`/users/\${i + 1}\`),
  { immediate: true },
)
// changing count auto-re-executes the batch`;
</script>

<template>
    <DemoWrapper title="Reactive Getter" description="Pass a getter function — batch re-executes automatically when its deps change." :code="code">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <label>User count:</label>
            <button v-for="n in [1, 3, 5]" :key="n" @click="count = n"
                :style="{ padding: '4px 12px', cursor: 'pointer', fontWeight: count === n ? 700 : 400 }">{{ n }}</button>
        </div>
        <div v-if="loading">Fetching {{ count }} users...</div>
        <ul v-else style="margin: 0; padding: 0 0 0 16px;">
            <li v-for="item in data" :key="item.index">{{ (item.data as { name: string })?.name }}</li>
        </ul>
    </DemoWrapper>
</template>
```

- [ ] **Step 6: Verify Batch demos**

Navigate to http://localhost:5174/batch/basic through /batch/reactive. All 4 demos should show live data and interactions.

- [ ] **Step 7: Commit**

```bash
git add libs/
git commit -m "feat: add Batch demo pages (basic, concurrency, settled, reactive)"
```

---

### Task 9: Cache feature demos (3 pages)

**Files:**
- Create: `src/pages/cache/*.vue` (3 thin wrappers)
- Create: `src/features/cache/*.vue` (3 demos)

- [ ] **Step 1: Create 3 Cache page wrappers**

- `src/pages/cache/TtlCachePage.vue` → imports `TtlCache`
- `src/pages/cache/SwrPage.vue` → imports `Swr`
- `src/pages/cache/InvalidationPage.vue` → imports `Invalidation`

- [ ] **Step 2: Create TtlCache.vue**

`src/features/cache/TtlCache.vue`:
```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useApi, invalidateCache } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string }

const STALE_TIME = 15_000;
const source = ref<"network" | "cache">("network");
const requestCount = ref(0);
const ttlRemaining = ref(0);
let ttlTimer: ReturnType<typeof setInterval>;

const { data, execute } = useApi<User[]>("/users", {
    immediate: true,
    cache: { id: "demo-ttl", staleTime: STALE_TIME },
    onSuccess: () => { requestCount.value++; },
});

function onCacheHit() { source.value = "cache"; }
function onNetworkHit() { source.value = "network"; ttlRemaining.value = STALE_TIME / 1000; }

onMounted(() => {
    ttlTimer = setInterval(() => { ttlRemaining.value = Math.max(0, ttlRemaining.value - 1); }, 1000);
});
onUnmounted(() => clearInterval(ttlTimer));

const code = `const { data } = useApi<User[]>('/users', {
  immediate: true,
  cache: { id: 'demo-ttl', staleTime: 15_000 },
})`;
</script>

<template>
    <DemoWrapper title="TTL Cache" description="Cache hit returns data instantly without a network request. Expires after 15s." :code="code">
        <div style="display: flex; gap: 16px; margin-bottom: 16px; font-size: 13px;">
            <span>Source: <strong>{{ source }}</strong></span>
            <span>Requests: <strong>{{ requestCount }}</strong></span>
            <span>TTL: <strong>{{ ttlRemaining }}s</strong></span>
        </div>
        <div v-if="data">{{ data.length }} users cached.</div>
        <div style="display: flex; gap: 8px; margin-top: 12px;">
            <button style="padding: 8px 16px; cursor: pointer;" @click="execute()">Fetch (uses cache if valid)</button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="invalidateCache('demo-ttl')">Invalidate Cache</button>
        </div>
    </DemoWrapper>
</template>
```

- [ ] **Step 3: Create Swr.vue**

`src/features/cache/Swr.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string }

const lastUpdated = ref<string | null>(null);
const { data, revalidating, execute } = useApi<User[]>("/users", {
    immediate: true,
    cache: { id: "demo-swr", staleTime: 10_000, swr: true },
    onSuccess: () => { lastUpdated.value = new Date().toLocaleTimeString(); },
});

const code = `const { data, revalidating } = useApi<User[]>('/users', {
  immediate: true,
  cache: { id: 'demo-swr', staleTime: 10_000, swr: true },
})
// data shows instantly from cache, revalidating: true while fetching fresh`;
</script>

<template>
    <DemoWrapper title="SWR" description="Stale-While-Revalidate: show cached data immediately, fetch fresh in background." :code="code">
        <div style="display: flex; gap: 16px; margin-bottom: 16px; font-size: 13px;">
            <span>Revalidating: <strong>{{ revalidating }}</strong></span>
            <span v-if="lastUpdated">Last updated: <strong>{{ lastUpdated }}</strong></span>
        </div>
        <div v-if="data">{{ data.length }} users. Data shows instantly from cache on second load.</div>
        <button style="margin-top: 12px; padding: 8px 16px; cursor: pointer;" @click="execute()">Refetch</button>
    </DemoWrapper>
</template>
```

- [ ] **Step 4: Create Invalidation.vue**

`src/features/cache/Invalidation.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApi, invalidateCache, clearAllCache } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string }

const log = ref<string[]>([]);
const { data, execute: fetchA } = useApi<User[]>("/users", {
    immediate: true,
    cache: { id: "inv-users", staleTime: 60_000 },
    onSuccess: () => log.value.unshift(`[${new Date().toLocaleTimeString()}] /users fetched from network`),
});

const { execute: fetchB } = useApi<User>("/users/1", {
    immediate: true,
    cache: { id: "inv-user-1", staleTime: 60_000 },
    onSuccess: () => log.value.unshift(`[${new Date().toLocaleTimeString()}] /users/1 fetched from network`),
});

const code = `// Invalidate specific cache entries
invalidateCache('inv-users')       // bust one
invalidateCache(['inv-users', 'inv-user-1']) // bust many
clearAllCache()                    // wipe everything`;
</script>

<template>
    <DemoWrapper title="Cache Invalidation" description="invalidateCache busts specific entries. clearAllCache wipes everything." :code="code">
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
            <button style="padding: 6px 14px; cursor: pointer;" @click="fetchA()">Fetch /users</button>
            <button style="padding: 6px 14px; cursor: pointer;" @click="fetchB()">Fetch /users/1</button>
            <button style="padding: 6px 14px; cursor: pointer;" @click="invalidateCache('inv-users')">Bust /users cache</button>
            <button style="padding: 6px 14px; cursor: pointer;" @click="clearAllCache()">Clear All Cache</button>
        </div>
        <div style="font-size: 12px; max-height: 120px; overflow-y: auto; background: var(--ui-surface-sunken); padding: 8px; border-radius: 6px;">
            <div v-for="(entry, i) in log" :key="i">{{ entry }}</div>
            <div v-if="!log.length" style="color: var(--ui-foreground-muted)">Activity log...</div>
        </div>
    </DemoWrapper>
</template>
```

- [ ] **Step 5: Verify Cache demos**

Navigate to http://localhost:5174/cache/ttl, /cache/swr, /cache/invalidation. Reload pages to verify cache hits (request count stays 1 on reload within TTL).

- [ ] **Step 6: Commit**

```bash
git add libs/
git commit -m "feat: add Cache demo pages (ttl, swr, invalidation)"
```


## Part 4 — Polling, Triggers, Retry, Auth demos

---

### Task 10: Polling feature demos (3 pages)

**Files:**
- Create: `src/pages/polling/*.vue` (3 thin wrappers)
- Create: `src/features/polling/*.vue` (3 demos)

- [ ] **Step 1: Create 3 Polling page wrappers**

- `src/pages/polling/BasicPollingPage.vue` → imports `BasicPolling`
- `src/pages/polling/WhenHiddenPage.vue` → imports `WhenHidden`
- `src/pages/polling/DynamicIntervalPage.vue` → imports `DynamicInterval`

- [ ] **Step 2: Create BasicPolling.vue**

`src/features/polling/BasicPolling.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const requestCount = ref(0);
const lastFetched = ref<string | null>(null);
const { data, loading, abort } = useApi<{ time: string }>("/time", {
    immediate: true,
    poll: 3000,
    onSuccess: () => {
        requestCount.value++;
        lastFetched.value = new Date().toLocaleTimeString();
    },
});

const code = `const { data, loading, abort } = useApi('/time', {
  immediate: true,
  poll: 3000, // re-fetch every 3 seconds
})`;
</script>

<template>
    <DemoWrapper title="Basic Polling" description="poll: 3000 re-fetches every 3 seconds automatically after each response." :code="code">
        <div style="display: flex; gap: 24px; font-size: 13px; margin-bottom: 12px;">
            <span>Requests: <strong>{{ requestCount }}</strong></span>
            <span>Last: <strong>{{ lastFetched ?? '—' }}</strong></span>
            <span>Loading: <strong>{{ loading }}</strong></span>
        </div>
        <button style="padding: 8px 16px; cursor: pointer;" @click="abort()">Stop Polling</button>
    </DemoWrapper>
</template>
```

- [ ] **Step 3: Create WhenHidden.vue**

`src/features/polling/WhenHidden.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const pollWhenHidden = ref(false);
const requestCount = ref(0);
useApi("/users/1", {
    immediate: true,
    poll: { interval: 2000, whenHidden: pollWhenHidden },
    onSuccess: () => requestCount.value++,
});

const code = `const pollWhenHidden = ref(false)
useApi('/users/1', {
  poll: { interval: 2000, whenHidden: pollWhenHidden },
})
// whenHidden: false → polling pauses when browser tab is hidden`;
</script>

<template>
    <DemoWrapper title="When Hidden" description="whenHidden: false pauses polling when the browser tab loses focus." :code="code">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <label>
                <input type="checkbox" v-model="pollWhenHidden" />
                Poll when tab hidden
            </label>
        </div>
        <p style="font-size: 13px; color: var(--ui-foreground-muted);">Switch to another tab and watch the request count.</p>
        <div style="font-size: 13px;">Requests: <strong>{{ requestCount }}</strong></div>
    </DemoWrapper>
</template>
```

- [ ] **Step 4: Create DynamicInterval.vue**

`src/features/polling/DynamicInterval.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const interval = ref(3000);
const requestCount = ref(0);
useApi("/users/1", {
    immediate: true,
    poll: interval,
    onSuccess: () => requestCount.value++,
});

const code = `const interval = ref(3000)
useApi('/users/1', {
  poll: interval, // reactive — change and polling restarts with new interval
})`;
</script>

<template>
    <DemoWrapper title="Dynamic Interval" description="poll accepts a ref — change the value to restart polling at the new interval." :code="code">
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button v-for="ms in [1000, 3000, 5000, 0]" :key="ms"
                @click="interval = ms"
                :style="{ padding: '6px 14px', cursor: 'pointer', fontWeight: interval === ms ? 700 : 400 }">
                {{ ms === 0 ? 'Off' : ms + 'ms' }}
            </button>
        </div>
        <div style="font-size: 13px;">Requests: <strong>{{ requestCount }}</strong></div>
    </DemoWrapper>
</template>
```

- [ ] **Step 5: Commit**

```bash
git add libs/
git commit -m "feat: add Polling demo pages (basic, when-hidden, dynamic-interval)"
```

---

### Task 11: Triggers and Retry demos (4 pages)

**Files:**
- Create: `src/pages/triggers/*.vue`, `src/features/triggers/*.vue`
- Create: `src/pages/retry/*.vue`, `src/features/retry/*.vue`

- [ ] **Step 1: Create Triggers page wrappers**

- `src/pages/triggers/RefetchOnFocusPage.vue` → imports `RefetchOnFocus`
- `src/pages/triggers/RefetchOnReconnectPage.vue` → imports `RefetchOnReconnect`

- [ ] **Step 2: Create RefetchOnFocus.vue**

`src/features/triggers/RefetchOnFocus.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const refetchCount = ref(0);
useApi("/users/1", {
    immediate: true,
    refetchOnFocus: { throttle: 5000 },
    onSuccess: () => refetchCount.value++,
});

const code = `useApi('/users/1', {
  refetchOnFocus: { throttle: 5000 },
  // throttle: 5000 — won't refetch again within 5s of last fetch
})`;
</script>

<template>
    <DemoWrapper title="Refetch on Focus" description="Refetches when the browser tab regains focus. throttle: 5000 prevents rapid re-triggers." :code="code">
        <p style="font-size: 13px; color: var(--ui-foreground-muted);">Switch to another tab, wait a moment, then come back.</p>
        <div style="font-size: 13px;">Refetch count: <strong>{{ refetchCount }}</strong></div>
    </DemoWrapper>
</template>
```

- [ ] **Step 3: Create RefetchOnReconnect.vue**

`src/features/triggers/RefetchOnReconnect.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const refetchCount = ref(0);
useApi("/users/1", {
    immediate: true,
    refetchOnReconnect: true,
    onSuccess: () => refetchCount.value++,
});

const code = `useApi('/users/1', {
  refetchOnReconnect: true,
  // fires on browser 'online' event — no throttle, reconnect is already rare
})`;
</script>

<template>
    <DemoWrapper title="Refetch on Reconnect" description="Refetches when the browser regains network connectivity." :code="code">
        <p style="font-size: 13px; color: var(--ui-foreground-muted);">
            Use browser DevTools → Network → throttle to "Offline", then back to "Online".
        </p>
        <div style="font-size: 13px;">Reconnect refetches: <strong>{{ refetchCount }}</strong></div>
    </DemoWrapper>
</template>
```

- [ ] **Step 4: Create Retry page wrappers**

- `src/pages/retry/AutoRetryPage.vue` → imports `AutoRetry`
- `src/pages/retry/CustomStatusCodesPage.vue` → imports `CustomStatusCodes`

- [ ] **Step 5: Create AutoRetry.vue**

`src/features/retry/AutoRetry.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const attemptLog = ref<string[]>([]);
const { loading, error, execute } = useApi("/users/999", {
    retry: 3,
    retryDelay: 800,
    skipErrorNotification: true,
    onError: (err) => attemptLog.value.unshift(`[${new Date().toLocaleTimeString()}] ${err.message}`),
});

const code = `const { loading, error } = useApi('/users/999', {
  retry: 3,        // up to 3 retries
  retryDelay: 800, // 800ms between attempts
})`;
</script>

<template>
    <DemoWrapper title="Auto Retry" description="retry: 3 retries failed requests up to 3 times before surfacing the error." :code="code">
        <button style="padding: 8px 16px; cursor: pointer; margin-bottom: 12px;" :disabled="loading" @click="execute()">
            {{ loading ? 'Retrying...' : 'Trigger Request (404 endpoint)' }}
        </button>
        <div v-if="error" style="color: var(--ui-danger); font-size: 13px; margin-bottom: 8px;">Final error: {{ error.message }}</div>
        <div style="font-size: 12px; max-height: 100px; overflow-y: auto; background: var(--ui-surface-sunken); padding: 8px; border-radius: 6px;">
            <div v-for="(entry, i) in attemptLog" :key="i">{{ entry }}</div>
            <div v-if="!attemptLog.length" style="color: var(--ui-foreground-muted)">Click to trigger...</div>
        </div>
    </DemoWrapper>
</template>
```

- [ ] **Step 6: Create CustomStatusCodes.vue**

`src/features/retry/CustomStatusCodes.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const log = ref<string[]>([]);
const { loading, execute } = useApi("/users/999", {
    retry: 2,
    retryDelay: 500,
    retryStatusCodes: [404, 500],
    skipErrorNotification: true,
    onError: (err) => log.value.unshift(`[${new Date().toLocaleTimeString()}] status ${err.status}: ${err.message}`),
});

const code = `useApi('/users/999', {
  retry: 2,
  retryStatusCodes: [404, 500], // only retry on these specific codes
  // default: [408, 429, 500, 502, 503, 504]
})`;
</script>

<template>
    <DemoWrapper title="Custom Status Codes" description="retryStatusCodes controls which HTTP status codes trigger a retry." :code="code">
        <button style="padding: 8px 16px; cursor: pointer; margin-bottom: 12px;" :disabled="loading" @click="execute()">
            {{ loading ? 'Retrying...' : 'Trigger (retries on 404)' }}
        </button>
        <div style="font-size: 12px; max-height: 100px; overflow-y: auto; background: var(--ui-surface-sunken); padding: 8px; border-radius: 6px;">
            <div v-for="(entry, i) in log" :key="i">{{ entry }}</div>
            <div v-if="!log.length" style="color: var(--ui-foreground-muted)">Click to trigger...</div>
        </div>
    </DemoWrapper>
</template>
```

- [ ] **Step 7: Commit**

```bash
git add libs/
git commit -m "feat: add Triggers and Retry demo pages"
```

---

### Task 12: Auth feature demos (3 pages)

**Files:**
- Create: `src/features/auth/store/useAuthDemoStore.ts`
- Create: `src/pages/auth/*.vue` (3 thin wrappers)
- Create: `src/features/auth/*.vue` (3 demos)

- [ ] **Step 1: Create 3 Auth page wrappers**

- `src/pages/auth/LoginPage.vue` → imports `Login`
- `src/pages/auth/TokenRefreshPage.vue` → imports `TokenRefresh`
- `src/pages/auth/AuthModesPage.vue` → imports `AuthModes`

- [ ] **Step 2: Create useAuthDemoStore.ts**

`src/features/auth/store/useAuthDemoStore.ts`:
```typescript
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { tokenManager } from "@ametie/vue-muza-use";

export const useAuthDemoStore = defineStore("auth-demo", () => {
    const isAuthenticated = ref(!!tokenManager.getAccessToken());

    function onLogin(): void {
        isAuthenticated.value = true;
    }

    function logout(): void {
        tokenManager.clearTokens();
        isAuthenticated.value = false;
    }

    return { isAuthenticated: computed(() => isAuthenticated.value), onLogin, logout };
});
```

- [ ] **Step 3: Create Login.vue**

`src/features/auth/Login.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApiPost, tokenManager } from "@ametie/vue-muza-use";
import { useAuthDemoStore } from "./store/useAuthDemoStore";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface LoginResponse { accessToken: string; refreshToken?: string }

const auth = useAuthDemoStore();
const email = ref(import.meta.env.VITE_AUTH_EMAIL as string ?? "");
const password = ref(import.meta.env.VITE_AUTH_PASSWORD as string ?? "");

const { loading, error, execute: login } = useApiPost<LoginResponse>("/auth/login", {
    onSuccess: ({ data }) => {
        tokenManager.setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        auth.onLogin();
    },
    skipErrorNotification: true,
});

const code = `const { loading, execute: login } = useApiPost('/auth/login', {
  onSuccess: ({ data }) => {
    tokenManager.setTokens({ accessToken: data.accessToken })
  },
})
login({ data: { email, password } })`;
</script>

<template>
    <DemoWrapper title="Login / Logout" description="Authenticate with the live backend. Credentials pre-filled from .env." :code="code">
        <div v-if="!auth.isAuthenticated" style="display: flex; flex-direction: column; gap: 12px; max-width: 320px;">
            <div v-if="error" style="color: var(--ui-danger); font-size: 13px;">{{ error.message }}</div>
            <input v-model="email" type="email" placeholder="Email" style="padding: 8px; border: 1px solid var(--ui-border); border-radius: 6px;" />
            <input v-model="password" type="password" placeholder="Password" style="padding: 8px; border: 1px solid var(--ui-border); border-radius: 6px;" />
            <button :disabled="loading" style="padding: 10px; cursor: pointer;" @click="login({ data: { email, password } })">
                {{ loading ? 'Logging in...' : 'Login' }}
            </button>
        </div>
        <div v-else>
            <p style="color: var(--ui-success);">Authenticated ✓</p>
            <button style="padding: 8px 16px; cursor: pointer;" @click="auth.logout()">Logout</button>
        </div>
    </DemoWrapper>
</template>
```

- [ ] **Step 4: Create TokenRefresh.vue**

`src/features/auth/TokenRefresh.vue`:
```vue
<script setup lang="ts">
import { useApi, tokenManager } from "@ametie/vue-muza-use";
import { useAuthDemoStore } from "./store/useAuthDemoStore";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const auth = useAuthDemoStore();
const { data, loading, execute } = useApi("/users/me", { skipErrorNotification: true });

const code = `// createApiClient handles 401 → token refresh automatically
// When /users/me returns 401, the interceptor:
// 1. Calls POST /auth/refresh with the refreshToken
// 2. Updates tokens via tokenManager.setTokens()
// 3. Retries the original request with the new accessToken`;
</script>

<template>
    <DemoWrapper title="Token Refresh" description="The axios interceptor transparently refreshes the access token on 401 and retries the request." :code="code">
        <div v-if="!auth.isAuthenticated" style="color: var(--ui-foreground-muted); font-size: 13px;">
            Log in first via Auth → Login / Logout.
        </div>
        <div v-else>
            <div style="font-size: 13px; margin-bottom: 12px;">
                Token: <code style="font-size: 11px;">{{ tokenManager.getAccessToken()?.slice(0, 30) }}...</code>
            </div>
            <div v-if="loading">Fetching protected endpoint...</div>
            <div v-else-if="data">Response: {{ JSON.stringify(data).slice(0, 100) }}</div>
            <button style="margin-top: 12px; padding: 8px 16px; cursor: pointer;" @click="execute()">Call /users/me</button>
        </div>
    </DemoWrapper>
</template>
```

- [ ] **Step 5: Create AuthModes.vue**

`src/features/auth/AuthModes.vue`:
```vue
<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const { data: publicData, execute: fetchPublic } = useApi("/users", { authMode: "public", skipErrorNotification: true });
const { data: optionalData, execute: fetchOptional } = useApi("/users/1", { authMode: "optional", skipErrorNotification: true });
const { data: defaultData, execute: fetchDefault } = useApi("/users/me", { authMode: "default", skipErrorNotification: true });

const code = `// authMode controls whether Authorization header is attached
useApi('/public-endpoint',  { authMode: 'public' })   // never sends token
useApi('/optional-endpoint',{ authMode: 'optional' })  // sends token if present
useApi('/protected',        { authMode: 'default' })   // always requires token`;
</script>

<template>
    <DemoWrapper title="Auth Modes" description="authMode controls whether the Authorization header is attached to the request." :code="code">
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="padding: 12px; border: 1px solid var(--ui-border-subtle); border-radius: 6px;">
                <strong>public</strong> — no token sent
                <button style="margin-left: 12px; padding: 4px 12px; cursor: pointer;" @click="fetchPublic()">Test</button>
                <div v-if="publicData" style="font-size: 12px; color: var(--ui-success);">OK</div>
            </div>
            <div style="padding: 12px; border: 1px solid var(--ui-border-subtle); border-radius: 6px;">
                <strong>optional</strong> — token sent if available
                <button style="margin-left: 12px; padding: 4px 12px; cursor: pointer;" @click="fetchOptional()">Test</button>
                <div v-if="optionalData" style="font-size: 12px; color: var(--ui-success);">OK</div>
            </div>
            <div style="padding: 12px; border: 1px solid var(--ui-border-subtle); border-radius: 6px;">
                <strong>default</strong> — token required (401 if missing)
                <button style="margin-left: 12px; padding: 4px 12px; cursor: pointer;" @click="fetchDefault()">Test</button>
                <div v-if="defaultData" style="font-size: 12px; color: var(--ui-success);">OK</div>
            </div>
        </div>
    </DemoWrapper>
</template>
```

- [ ] **Step 6: Commit**

```bash
git add libs/
git commit -m "feat: add Auth demo pages (login, token-refresh, auth-modes)"
```


## Part 5 — State demos, Devtools scenarios, and final verification

---

### Task 13: State feature demos (3 pages)

**Files:**
- Create: `src/pages/state/*.vue` (3 thin wrappers)
- Create: `src/features/state/*.vue` (3 demos)

- [ ] **Step 1: Create 3 State page wrappers**

- `src/pages/state/MutatePage.vue` → imports `Mutate`
- `src/pages/state/ResetPage.vue` → imports `Reset`
- `src/pages/state/IgnoreUpdatesPage.vue` → imports `IgnoreUpdates`

- [ ] **Step 2: Create Mutate.vue**

`src/features/state/Mutate.vue`:
```vue
<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string; email: string }

const { data, mutate, execute } = useApi<User[]>("/users", { immediate: true });

function addFakeUser(): void {
    mutate((prev) => [...(prev ?? []), { id: 999, name: "Fake User", email: "fake@example.com" }]);
}

function clearData(): void {
    mutate(null);
}

const code = `const { data, mutate } = useApi<User[]>('/users', { immediate: true })

// Direct value
mutate([...data.value, newUser])

// Updater function (like setState)
mutate((prev) => [...(prev ?? []), newUser])`;
</script>

<template>
    <DemoWrapper title="Mutate" description="mutate() updates data without a network request. Supports direct value or updater function." :code="code">
        <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
            <button style="padding: 8px 16px; cursor: pointer;" @click="execute()">Fetch</button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="addFakeUser()">Add Fake User (mutate)</button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="clearData()">Clear (mutate null)</button>
        </div>
        <div style="font-size: 13px;">{{ data?.length ?? 0 }} users</div>
        <ul style="margin: 4px 0; padding: 0 0 0 16px; font-size: 13px;">
            <li v-for="user in data?.slice(0, 5)" :key="user.id">{{ user.name }}</li>
        </ul>
    </DemoWrapper>
</template>
```

- [ ] **Step 3: Create Reset.vue**

`src/features/state/Reset.vue`:
```vue
<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

interface User { id: number; name: string }

const { data, loading, error, execute, reset } = useApi<User[]>("/users", {
    immediate: false,
    initialData: [],
});

const code = `const { data, execute, reset } = useApi<User[]>('/users', {
  immediate: false,
  initialData: [], // data starts as [] not null
})
reset() // clears data, error, aborts in-flight request`;
</script>

<template>
    <DemoWrapper title="Reset" description="reset() returns state to initialData, clears error, and aborts any in-flight request." :code="code">
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button style="padding: 8px 16px; cursor: pointer;" @click="execute()">Fetch</button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="reset()">Reset</button>
        </div>
        <div style="font-size: 13px;">
            <div>loading: {{ loading }}</div>
            <div>data: {{ data?.length ?? 0 }} items</div>
            <div v-if="error" style="color: var(--ui-danger)">error: {{ error.message }}</div>
        </div>
    </DemoWrapper>
</template>
```

- [ ] **Step 4: Create IgnoreUpdates.vue**

`src/features/state/IgnoreUpdates.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const userId = ref(1);
const requestCount = ref(0);
const { data, ignoreUpdates } = useApi<{ id: number; name: string }>(
    () => `/users/${userId.value}`,
    { immediate: true, onSuccess: () => requestCount.value++ },
);

function changeSilently(): void {
    ignoreUpdates(() => { userId.value = Math.floor(Math.random() * 10) + 1; });
}

const code = `const { ignoreUpdates } = useApi(() => \`/users/\${userId.value}\`, {
  immediate: true,
})

// Change userId without triggering a re-fetch
ignoreUpdates(() => { userId.value = 5 })`;
</script>

<template>
    <DemoWrapper title="Ignore Updates" description="ignoreUpdates() lets you mutate reactive deps without triggering a re-fetch." :code="code">
        <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
            <button style="padding: 8px 16px; cursor: pointer;" @click="userId = Math.floor(Math.random() * 10) + 1">
                Change userId (triggers fetch)
            </button>
            <button style="padding: 8px 16px; cursor: pointer;" @click="changeSilently()">
                Change userId (ignoreUpdates — no fetch)
            </button>
        </div>
        <div style="font-size: 13px;">
            <div>userId: <strong>{{ userId }}</strong></div>
            <div>Requests: <strong>{{ requestCount }}</strong></div>
            <div v-if="data">data: {{ data.name }}</div>
        </div>
    </DemoWrapper>
</template>
```

- [ ] **Step 5: Commit**

```bash
git add libs/
git commit -m "feat: add State demo pages (mutate, reset, ignore-updates)"
```

---

### Task 14: Devtools testing scenarios (3 pages)

**Files:**
- Create: `src/pages/devtools/*.vue` (3 thin wrappers)
- Create: `src/features/devtools/*.vue` (3 scenarios)

- [ ] **Step 1: Create 3 Devtools page wrappers**

- `src/pages/devtools/KitchenSinkPage.vue` → imports `KitchenSink`
- `src/pages/devtools/StressTestPage.vue` → imports `StressTest`
- `src/pages/devtools/ErrorStatesPage.vue` → imports `ErrorStates`

- [ ] **Step 2: Create KitchenSink.vue**

`src/features/devtools/KitchenSink.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApi, useApiBatch } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

// 1. Polling instance
const { loading: pollingLoading } = useApi("/users/1", { immediate: true, poll: 3000 });

// 2. SWR cache instance
const { revalidating } = useApi("/users/2", { immediate: true, cache: { id: "ks-swr", staleTime: 10000, swr: true } });

// 3. Lazy instance (manual trigger)
const { execute: lazyFetch, data: lazyData } = useApi("/users/3", { lazy: true });

// 4. Error instance
const { error: err404 } = useApi("/users/99999", { immediate: true, skipErrorNotification: true });

// 5. Batch (5 requests)
const { loading: batchLoading, execute: runBatch } = useApiBatch(
    ["/users/1", "/users/2", "/users/3", "/users/4", "/users/5"],
    { immediate: true },
);

// 6. Debounce instance
const search = ref("");
const { loading: debounceLoading } = useApi(() => `/users?q=${search.value}`, { debounce: 400 });
</script>

<template>
    <DemoWrapper
        title="Kitchen Sink"
        description="8 useApi instances running simultaneously. Open the devtools panel to see Instances, Network, and Timeline all populated."
    >
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
            <div style="padding: 10px; background: var(--ui-surface-sunken); border-radius: 6px;">
                <strong>Polling (3s)</strong><br />loading: {{ pollingLoading }}
            </div>
            <div style="padding: 10px; background: var(--ui-surface-sunken); border-radius: 6px;">
                <strong>SWR Cache</strong><br />revalidating: {{ revalidating }}
            </div>
            <div style="padding: 10px; background: var(--ui-surface-sunken); border-radius: 6px;">
                <strong>Lazy</strong><br />
                <button style="margin-top: 4px; padding: 4px 10px; cursor: pointer;" @click="lazyFetch()">Fetch</button>
                <span v-if="lazyData"> ✓</span>
            </div>
            <div style="padding: 10px; background: var(--ui-surface-sunken); border-radius: 6px;">
                <strong>Error (404)</strong><br />
                <span style="color: var(--ui-danger);">{{ err404?.message ?? '...' }}</span>
            </div>
            <div style="padding: 10px; background: var(--ui-surface-sunken); border-radius: 6px;">
                <strong>Batch (5 urls)</strong><br />
                loading: {{ batchLoading }}
                <button style="margin-top: 4px; padding: 4px 10px; cursor: pointer;" @click="runBatch()">Re-run</button>
            </div>
            <div style="padding: 10px; background: var(--ui-surface-sunken); border-radius: 6px;">
                <strong>Debounce search</strong><br />
                <input v-model="search" placeholder="type..." style="width: 100%; padding: 4px; margin-top: 4px; box-sizing: border-box;" />
                <span v-if="debounceLoading"> searching...</span>
            </div>
        </div>
    </DemoWrapper>
</template>
```

- [ ] **Step 3: Create StressTest.vue**

`src/features/devtools/StressTest.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { useApiBatch } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const batchSize = ref(20);
const pollerCount = ref(0);
const activePollers = ref<ReturnType<typeof setInterval>[]>([]);

const { loading, progress, execute } = useApiBatch(
    () => Array.from({ length: batchSize.value }, (_, i) => `/users/${(i % 10) + 1}`),
    { immediate: false, concurrency: 5 },
);

function startPollers(): void {
    stopPollers();
    for (let i = 0; i < pollerCount.value; i++) {
        activePollers.value.push(setInterval(() => {
            fetch(import.meta.env.VITE_API_URL + `/users/${i + 1}`).catch(() => {});
        }, 1000 + i * 200));
    }
}

function stopPollers(): void {
    activePollers.value.forEach(clearInterval);
    activePollers.value = [];
}

const code = `// Fire 20 parallel requests at once — tests Timeline and Network tab scrolling
// 5 concurrent pollers — tests Timeline multi-track rendering`;
</script>

<template>
    <DemoWrapper title="Stress Test" description="Flood the devtools with requests. Tests Timeline performance, Network tab scrolling, circular buffer." :code="code">
        <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
            <div>
                <label>Batch size: </label>
                <select v-model="batchSize" style="padding: 4px 8px;">
                    <option :value="10">10</option>
                    <option :value="20">20</option>
                    <option :value="50">50</option>
                </select>
                <button style="margin-left: 8px; padding: 8px 16px; cursor: pointer;" :disabled="loading" @click="execute()">
                    Fire Batch
                </button>
            </div>
            <div>
                <label>Pollers: </label>
                <select v-model="pollerCount" style="padding: 4px 8px;">
                    <option :value="0">0</option>
                    <option :value="3">3</option>
                    <option :value="5">5</option>
                </select>
                <button style="margin-left: 8px; padding: 8px 16px; cursor: pointer;" @click="startPollers()">Start</button>
                <button style="margin-left: 4px; padding: 8px 16px; cursor: pointer;" @click="stopPollers()">Stop</button>
            </div>
        </div>
        <div style="height: 6px; background: var(--ui-border-subtle); border-radius: 3px; margin-bottom: 8px;">
            <div :style="{ width: progress.percentage + '%', height: '100%', background: 'var(--ui-primary)', borderRadius: '3px', transition: 'width 0.2s' }" />
        </div>
        <div style="font-size: 13px;">{{ progress.completed }} / {{ progress.total }} — active pollers: {{ activePollers.length }}</div>
    </DemoWrapper>
</template>
```

- [ ] **Step 4: Create ErrorStates.vue**

`src/features/devtools/ErrorStates.vue`:
```vue
<script setup lang="ts">
import { useApi } from "@ametie/vue-muza-use";
import DemoWrapper from "@/shared/components/DemoWrapper.vue";

const configs = [
    { label: "200 OK", url: "/users/1" },
    { label: "404 Not Found", url: "/users/99999" },
    { label: "404 (retry x2)", url: "/users/88888", opts: { retry: 2, retryDelay: 300 } },
    { label: "Aborted", url: "/users/2" },
    { label: "Public (no auth)", url: "/users/3", opts: { authMode: "public" as const } },
    { label: "Optional auth", url: "/users/4", opts: { authMode: "optional" as const } },
] as const;

const instances = configs.map(({ url, opts }) =>
    useApi(url, { immediate: true, skipErrorNotification: true, ...opts }),
);

function abortFourth(): void {
    instances[3].abort("manual abort");
}
</script>

<template>
    <DemoWrapper
        title="Error States"
        description="6 instances with different outcomes side by side. Open devtools to see all states in the Instances and Network tabs."
    >
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
            <div
                v-for="(cfg, i) in configs" :key="i"
                style="padding: 10px; border-radius: 6px; border: 1px solid var(--ui-border-subtle);"
            >
                <div style="font-weight: 600; margin-bottom: 4px;">{{ cfg.label }}</div>
                <div v-if="instances[i].loading.value" style="color: var(--ui-foreground-muted)">Loading...</div>
                <div v-else-if="instances[i].error.value" :style="{ color: 'var(--ui-danger)', fontSize: '12px' }">
                    {{ instances[i].error.value?.message }}
                </div>
                <div v-else style="color: var(--ui-success)">OK</div>
                <button v-if="i === 3" style="margin-top: 6px; padding: 4px 10px; cursor: pointer; font-size: 12px;" @click="abortFourth()">Abort</button>
            </div>
        </div>
    </DemoWrapper>
</template>
```

- [ ] **Step 5: Commit**

```bash
git add libs/
git commit -m "feat: add Devtools testing scenarios (kitchen-sink, stress-test, error-states)"
```

---

### Task 15: Build verification and final check

- [ ] **Step 1: Run TypeScript type check**

```bash
pnpm --filter playground build
```

Expected: compiles without errors.

- [ ] **Step 2: Verify all 28 routes navigate correctly**

```bash
pnpm --filter playground dev
```

Open http://localhost:5174. Manually click through every sidebar item and verify:
- Page loads without console errors
- Demo content renders
- "Show Code" button shows the snippet
- Live interactions work (buttons, inputs)

Checklist:
- [ ] /core/basic — users list loads
- [ ] /core/dynamic-url — user changes on button click
- [ ] /core/lazy — fetch only on button click
- [ ] /core/debounce — 500ms delay before request
- [ ] /core/select — data is string[] not User[]
- [ ] /batch/basic — progress bar fills
- [ ] /batch/concurrency — queue visible at concurrency:1
- [ ] /batch/settled — mixed OK/error rows
- [ ] /batch/reactive — re-runs when count changes
- [ ] /cache/ttl — second fetch uses cache (request count stays 1)
- [ ] /cache/swr — revalidating flashes briefly
- [ ] /cache/invalidation — busting cache causes network hit
- [ ] /polling/basic — request count increments every 3s
- [ ] /polling/when-hidden — pauses on tab switch
- [ ] /polling/dynamic — interval changes work
- [ ] /triggers/focus — refetch on tab return
- [ ] /triggers/reconnect — instructions for DevTools Network
- [ ] /retry/basic — 3 attempts logged
- [ ] /retry/custom-codes — 404 triggers retry
- [ ] /auth/login — fills from .env, logs in
- [ ] /auth/refresh — calls /users/me
- [ ] /auth/modes — 3 modes tested
- [ ] /state/mutate — fake user added without re-fetch
- [ ] /state/reset — state clears
- [ ] /state/ignore-updates — silent userId change
- [ ] /devtools/kitchen-sink — 6 instances all active
- [ ] /devtools/stress-test — batch + pollers fire
- [ ] /devtools/errors — 6 states visible side by side

- [ ] **Step 3: Commit**

```bash
git add libs/
git commit -m "chore: playground complete — 28 demos + 3 devtools scenarios"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|-----------------|------|
| libs/config copied, @ametie/config | Task 1 |
| libs/ui copied, @ametie/ui | Task 2 |
| pnpm-workspace.yaml libs/* | Task 1 |
| playground package.json, vite.config | Task 3 |
| FSD: app layer, layouts, routes | Task 4 |
| Vue Router, sidebar nav | Tasks 4-5 |
| Shared: axios, DemoWrapper, useCodeBlock | Task 6 |
| Core demos (5) | Task 7 |
| Batch demos (4) | Task 8 |
| Cache demos (3) | Task 9 |
| Polling demos (3) | Task 10 |
| Triggers demos (2) | Task 11 |
| Retry demos (2) | Task 11 |
| Auth demos (3) + Pinia store | Task 12 |
| State demos (3) | Task 13 |
| Devtools: Kitchen Sink | Task 14 |
| Devtools: Stress Test | Task 14 |
| Devtools: Error States | Task 14 |
| .env with credentials | Task 4 |
| Show Code toggle | Task 6 (DemoWrapper) |
| sidebar 9 groups, 28 items | Task 5 |
| highlight.js code blocks | Task 6 |

All 28 pages covered. All spec requirements mapped. No placeholders.

