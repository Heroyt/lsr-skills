---
name: lsr-vue-inertia-shadcn
description: Use for Vue 3 and TypeScript frontends served by lsr/inertia, including page resolution, typed props/forms, layouts, shared locale/auth state, Tailwind, and optional shadcn-vue components.
---

# LSR Vue, Inertia, and Optional shadcn-vue

This is an optional application stack, not a requirement of LSR core. Use `lsr-inertia-backend` for server response semantics and `lsr-localization` for gettext/locale integration.

## Read the Application First

- `package.json` and the lock file;
- frontend entrypoint and `createInertiaApp()` setup;
- page resolver and page directories;
- TypeScript/Vite aliases;
- shared layouts and prop types;
- `components.json` only if shadcn-vue is installed;
- backend `$this->inertia('...')` component names.

Do not impose one app's paths, shadcn style, Tailwind base color, icons, or package manager on another app.

## Vue Baseline

Use Vue 3 Composition API with `<script setup lang="ts">` unless the project explicitly uses another established style.

- Keep route pages as composition surfaces.
- Split substantial forms, lists, filters, and repeated sections into focused components.
- Keep source state minimal; derive with `computed` and use watchers only for side effects.
- Type props and emits.
- Use props down/events up; add shared state only when it crosses real feature interfaces.
- Extract a composable for reused or side-effect-heavy reactive behavior, not for every helper.
- Keep external/large opaque objects out of deep reactivity where possible.

## Inertia Pages and Props

Backend component names must match the page resolver exactly, including case. Keep one typed page-prop interface per stable page/shared contract.

```vue
<script setup lang="ts">
interface Props {
  articles: ArticleSummary[]
}

defineProps<Props>()
</script>
```

- Treat backend props as server snapshots, not a second client database.
- Do not mutate page props directly; copy only state that is genuinely editable.
- Preserve partial/deferred/merge/once semantics supplied by `lsr/inertia`.
- Keep layouts responsible for shared chrome, not feature logic.
- Synchronize auth/locale/shared state on every Inertia navigation when the backend owns it.

## Forms

Use the installed `@inertiajs/vue3` form interface:

- field names match backend request DTO properties;
- use method-specific `post`, `put`, `patch`, or `delete` calls;
- render server validation errors adjacent to fields;
- handle processing/disabled state and preserve accessibility;
- do not rely on browser validation as the only validation;
- generate/receive URLs through the application's route contract rather than duplicating route paths.

## shadcn-vue

Use shadcn-vue only when `components.json` and dependencies prove the project adopted it.

- Reuse installed local primitives before generating another implementation.
- Follow aliases, style, icon library, and Tailwind configuration from `components.json`.
- Run the project's local CLI through its package manager; do not use a global tool or silently upgrade dependencies.
- Generated components become application code: review accessibility, imports, variants, and local formatting.
- Keep feature behavior outside generic UI primitives.

If shadcn-vue is absent, follow the application's component system. Do not add it merely because this skill was selected.

## Localization

For localized apps, Vue's active locale comes from backend-owned Inertia props. `vue3-gettext` is the preferred optional compatibility layer with LSR's native gettext catalogs. Do not implement a client-only language switch that leaves PHP, routes, `<html lang>`, and browser formatting out of sync.

Use BCP 47 tags (`cs-CZ`) for `Intl` and gettext locale IDs (`cs_CZ`) for catalogs. Centralize their mapping.

## Verification

Run the scripts actually defined by `package.json`, normally formatting/lint, `vue-tsc` or TypeScript checking, tests for changed contracts, and a production build.

For UI changes, start the real app, navigate through the changed Inertia flow, submit success/failure forms, verify partial/deferred behavior if touched, and inspect the page in a browser at relevant viewport sizes.
