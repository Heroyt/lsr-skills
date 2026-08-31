---
name: lsr-routing
description: Use for LSR route configuration, modular route files, Router and RouteGroup methods, middleware, named and localized routes, parameter validators, controller route attributes, route caching, and link generation.
---

# LSR Routing

## Read the Installed Router

- `vendor/lsr/routing/src/Router.php`
- `Route.php`, `RouteGroup.php`, `LocalizedRoute.php`
- `Attributes/*`, `Interfaces/*`, and routing exceptions
- `DI/RoutingExtension.php`
- `vendor/lsr/core/src/Links/Generator.php`
- application route DI and every registered route file

## Register Route Sources

```neon
extensions:
	routing: Lsr\Core\Routing\DI\RoutingExtension

routing:
	routeFiles:
		- %constants.appDir%routes
	controllers:
		- %constants.appDir%src/Http/Controllers
```

Each `routeFiles` value may be a file or directory. For a directory, current `Router` loads every direct `*.php` file with `glob()`; it does not recurse into subdirectories. Controller directories are scanned recursively for route attributes.

## Split Route Files by Domain

Do not put the entire application in `routes/web.php`. Once the `routes` directory is registered, every direct PHP file is loaded automatically. Prefer focused files such as:

```text
routes/
  auth.php
  public.php
  administration.php
  tournaments.php
  api.php
```

Each file should own coherent routes and import only its handlers/middleware. Do not add a central file that manually requires siblings; the router already owns loading. Keep files at the registered directory's top level unless additional subdirectories are registered explicitly.

Route files are required from `Router::loadRoutes()`, so `$this` is the `Router` instance:

```php
use App\Http\Controllers\ArticleController;

$articles = $this->group('/articles');
$articles->get('', [ArticleController::class, 'index'])->name('articles.index');
$articles->get('/{articleId}', [ArticleController::class, 'show'])->name('articles.show');
```

## Groups and Middleware

`RouteGroup` supports HTTP methods including `get`, `head`, `post`, `put`, `patch`, `update` (PUT alias), `delete`, `options`, `connect`, and `trace`.

- `middleware()` applies to the last route; when no route exists yet it delegates to all-group behavior.
- `middlewareAll()` applies to existing and future routes and child groups.
- `group()` inherits current group middleware.
- `name()` and `localize()` operate on the last route and fail when no active route exists.
- `param()` applies to the active route or all routes when no route is active; `paramAll()` is explicit group-wide validation.

Resolve dependency-bearing middleware through DI. Preserve order; middleware is an ordered interface, not a set.

## Parameter Binding

Route placeholders feed request parameters and controller action mapping. Use names matching the controller argument interface. For an ORM model argument `$article`, prefer `{articleId}`; `RouteHandler` then resolves the model by ID.

Use `RouteParamValidatorInterface` for reusable path validation instead of parsing inside controllers. Test overlapping dynamic paths because multiple validators affect route selection.

## Localized Routes
Define one canonical route, assign its existing path to a locale, then attach other locale variants through the installed `Route::localize()` / `RouteGroup::localize()` interface:

```php
$this->get('/articles/{articleId}', [ArticleController::class, 'show'])
	->name('articles.show')
	->localize('en_GB')
	->localize('cs_CZ', '/clanky/{articleId}');
```

Current localized-route rules reject duplicate locales and require compatible parameter structure. Link generation requires an exact localized variant for localized routes; non-localized routes remain locale-neutral. Pass/derive locale deliberately and keep backend locale, canonical URL, and UI language aligned.

Use `redirectFrom()` for intentional legacy/alternate paths supported by the installed version. Do not maintain duplicate controller routes manually.

## Attribute Routes

Configured controller directories are scanned recursively for method attributes such as `Get`, `Post`, `Put`, `Patch`, `Delete`, `Head`, `Options`, `Connect`, `Trace`, and generic `Route`.

Use either route files or attributes according to the application's established ownership. Do not duplicate the same route in both. Route files are usually clearer for domain grouping, shared middleware, localization, and a navigable route map.

## Names and Cache

Name every route used by redirects or links. Duplicate paths or names fail route loading.

`Router::setup()` caches route trees under key/tag `routes`. After route source changes, normal container/application startup should rebuild as configured; if stale cache persists, use the installed cache command with the route tag rather than clearing unrelated storage:

```sh
php bin/console cache:clean --tag=routes
```

## Verification

- Force route loading and check duplicate-name/path failures.
- Resolve representative static, parameterized, optional, localized, and method-mismatch requests.
- Verify middleware order and parameter validators.
- Generate named links for every supported locale and test legacy redirects.
- Exercise routes through the real HTTP runtime; route-tree construction alone does not verify controller binding.
