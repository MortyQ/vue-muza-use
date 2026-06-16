# Devtools Release — Test Coverage Design

**Date:** 2026-06-16
**Branch:** feature/devtools
**Semver impact:** patch (default value changes) + test-only additions

---

## Context

The `feature/devtools` branch introduces two changes to release together:

- `packages/use-api` — devtools bridge integration (`devtools.ts`, `useApi.ts` instrumentation)
- `packages/devtools` — new standalone package (`@ametie/vue-muza-devtools`)

The logical layer (store, composables, instrumentation, bridge) has strong test coverage. Two gaps need to be closed before release:

1. Eight storage functions in `devtoolsStorage.ts` have no tests
2. Key UI components have no smoke tests

Additionally, the `maxHistory` and `maxPayloadSize` defaults are being raised.

**Note:** Instances and Timeline tabs are intentionally disabled for this release (`registerTab` calls commented out in `app/index.ts`). Existing composable tests for those features are forward-looking — not a gap.

---

## Change 1 — Update Default Values

### What changes

`packages/devtools/src/shared/store/devtoolsStore.ts`

| Setting | Old default | New default | Reason |
|---------|------------|-------------|--------|
| `maxHistory` | 100 | 300 | More request history visible by default |
| `maxPayloadSize` | 50_000 | 200_000 | Larger payloads displayable; 300KB rejected due to TreeViewer DOM node risk |

Both values changed in two places: the initial state literal and the `??` fallbacks in `initDevtoolsStore`.

### Tests to update

`packages/devtools/src/shared/store/devtoolsStore.test.ts` — circular buffer and truncation tests that reference specific old values must be updated to match new defaults.

### Files to check

`packages/devtools/src/app/index.ts` and `packages/use-api/src/plugin.ts` — verify defaults are not duplicated elsewhere.

---

## Change 2 — Storage Tests (8 missing functions)

### File

`packages/devtools/src/shared/storage/devtoolsStorage.test.ts` — append to existing file, following the existing load/save pair pattern.

### Four new `describe` blocks

```
loadNetworkToolbarVisible / saveNetworkToolbarVisible
  - returns default when nothing stored (verify actual default from source)
  - save then load returns saved value

loadNetworkFilterVisible / saveNetworkFilterVisible
  - returns default when nothing stored
  - save then load returns saved value

loadResponseFormat / saveResponseFormat
  - returns default when nothing stored
  - save then load returns saved value

loadSplitPayloadWidth / saveSplitPayloadWidth
  - returns undefined when nothing stored
  - save then load returns saved value
```

Defaults must be verified against source before writing assertions.

---

## Change 3 — Component Smoke Tests (2 new files)

Goal: verify components mount without crashing and render expected root structure. Not snapshot tests — minimal mount + exists checks only.

Store mocked via `vi.mock` on `devtoolsStore`. Storage mocked via `vi.mock` on `devtoolsStorage` (same pattern as `useFloatingPanel.test.ts`).

### New file: `packages/devtools/src/features/network/components/NetworkTab.test.ts`

```
NetworkTab
  - mounts without crashing
  - renders empty state when no requests
  - renders toolbar
```

### New file: `packages/devtools/src/features/network/components/RequestDetail.test.ts`

```
RequestDetail
  - mounts without crashing when selection is null
  - mounts without crashing when a request is selected (mock data)
```

---

## Implementation Order

1. Update `devtoolsStore.ts` defaults
2. Update `devtoolsStore.test.ts` to match new defaults
3. Check `plugin.ts` / `app/index.ts` for duplicated defaults
4. Add 4 new describe blocks to `devtoolsStorage.test.ts`
5. Create `NetworkTab.test.ts`
6. Create `RequestDetail.test.ts`
7. Run full test suite for both packages

## Verification Commands

```bash
pnpm --filter @ametie/vue-muza-use test --run
pnpm --filter @ametie/vue-muza-devtools test --run
```

---

## Files Touched

| File | Change type |
|------|------------|
| `packages/devtools/src/shared/store/devtoolsStore.ts` | Edit — update defaults |
| `packages/devtools/src/shared/store/devtoolsStore.test.ts` | Edit — update assertions |
| `packages/devtools/src/shared/storage/devtoolsStorage.test.ts` | Edit — add 4 describe blocks |
| `packages/devtools/src/features/network/components/NetworkTab.test.ts` | New file |
| `packages/devtools/src/features/network/components/RequestDetail.test.ts` | New file |
