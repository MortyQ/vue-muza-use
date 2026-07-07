# Workflow — @ametie/vue-muza-use

---

## Package Manager: pnpm

```bash
# Install all dependencies (from repo root)
pnpm install

# Build the library (generates dist/)
pnpm build
# or scoped:
pnpm --filter @ametie/vue-muza-use build

# Run tests in watch mode
pnpm test

# Run tests — single pass (CI)
# NOTE: `pnpm --filter ... test --run` silently swallows the --run flag
# (pnpm eats it before it reaches the underlying script) — use exec instead:
pnpm --filter @ametie/vue-muza-use exec vitest run

# Run a specific test file
pnpm --filter @ametie/vue-muza-use exec vitest run src/useApi.swr.test.ts

# Dev mode — rebuild on source change
pnpm --filter @ametie/vue-muza-use dev

# Start playground for manual testing
cd packages/playground && pnpm dev
```

---

## Local Linking

Three shell scripts at repo root for linking the built library into consuming projects:

```bash
./link-library.sh      # build + pnpm link --global
./unlink-library.sh    # pnpm unlink
./update-local.sh      # rebuild + re-link after source changes
```

Use `./update-local.sh` during active development to pick up source changes in the consuming project.

---

## Conventional Commits — Required

Semantic Release reads commit messages to determine the version bump. Format:

```
<type>(<scope>): <description>
```

| Commit | Version bump |
|--------|-------------|
| `feat: add staleWhileRevalidate cache option` | `minor` |
| `fix: prevent memory leak on rapid re-renders` | `patch` |
| `feat!: rename execute to run on UseApiReturn` | `major` (BREAKING) |
| `perf: reduce reactive watchers in useApiBatch` | `patch` |
| `docs: update README polling examples` | no release |
| `chore: upgrade vitest to 4.x` | no release |
| `test: add coverage for cache invalidation` | no release |
| `refactor: extract normalizeCacheOptions helper` | no release |

### Breaking changes

Use `!` after the type or add `BREAKING CHANGE:` in the commit body:

```
feat!: rename UseApiReturn.execute to UseApiReturn.run

BREAKING CHANGE: The `execute` property on UseApiReturn has been renamed to `run`.
Update all call sites: `const { run } = useApi(...)`.
```

### Scopes (optional but recommended)

`feat(cache):` · `fix(auth):` · `feat(batch):` · `fix(types):` · `feat(retry):`

---

## Release Process

Handled automatically by Semantic Release on merge to `main`:

1. CI reads commits since last tag
2. Determines version bump (patch / minor / major)
3. Updates `CHANGELOG.md`
4. Bumps `version` in `package.json`
5. Creates git tag
6. Publishes to npm

**Never manually bump `version` in `package.json`.** Let Semantic Release handle it.

---

## Playground

`packages/playground/` is a local Vue app for manual testing during development.
Use it to verify behavior end-to-end before writing formal tests.

Changes to `packages/playground/` are not published and do not affect the library version.
