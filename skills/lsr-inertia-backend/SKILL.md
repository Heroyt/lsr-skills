---
name: lsr-inertia-backend
description: Use for lsr/inertia backend integration, WithInertia controller responses, normalized typed props, partial/deferred/merge/once behavior, Inertia V3 SSR configuration and fallback, middleware headers, and the Latte page shell.
---

# LSR Inertia Backend

Use `lsr-vue-inertia` for Vue page code and `lsr-localization` for server-owned locale props and gettext synchronization.

## Read the Installed Adapter

- `vendor/lsr/inertia/src/Http/WithInertia.php`
- `Services/Inertia.php`
- `Services/InertiaOptions.php`, `Ssr/HttpRenderer.php`, and `DI/InertiaExtension.php` when available
- `Middleware/InertiaMiddleware.php`
- `Resolver/PropResolver.php`
- `Data/*.php`
- `Factory/InertiaFactoryInterface.php`
- application Inertia DI, route middleware, shell template, and frontend page resolver

The adapter evolves independently. Read installed method signatures and page metadata before using advanced props. The SSR contract below requires the options/renderer classes and matching DI schema; older installed packages may not have them. Do not infer package availability from the rolling skills version. The current SSR/bootstrap path supports **Inertia V3 only**, not a V2 compatibility mode.

## DI and Middleware

Register the installed `Lsr\Inertia\DI\InertiaExtension`, then register `Lsr\Inertia\Middleware\InertiaMiddleware` in a named routing middleware group through `$this->serviceRef(InertiaMiddleware::class)`. Attach the group with `middleware()` or `middlewareAll()` to every Inertia route. See `lsr-routing` for service-reference and compiled-route-cache rules.

The middleware:

- binds an Inertia service to the request;
- leaves non-Inertia responses unchanged;
- adds `X-Inertia: true` and `Vary: X-Inertia` to Inertia responses;
- converts PUT/PATCH/DELETE `302` redirects to `303`;
- returns `409` plus `X-Inertia-Location` for version mismatches/external visits according to the installed implementation.

Do not duplicate these headers in controllers.

Current `Inertia::render()` also sets `Vary: X-Inertia` on initial HTML. Preserve that distinction at reverse proxies/caches; JSON and HTML representations must not collide.

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

Keep framework-only objects (`page`, `app`, `request`) and generated shell fields (`inertiaPage`, `inertiaHead`, `inertiaBody`) out of component props. Return DTOs/models/scalars whose normalized shape is intentional; do not leak `Dibi\Row` or service objects.

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

## Normalization Contract

The current `Inertia` and `InertiaFactory` constructors require Symfony `NormalizerInterface`, not `SerializerInterface`. Symfony's standard `Serializer` implements both. Custom serializer-only implementations must provide a normalizer; named constructor arguments `serializer:` become `normalizer:`. Controller `render()` and factory `fromRequest()` signatures are unchanged.

Props are resolved once, then the complete page is normalized once with format `json` and the configured `normalizationContext`. Native JSON encoding supplies the X-Inertia response, renderer request and fallback script consistently. Do not normalize the page again in the shell or resolve callbacks a second time for SSR.

Use `normalizationContext` for intentional date/enum/object handling; see `lsr-serializer-validation`. `jsonEncodeOptions` controls native encoding, not Symfony encoder configuration. Encoding always throws and escapes slashes for script safety; `JSON_FORCE_OBJECT` and `JSON_PARTIAL_OUTPUT_ON_ERROR` are rejected. Normalization/encoding failures are application errors, not renderer failures eligible for fallback.

## Optional SSR Configuration

SSR is **disabled by default**. Enable it in the application's modular Inertia NEON after inspecting the installed schema. The application supplies a PSR-18 client with finite connect/total deadlines and a PSR-17 request factory; the package does not install a concrete HTTP client. Example for an app that already uses Guzzle, with the extension registered as `inertia`:

```neon
services:
	inertiaSsrClient:
		create: GuzzleHttp\Client([connect_timeout: 0.2, timeout: 1.0])
		autowired: false

inertia:
	rootId: app
	normalizationContext: []
	ssr:
		enabled: true
		client: @inertiaSsrClient
		url: http://127.0.0.1:13714/render
		throwOnError: false
```

These deadlines illustrate configuration, not a measured production recommendation. PSR-18 has no portable timeout parameter: configure the concrete client. `ssr.client` also accepts a Nette Statement; `null` uses PSR client autowiring when enabled. Prefer a dedicated client so unrelated outbound HTTP does not inherit renderer-specific policy. Disabled SSR needs no concrete client or request factory in addition to the existing response/stream factory dependencies.

`rootId` must agree with the browser and Node entrypoints. Use a loopback endpoint for a same-container renderer, or private service DNS such as `http://ssr:13714/render` for a separate container. The endpoint is trusted deployment configuration, never request input. The package performs no Node startup, hot-file discovery, retries or output caching. See `lsr-roadrunner-runtime` for process ownership and `lsr-vue-inertia` for rendering/hydration.

### Dispatch, failure and request policy

- Only an ordinary GET HTML render calls Node. X-Inertia requests, HEAD and POST bypass SSR.
- `HttpRenderer::render(string $pageJson)` sends the already-encoded page itself in one JSON POST, not `{page: ...}`. It forwards no browser cookies or authorization headers.
- A successful result has `head: list<string>` and a nonempty string `body`. Non-2xx status, malformed/wrong-shaped JSON and PSR client exceptions become `SsrException`.
- A successful JSON `null` selects CSR fallback (Vite warmup), even with strict mode. It is not equivalent to a failing HTTP response.
- Default behavior catches renderer failures and returns CSR. Existing lifecycle hooks receive caught SSR exceptions without exposing props in generated error messages; failing hooks cannot break fallback. Set `ssr.throwOnError: true` to propagate renderer failures during development/acceptance checks.
- Do not broadly catch normalizer, template or client-programming errors as SSR fallback.

To opt out for one request, set the attribute on the request passed to the Inertia factory:

```php
$request = $request->withAttribute(
	Lsr\Inertia\Services\Inertia::SSR_ENABLED_ATTRIBUTE,
	false,
);
return $handler->handle($request);
```

The key is `inertia.ssr.enabled`. This disables an existing renderer; it cannot turn globally disabled SSR on. Apply policy before constructing the rendering Inertia instance, not by mutating a middleware-held instance that the controller may not use. Keep props, results and opt-out state request-local under RoadRunner.

## Shell and Shared Props

Initial browser visits render an application-owned Latte shell. Current template data includes normalized `inertiaPage`, template-ready `inertiaHead`, and complete `inertiaBody`. Emit the trusted package/renderer head inside the document head:

```latte
{$inertiaHead|noescape}
```

At the app mount location:

```latte
{$inertiaBody|noescape}
```

Retain the surrounding document and client asset tags. Replace the old page-data script/root, rather than adding these outlets beside them. Successful V3 renderer bodies already contain the JSON page script and populated root with `data-server-rendered="true"`; fallback supplies one safe JSON script and one empty root. Never wrap the body in another root, duplicate the bootstrap data, or bypass escaping for arbitrary user props. Coordinate PHP/Vue title and meta ownership.

Older shells can still receive `inertiaPage`, but SSR only becomes visible after adopting the head/body outlets. Do not re-serialize that normalized page with a second normalizing encoder on the new path.

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
7. with SSR enabled, inspect raw HTML for rendered text/head and one bootstrap script/root, then verify hydration and interaction in a browser;
8. stop/fail the renderer and verify a correct interactive CSR fallback; verify strict errors and successful `null` warmup separately;
9. assert Node is not called for JSON, HEAD, POST, global disable or per-request opt-out;
10. verify dates/nested DTOs, a prop containing `</script>`, and lazy/deferred callbacks remain correct without double normalization/resolution;
11. after a renderer failure, a later request can SSR again without stale fallback, props or identities.

Run backend static analysis/tests and the frontend typecheck/build. Visually verify changed pages in a browser.
