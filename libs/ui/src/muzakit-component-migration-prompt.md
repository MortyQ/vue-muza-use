# Prompt: Migrate Vue Component to Muzakit UI Standards

## Context

This is a component migration guide for `libs/ui` in the `muzakit` monorepo.
Follow every step exactly. Do not invent new patterns.

---

## Full Component Structure

```
libs/ui/src/
  components/
    base/
      VAvatar.vue
      VButton.vue        ← already migrated (reference)
      VChip.vue
      VIcon.vue
      VTag.vue
    feedback/
      VLoader.vue
      VProgressBar.vue
      VThemeToggle.vue
      VToaster.vue
    inputs/
      DragNDrop.vue
      VCheckbox.vue
      VDatepicker.vue
      VFileUpload.vue
      VInput.vue
      VSegmentedControl.vue
      VSelect.vue
      VSwitch.vue
      VToggleGroup.vue
    layout/
      VAccordion.vue
      VAnimatedBackground.vue
      VCard.vue
      VInfoNotice.vue
      VTabs.vue
    overlay/
      VDrawer.vue
      VFloating.vue
      VModal.vue
      VTooltip.vue
    table/
      VTable.vue
  styles/
    components/
      base/
        vbutton.scss     ← already exists (reference)
        vavatar.scss
        vchip.scss
        vtag.scss
      feedback/
        vloader.scss
        vprogressbar.scss
        vthemetoggle.scss
        vtoaster.scss
      inputs/
        vcheckbox.scss
        vdatepicker.scss
        vfileupload.scss
        vinput.scss
        vsegmentedcontrol.scss
        vselect.scss
        vswitch.scss
        vtogglegroup.scss
      layout/
        vaccordion.scss
        vcard.scss
        vinfonotice.scss
        vtabs.scss
      overlay/
        vdrawer.scss
        vfloating.scss
        vmodal.scss
        vtooltip.scss
      table/
        vtable.scss
    tokens.css           ← global --ui-* vars (do not modify)
    index.css            ← imports tokens.css (do not modify)
  types/
    validation.ts        ← custom validation type (see Step 2)
  index.ts
```

---

## Step 1 — Script: Migrate Props

### Remove `withDefaults` + `defineProps<Props>()` pattern:

```ts
// ❌ OLD
const props = withDefaults(defineProps<Props>(), {
  type: "text",
  size: "md",
});
```

### Replace with Vue 3.5 Reactive Props Destructure:

```ts
// ✅ NEW
const {
  type = "text",
  size = "md",
} = defineProps<{
  type?: string
  size?: "sm" | "md" | "lg"
}>();
```

Rules:
- Move ALL prop types inline into `defineProps<{...}>()`
- Move ALL defaults inline into the destructure
- Remove the separate `type Props = {...}` if it existed
- After migration replace ALL `props.xxx` in script AND template with direct `xxx`

---

## Step 2 — Validation Type: Do NOT import `@vuelidate/core`

If the component uses `validation` prop (like VInput, VSelect, etc.),
do NOT import from `@vuelidate/core`. Use our own type from `libs/ui/src/types/validation.ts`.

### Create `libs/ui/src/types/validation.ts` if it does not exist:

```ts
/**
 * Minimal validation interface compatible with Vuelidate.
 * Using our own type avoids importing @vuelidate/core just for the type.
 * Works with any validation library that exposes $error / $errors.
 */
export interface FieldValidation {
  $error: boolean
  $errors: Array<{ $message: string | unknown }>
  $dirty: boolean
  $invalid: boolean
  $pending: boolean
  $touch(): void
  $reset(): void
}
```

### Usage in component:

```ts
// ❌ OLD
import { Validation } from "@vuelidate/core";
type FieldValidation = Readonly<Omit<Validation<...>, "...">>

// ✅ NEW
import type { FieldValidation } from "../../types/validation";

const { validation = undefined } = defineProps<{
  validation?: FieldValidation
}>();
```

### In template — same usage as before:
```html
validation?.$error
validation?.$errors[0]?.$message
```

---

## Step 3 — Template: No Tailwind utilities

The component must NOT use Tailwind utility classes in `<template>`.
All layout, sizing, and color goes in the `.scss` file.

```html
<!-- ❌ OLD -->
<span class="inline-flex items-center justify-center gap-2">

<!-- ✅ NEW — use BEM class names -->
<span class="v-input__icon-left">
```

---

## Step 4 — Template: Remove unscoped `<style>` blocks

```scss
/* ❌ OLD — remove entirely */
<style lang="scss">
:where(.v-input-wrapper) {
  width: 100%;
}
</style>
```

Move to the scoped `.scss` file — plain selector, no `:where()` needed:
```scss
/* ✅ NEW — in vinput.scss */
.v-input-wrapper {
  width: 100%;
}
```

---

## Step 5 — Remove RGB channel variable hack

### Pattern to remove — Tailwind v3 legacy:

```scss
/* ❌ OLD — remove entire block */
.v-input-wrapper {
  --_color-primary: var(--color-primary, 14 165 233);
  --_color-error: var(--color-error, 239 68 68);
}

/* ❌ OLD usage */
color: rgb(var(--_color-primary) / 1);
background-color: rgb(var(--_color-error) / 0.1);
```

### Replace with `--ui-*` variables and `color-mix()`:

```scss
/* ✅ NEW */
color: var(--ui-primary);
background-color: color-mix(in oklch, var(--ui-danger) 10%, transparent);
```

---

## Step 6 — Available `--ui-*` tokens

```
/* Brand */
--ui-primary / --ui-primary-hover / --ui-primary-foreground / --ui-primary-subtle

/* Backgrounds */
--ui-background / --ui-surface / --ui-surface-raised / --ui-surface-hover
--ui-nav / --ui-overlay

/* Text */
--ui-foreground / --ui-foreground-secondary / --ui-foreground-muted

/* Borders */
--ui-border / --ui-border-focus

/* Status */
--ui-success / --ui-success-hover / --ui-success-foreground / --ui-success-subtle
--ui-warning / --ui-warning-hover / --ui-warning-foreground / --ui-warning-subtle
--ui-danger  / --ui-danger-hover  / --ui-danger-foreground  / --ui-danger-subtle
--ui-info    / --ui-info-hover    / --ui-info-foreground    / --ui-info-subtle

/* Radius */
--ui-radius / --ui-radius-lg

/* Shadows */
--ui-shadow-sm / --ui-shadow-md / --ui-shadow-lg
```

### Old → New color mapping:

| Old | New |
|-----|-----|
| `--color-primary` | `--ui-primary` |
| `--color-error` | `--ui-danger` |
| `--color-mainText` | `--ui-foreground` |
| `--color-secondaryText` | `--ui-foreground-secondary` |
| `--color-mutedText` | `--ui-foreground-muted` |
| `--color-neutral` | `--ui-foreground` |
| `--color-base-100` | `--ui-surface` |
| `--color-base-200` | `--ui-surface-raised` |
| `--color-base-400` | `--ui-border` |
| `--color-borderFocus` | `--ui-border-focus` |

### Opacity with `color-mix()`:

```scss
/* old opacity 0.5 → color-mix 50% */
color-mix(in oklch, var(--ui-primary) 50%, transparent);

/* old opacity 0.1 → color-mix 10% */
color-mix(in oklch, var(--ui-danger) 10%, transparent);
```

---

## Step 7 — Create the `.scss` file

Create the corresponding file in `libs/ui/src/styles/components/{category}/{name}.scss`.

Rules:
- Use SCSS nesting (`&:hover`, `&--modifier`, `&__element`) ✅
- Do NOT use `@import` inside — no nested imports ❌
- Do NOT use SCSS variables `$var` — use `var(--ui-*)` ❌
- Do NOT use `@mixin` / `@include` ❌
- Use `color-mix(in oklch, ...)` for opacity variants ✅
- Keep all webkit autofill overrides if present ✅
- Keep Vue transition classes (`v-enter-active` etc.) if present ✅

---

## Step 8 — Update `.vue` file styles

Replace ALL `<style>` blocks with single scoped import:

```html
<!-- ✅ NEW — single style block -->
<style lang="scss" scoped>
@import "../../styles/components/inputs/vinput.scss";
</style>
```

Path must be relative from the `.vue` file location to `styles/`.

---

## Step 9 — Update `libs/ui/src/index.ts`

Add export and GlobalComponents for the new component:

```ts
import "./styles/index.css";

// existing
export { default as VButton } from "./components/base/VButton.vue";

// add new
export { default as VInput } from "./components/inputs/VInput.vue";

declare module "vue" {
  export interface GlobalComponents {
    VButton: typeof import("./components/base/VButton.vue").default;
    VInput: typeof import("./components/inputs/VInput.vue").default; // ← add
  }
}
```

Also export shared types:
```ts
export type { FieldValidation } from "./types/validation";
```

---

## Step 10 — External dependencies in `libs/ui`

`@vuelidate/core` must be REMOVED from dependencies since we use our own type.
`@vueuse/core` stays — we use `useDebounceFn` at runtime.

`libs/ui/package.json`:
```json
{
  "dependencies": {
    "@vueuse/core": "..."
  }
}
```

`libs/ui/vite.config.ts` externals:
```ts
external: ["vue", "vue-router", "@vueuse/core"]
```

---

## Checklist before finishing

- [ ] `withDefaults` removed
- [ ] Separate `type Props` removed
- [ ] All `props.xxx` → direct `xxx` everywhere
- [ ] `@vuelidate/core` import removed — using `FieldValidation` from `./types/validation`
- [ ] No Tailwind classes in template
- [ ] No unscoped `<style>` block
- [ ] No `--_color-*` local variable block
- [ ] No `rgb(var(...) / opacity)` — use `color-mix()` instead
- [ ] All colors reference `--ui-*` tokens
- [ ] Styles in separate `.scss` file at correct path
- [ ] `<style lang="scss" scoped>` has only `@import`
- [ ] Component exported in `index.ts`
- [ ] `GlobalComponents` updated in `index.ts`
- [ ] `FieldValidation` type exported from `index.ts` if used
