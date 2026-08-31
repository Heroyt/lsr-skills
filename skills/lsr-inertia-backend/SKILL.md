---
name: lsr-inertia-backend
description: Use for lsr/inertia backend integration, WithInertia controller responses, typed props, partial reloads, lazy/deferred/merge/once props, middleware headers, and the Latte page shell.
---

# LSR Inertia Backend

Use `lsr-vue-inertia` for Vue page code and `lsr-localization` for server-owned locale props and gettext synchronization.

## Read the Installed Adapter

- `vendor/lsr/inertia/src/Http/WithInertia.php`
- `Services/Inertia.php`
- `Middleware/InertiaMiddleware.php`
- `Resolver/PropResolver.php`
- `Data/*.php`
- `Factory/InertiaFactoryInterface.php`
- application Inertia DI, route middleware, shell template, and frontend page resolver

The adapter evolves independently. Read installed method signatures and page metadata before using advanced props.

## DI and Middleware

Register the installed `Lsr\Inertia\DI\InertiaExtension`, then register `Lsr\Inertia\Middleware\InertiaMiddleware` in a named routing middleware group through `$this->serviceRef(InertiaMiddleware::class)`. Attach the group with `middleware()` or `middlewareAll()` to every Inertia route. See `lsr-routing` for service-reference and compiled-route-cache rules.

The middleware:

- binds an Inertia service to the request;
- leaves non-Inertia responses unchanged;
- adds `X-Inertia: true` and `Vary: X-Inertia` to Inertia responses;
- converts PUT/PATCH/DELETE `302` redirects to `303`;
- returns `409` plus `X-Inertia-Location` for version mismatches/external visits according to the installed implementation.

Do not duplicate these headers in controllers.

## Controller Responses

Controllers commonly extend `Lsr\Core\Controllers\Controller` and use `Lsr\Inertia\Http\WithInertia`:

```php
final class DashboardController extends Controller
{
	use WithInertia;

	public function show(): ResponseInterface
	{
		$this->params = new DashboardPage(...);
		return $this->inertia('Dashboard/Index');
	}
}
```

The component name must match the frontend resolver's exact case/path. Current `inertia()` accepts a component plus optional parameters, URL, and Latte shell template. Prefer typed `TemplateParametersInterface` DTOs for stable page props.

Keep framework-only objects (`page`, `app`, `request`) out of serialized props. Return DTOs/models/scalars whose serializer shape is intentional; do not leak `Dibi\Row` or service objects.

## Prop Types

Current `WithInertia` helpers include:

- `inertiaLazy()` — omitted initially; resolved only for a matching partial request;
- `inertiaAlways()` — included even when partial filters request other props;
- `inertiaDefer()` — emitted as deferred metadata and resolved on a matching request;
- `inertiaMerge()` / `inertiaDeepMerge()` — client merge metadata;
- `inertiaOnce()` — client-held once-prop metadata with optional freshness/expiry behavior.

Read the installed wrapper classes for exact chaining (`append`, `prepend`, `matchOn`, `fresh`, `until`) before composing them.

Closures are work: do not wrap an eager query in a plain closure and assume it will be skipped. Use the wrapper whose inclusion semantics match the requirement.

## Partial Reloads

Partial behavior applies only when `X-Inertia-Partial-Component` matches the rendered component. Current request headers include:

- `X-Inertia-Partial-Data` — root allow-list;
- `X-Inertia-Partial-Except` — root deny-list;
- `X-Inertia-Except-Once-Props` — once-prop keys already held by the client.

`AlwaysProp` bypasses partial filtering. Lazy/deferred props are normally absent on initial full visits. Test header combinations; do not infer behavior from the Vue call alone.

## Shell and Shared Props

Initial browser visits render an application-owned Latte shell. Keep the shell limited to the document, mount point, assets, and serialized `inertiaPage`.

Shared props such as auth, flash messages, CSRF data, and locale must be:

- minimal;
- serialized deliberately;
- recalculated at the correct request lifecycle;
- safe across long-running workers;
- typed on the frontend.

Never send permissions/secrets merely because a layout may need them.

## Verification

Exercise through HTTP:

1. initial non-Inertia visit returns the Latte shell and page payload;
2. Inertia visit returns JSON and correct headers;
3. partial allow/deny requests execute only expected closures;
4. deferred/merge/once metadata matches the installed adapter;
5. redirects and version mismatch use correct status/headers;
6. two sequential RoadRunner requests do not share props/user/locale.

Run backend static analysis/tests and the frontend typecheck/build. Visually verify changed pages in a browser.
