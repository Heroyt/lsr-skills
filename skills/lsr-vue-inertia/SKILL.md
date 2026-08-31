---
name: lsr-vue-inertia
description: Use for Vue 3 and TypeScript frontends served by lsr/inertia, including page resolution, typed props and forms, layouts, navigation, and shared locale or auth state.
---

# LSR Vue and Inertia

This is an optional application stack, not a requirement of LSR core. Use `lsr-inertia-backend` for server response semantics and `lsr-localization` for gettext and locale integration.

## Read the Application First

- `package.json` and the lock file;
- frontend entrypoint and `createInertiaApp()` setup;
- page resolver and page directories;
- TypeScript/Vite aliases;
- shared layouts and page-prop types;
- the established component system and styling configuration;
- backend `$this->inertia('...')` component names.

Do not impose one application's paths, styling system, icons, component library, or package manager on another application.

## Vue Baseline

Use Vue 3 Composition API with `<script setup lang="ts">` unless the project explicitly requires an established alternative.

- Keep route pages as composition surfaces.
- Split substantial forms, lists, filters, and repeated sections into focused components.
- Keep source state minimal; derive with `computed` and use watchers only for side effects.
- Type props and emits.
- Use props down and events up; add shared state only when it crosses real feature interfaces.
- Extract a composable for reused or side-effect-heavy reactive behavior, not for every helper.
- Keep external or large opaque objects out of deep reactivity where possible.

## Inertia Pages and Props

Backend component names must match the page resolver exactly, including case. Keep one typed page-prop interface per stable page or shared contract.

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
- Preserve partial, deferred, merge, and once semantics supplied by `lsr/inertia`.
- Keep layouts responsible for shared chrome, not feature logic.
- Synchronize auth, locale, and other backend-owned shared state on every Inertia navigation.

## Navigation

Use the installed `@inertiajs/vue3` navigation interface for application pages so visits preserve the Inertia lifecycle. Use ordinary anchors for downloads, external destinations, or endpoints intentionally outside Inertia.

Generate or receive URLs through the application's backend route contract. Do not duplicate localized route paths in Vue. Preserve method, history, scroll, and state behavior deliberately when using programmatic visits.

## Forms

Use the installed `@inertiajs/vue3` form interface:

- field names match backend request DTO properties;
- use method-specific `post`, `put`, `patch`, or `delete` calls;
- render server validation errors adjacent to fields;
- handle processing and disabled states while preserving accessibility;
- do not rely on browser validation as the only validation;
- reset, preserve, or transform fields explicitly rather than mutating page props.

## Component Systems

Follow the component system already installed by the application. If the project uses shadcn or another library with an official skill, load that skill for component discovery, generation, and library-specific review instead of duplicating its guidance here.

Generated or copied components become application code. Review accessibility, imports, variants, styling tokens, and local formatting. Keep feature behavior outside generic UI primitives.

Do not add or replace a component library merely because this skill was selected.

## Localization

For localized applications, Vue's active locale comes from backend-owned Inertia props. `vue3-gettext` is the preferred optional compatibility layer with LSR's native gettext catalogs. Do not implement a client-only language switch that leaves PHP, routes, `<html lang>`, and browser formatting out of sync.

Use BCP 47 tags such as `cs-CZ` for `Intl` and gettext locale IDs such as `cs_CZ` for catalogs. Centralize their mapping.

## Verification

Run scripts actually defined by `package.json`: normally formatting or linting, `vue-tsc` or TypeScript checking, tests for changed observable contracts, and a production build.

For UI changes, start the real application, navigate through the changed Inertia flow, submit successful and failing forms, verify partial or deferred behavior if touched, and inspect the page in a browser at relevant viewport sizes.
