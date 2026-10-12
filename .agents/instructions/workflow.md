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
pnpm --filter @ametie/vue-muza-use exec vitest run tests/useApi.swr.test.ts

# Dev mode — rebuild on source change
pnpm --filter @ametie/vue-muza-use dev

# Start playground for manual testing
cd packages/playground && pnpm dev
```

---

## OpenSpec

Planning and specs live in OpenSpec; the trigger rule is in `.agents/claude/behavior.md`.

The CLI is a root devDependency (`@fission-ai/openspec`, exact version) — `pnpm install` is the
whole installation. No global install; always call it through pnpm.

```bash
pnpm openspec list       # active changes
pnpm openspec show       # show a change or spec
pnpm openspec validate   # validate changes and specs (--all for everything)
pnpm openspec view       # interactive dashboard
pnpm openspec:update     # regenerate skills/commands/prompts for the installed version
```

- **Updating is manual, on purpose.** Check what is new with
  `pnpm outdated -w @fission-ai/openspec`, then in one PR:
  `pnpm add -Dw --save-exact @fission-ai/openspec@<version>` → `pnpm openspec:update` → review
  the diff of the generated files. Commit as `chore(deps): update openspec to <version>`.
- **Telemetry off:** `OPENSPEC_TELEMETRY=0` — set inside the `openspec:update` script. For
  ad-hoc terminal use run `pnpm openspec config set telemetry.enabled false` once
  (`.claude/settings.json` is gitignored here, so the env cannot be shared through it).
- **Layout:** `openspec/config.yaml`, `openspec/specs/<package>-<capability>/spec.md` (living
  specs), `openspec/changes/<change>/` (proposal, design, delta specs, tasks),
  `openspec/changes/archive/`.
- **Generated, never hand-edited:** `.claude/skills/openspec-*`, `.claude/commands/opsx/`,
  `.github/skills/openspec-*`, `.github/prompts/opsx-*`.
- **Commits:** a spec-only change uses `docs(openspec): <description>` (no release);
  implementation commits keep their `feat(<scope>)` / `fix(<scope>)` type, which is what
  semantic-release reads.

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
