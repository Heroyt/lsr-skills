---
name: lsr-vue-inertia-shadcn
description: Use for LSR app frontend work with Vue 3, TypeScript, Inertia pages/forms, Tailwind CSS, and shadcn-vue/Reka UI components.
---

# Vue + Inertia + shadcn Workflow

## Read First

- Frontend entrypoint: `assets/js/app.ts`.
- Inertia pages: `assets/js/pages`.
- Layouts: `assets/js/layouts`.
- shadcn-vue components: `assets/js/components/ui`.
- Class helper: `assets/js/lib/utils.ts`.
- Vite aliases and entries: `vite.config.ts`.
- shadcn-vue config: `components.json`.
- Backend page names: controller calls to `$this->inertia(...)` under `src/Http/Controllers`.

## Patterns

- Use Vue SFCs with `<script setup lang="ts">`.
- Import app code through `@/`, which resolves to `assets/js`.
- Use Inertia page names that match `assets/js/pages/**/*.vue`, for example backend `inertia('Auth/Login')` maps to `assets/js/pages/Auth/Login.vue`.
- Use `defineOptions({ layout: AppLayout })` when a page needs the shared layout.
- Use `useForm()` from `@inertiajs/vue3` for forms that submit to LSR routes.
- Import shadcn components from their folder index, for example `import { Button } from '@/components/ui/button';`.
- Use `cn()` for class merging when creating reusable UI components.
- Prefer existing shadcn/Reka primitives over hand-rolled controls when a component exists locally.
- Follow `components.json`: shadcn-vue `new-york` style, TypeScript, Tailwind CSS variables, slate base color, Lucide icons, and aliases `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`.

## Adding Components

- Existing local UI components include `button`, `label`, and `form`.
- If adding a shadcn-vue component, place it under `assets/js/components/ui/<component>` and export it from `index.ts` following the existing component folders.
- `shadcn-vue` is a local dev dependency. Use the local CLI through pnpm instead of `dlx`/global installs:

```sh
pnpm exec shadcn-vue add <component>
```

- Use the local CLI for component manipulation when possible, then adapt only enough to match local formatting and imports.
- Keep component variants in TypeScript where the local shadcn component pattern already uses `class-variance-authority`.
- Use `@lucide/vue` icons for buttons and compact controls when an icon is appropriate.

## Forms

- Pair frontend form field names with backend request DTO property names.
- For POST/PUT/DELETE form submissions, use `form.post(...)`, `form.put(...)`, or `form.delete(...)`.
- Surface validation errors from Inertia form state near the corresponding field.
- Do not rely only on HTML validation; backend DTOs under `src/Http/Requests` remain the source of truth.

## Validation

Run the relevant checks after frontend changes:

```sh
pnpm lint:fix
pnpm format
pnpm run tsc
pnpm run eslint
pnpm run build
```

For visual changes, start the dev server and verify the page in the browser:

```sh
pnpm run dev
```
