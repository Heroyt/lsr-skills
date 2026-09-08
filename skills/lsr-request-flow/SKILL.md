---
name: lsr-request-flow
description: Use for LSR HTTP request handling, middleware, controller resolution, action arguments, MapRequest DTOs, model binding, response helpers, and FPM/RoadRunner parity.
---

# LSR HTTP Request Flow

Use `lsr-routing` for route definitions, route-file splitting, localization, groups, domain constraints and route caching. This skill covers request-host dispatch and execution of the selected route.

## Trace the Installed Flow

Read:

- `vendor/lsr/core/src/App.php`
- `vendor/lsr/core/src/RouteHandler.php`
- `vendor/lsr/core/src/Controllers/Controller.php`
- `vendor/lsr/request/src/{Request,Response}.php` or the installed package structure
- `vendor/lsr/request/src/Validation/RequestValidationMapper.php`
- the concrete application request factory, middleware, controllers, and bootstrap

LSR packages are independently versioned. Confirm namespaces from `composer.lock` and installed source rather than copying an old application.

## Dispatch

Since **`lsr/core` 0.5.0** with **`lsr/routing` 0.5.0+**, `App` passes the current request URI host into route matching. Custom dispatchers must pass `host: $request->getUri()->getHost()` to `Router::getRoute()`; omitting it intentionally considers only unrestricted routes. See `lsr-routing` for deferred aliases and host/method fallback. Configure accepted hosts and trusted proxies at the application/server boundary, not in controller dispatch.

`RouteHandler` processes route middleware in order, resolves `[class, method]` handlers through Nette DI, calls controller `init()` when present, resolves action arguments, invokes the action, and adds queued cookie headers.

Route handlers must return `Psr\Http\Message\ResponseInterface`.

Controller classes may extend `Lsr\Core\Controllers\Controller` to use:

- `view()` for Latte;
- `respond()` for string/array/object responses;
- `redirect()`;
- flash helpers;
- common request/app/template parameters initialized by `Controller::init()`.

Inheritance is a convenience, not a requirement for arbitrary callable route handlers.

## Action Argument Resolution

Current `RouteHandler` resolves:

- built-in scalar types from route parameters by argument name;
- `RequestInterface` implementations as the current request;
- `Lsr\Orm\Model` subclasses via a route ID;
- `#[Lsr\Core\Attributes\MapRequest]` objects from GET query data or non-GET parsed body;
- remaining class types from DI.

For a model argument `$article`, ID lookup checks the camelCase `articleId`, its lowercase form, the lowercase argument name, then `id`. Use explicit route placeholder names that make this binding obvious.

Missing required models become route model-not-found errors; nullable models may resolve to `null`. Unsupported union/intersection types fail at runtime. Keep action interfaces simple and test exact conversion behavior.

Core **0.5.0+** also injects compatible PSR `RequestInterface` / `ServerRequestInterface` action arguments from the current request. Its handler-argument cache distinguishes resolved domains so same-method/same-path routes on different hosts can use different controller argument types. Exercise both hosts against one warm cache; route selection alone does not prove argument binding is isolated.

## Request DTOs

```php
use Lsr\Core\Attributes\MapRequest;
use Psr\Http\Message\ResponseInterface;

public function store(
	#[MapRequest] StoreArticleRequest $request,
): ResponseInterface {
	// validated DTO
}
```

- Put transport DTOs in the application's established HTTP request namespace.
- Use typed public properties and `Lsr\ObjectValidation\Attributes`.
- Use `validate()` only for cross-field invariants.
- Do not reuse a request DTO as a domain command/read model merely to avoid mapping.
- Keep framework validation exceptions flowing to the application's configured error interface.

## Middleware

Use PSR-15 `MiddlewareInterface`:

```php
public function process(
	ServerRequestInterface $request,
	RequestHandlerInterface $handler,
): ResponseInterface {
	return $handler->handle($request);
}
```

- Return early for denied/redirected requests.
- Otherwise call the next handler exactly once.
- Store request-local data in request attributes, not mutable singleton properties.
- Register dependency-bearing middleware as DI services.
- Keep authorization server-side.

## Runtime Isolation

FPM creates request state per process/request naturally; RoadRunner reuses the container. For long-running workers:

- no request/user/tenant state in static properties or singleton mutable fields;
- close sessions and release request resources in `finally` paths;
- clear request-scoped model/cache state using the runtime's lifecycle;
- test sequential requests with different users/locales and, with domain routing since 0.5.0, different hosts; reuse the actual generator and handler cache to verify links, redirects and argument mapping do not retain another host's state.

## Verification

Exercise the route through the real HTTP runtime. Cover middleware order, scalar/model/DTO argument mapping, validation failure, missing model, response status/headers/body, cookies, and sequential-request isolation under RoadRunner when deployed.
