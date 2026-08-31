---
name: lsr-inertia-backend
description: Use for backend Inertia work with lsr/inertia, WithInertia, TemplateParameters props, LazyProp, partial reloads, Inertia middleware, and server-rendered page shell behavior.
---

# LSR Inertia Backend Workflow

Use this skill for backend work with `lsr/inertia` v0.1.6+.

## Read First

- Inertia config: `config/di/extensions/inertia.neon`.
- Inertia middleware usage: `routes/web.php`.
- Controller trait: `vendor/lsr/inertia/src/Http/WithInertia.php`.
- Inertia service: `vendor/lsr/inertia/src/Services/Inertia.php`.
- Middleware: `vendor/lsr/inertia/src/Middleware/InertiaMiddleware.php`.
- Prop resolver: `vendor/lsr/inertia/src/Resolver/PropResolver.php`.
- Prop wrappers: `vendor/lsr/inertia/src/Data/*.php`.
- Page shell template: `templates/pages/index.latte`.
- Frontend page resolver: `assets/js/app.ts`.

## Controller Usage

- Controllers extend `Lsr\Core\Controllers\Controller` and use `Lsr\Inertia\Http\WithInertia`.
- Return `$this->inertia('Page/Name')` from actions.
- Page names must match `assets/js/pages/**/*.vue`, for example `Auth/Login`.
- Set `$this->title` and `$this->params` before rendering when needed.
- `WithInertia` injects `InertiaFactoryInterface` through Nette property injection.
- `inertia()` accepts optional explicit parameters, URL override, and Latte shell template:
  `inertia(string $component, array|TemplateParametersInterface|null $parameters = null, string|UriInterface|null $url = null, string $template = 'pages/index')`.
- Use controller helper methods for special props: `inertiaLazy()`, `inertiaAlways()`, `inertiaDefer()`, `inertiaMerge()`, `inertiaDeepMerge()`, and `inertiaOnce()`.

## Props

- Inertia props come from controller `$this->params`.
- Prefer `TemplateParametersInterface` / `Lsr\Core\Controllers\TemplateParameters` DTOs for page props. If `$this->params` is a `TemplateParametersInterface`, `getProps()` is used.
- Plain arrays are acceptable for very small/simple pages, but DTOs are the preferred default for type safety.
- Framework props `page`, `app`, and `request` are filtered out before serialization.
- Plain closures inside included props are recursively resolved, including nested array values.
- Use typed DTOs, models, scalar arrays, or serializer-friendly values. Do not expose `Dibi\Row` or unstructured public service/CQRS data just because Inertia can serialize arrays.

## Special Props

- `inertiaLazy(callable)` omits the prop on the initial full visit and resolves it only when a matching partial reload requests/includes the key.
- `inertiaAlways(mixed|callable)` always includes the prop, even when a partial reload requested only other props.
- `inertiaDefer(callable, string $group = 'default', bool $rescue = false)` omits the prop from the initial response and adds page-level `deferredProps` metadata grouped by group name. It resolves on a matching partial reload. With `rescue: true`, resolver failures omit the prop and add the key to `rescuedProps`.
- `inertiaMerge(mixed|callable)` adds page-level `mergeProps` metadata for append-style client merging. By default it merges the root prop key.
- `MergeProp` supports chainable path configuration:
  `->append('items', matchOn: 'id')`, `->prepend('notifications')`, and array shorthand like `->prepend(['notifications' => 'uuid'])`.
- `inertiaDeepMerge(mixed|callable)` adds the root prop key to `deepMergeProps`; chain `->matchOn('messages.id')` or pass a list to identify nested records for client-side matching.
- `inertiaOnce(callable, ?string $key = null)` adds `onceProps` metadata and can be skipped on later visits when the request sends `X-Inertia-Except-Once-Props`. Chain `->fresh()` to force resolution and `->until(DateTimeInterface|DateInterval|int|null)` to set an expiry; integer expiry values are seconds from now.

## Middleware

- Attach `Lsr\Inertia\Middleware\InertiaMiddleware` to Inertia route groups.
- The middleware sets an `inertia` request attribute containing the request-bound `Inertia` service.
- For non-Inertia requests, it returns the handler response unchanged.
- For Inertia requests, it adds `X-Inertia: true` and appends `Vary: X-Inertia` without duplicating an existing `X-Inertia` vary value.
- PUT/PATCH/DELETE 302 redirects are converted to 303 for Inertia requests.
- If `Inertia::$version` is set and a GET request sends a different `X-Inertia-Version`, middleware returns `409` with `X-Inertia-Location` set to the full current URI.
- External redirects use status `409` plus `X-Inertia-Location`; middleware removes `X-Inertia` on those responses and keeps `X-Inertia-Location` only for status `409`.

## Partial Reload Headers

- Partial reloads apply only when `X-Inertia-Partial-Component` exactly matches the rendered component and either `X-Inertia-Partial-Data` or `X-Inertia-Partial-Except` is present.
- `X-Inertia-Partial-Data` is a comma-separated allow-list of root prop keys.
- `X-Inertia-Partial-Except` is a comma-separated deny-list of root prop keys.
- `X-Inertia-Except-Once-Props` is a comma-separated list of once-prop cache keys already held by the client.
- `AlwaysProp` bypasses partial filters. `LazyProp` and `DeferredProp` are omitted from initial full responses unless wrapped in `AlwaysProp`.

## Template Integration

- Initial non-Inertia requests render the Latte page shell, usually `templates/pages/index.latte`.
- The page shell receives `inertiaPage` with `component`, `props`, `url`, and `version`.
- Depending on prop wrappers, the page payload may also include top-level metadata: `deferredProps`, `rescuedProps`, `mergeProps`, `prependProps`, `deepMergeProps`, `matchPropsOn`, and `onceProps`.
- Keep generic Latte shell behavior in the Latte skill; this skill only covers Inertia-specific data flow.

## Validation

```sh
composer phpstan
pnpm lint:fix
pnpm format
pnpm run tsc
pnpm run eslint
pnpm run build
```
