---
name: lsr-routing
description: Use for LSR route configuration, modular route files, Router and RouteGroup methods, domain routing and aliases since 0.5.0, middleware, named and localized routes, generic route metadata, sitemap discovery and hreflang alternatives, parameter validators, controller attributes, route caching, and link generation.
---

# LSR Routing

## Read the Installed Router

- `vendor/lsr/routing/src/Router.php`
- `Route.php`, `RouteGroup.php`, `LocalizedRoute.php`, `RouteMetadata.php`
- `Attributes/*`, `Interfaces/*`, and routing exceptions
- `DI/RoutingExtension.php`
- `Sitemap/*` and `Cache/CompiledRouteCache.php`
- `vendor/lsr/core/src/Links/Generator.php`
- application route DI and every registered route file

Generic route metadata and sitemap discovery described below require `lsr/routing` **0.4.2 or newer**. Check the application's installed package and Composer constraint first; a `^0.3` constraint does not accept these `0.4` releases.

Exact-host domain routing requires **`lsr/routing` 0.5.0+**. Automatic request-host dispatch, domain-aware links, redirects and menus also require **`lsr/core` 0.5.0+**; core 0.5 requires routing `^0.5`. Composer constraints `^0.3` and `^0.4` do not accept `0.5.0`. Do not copy these APIs into an older installation or upgrade separately deployed applications implicitly.

## Register Route Sources

```neon
extensions:
	routing: Lsr\Core\Routing\DI\RoutingExtension

routing:
	routeFiles:
		- %constants.appDir%routes
	controllers:
		- %constants.appDir%src/Http/Controllers
	cache:
		file: %tempDir%/routes.php
		autoCompile: true
		checkTimestamps: false
		commands: true
	sitemap:
		defaultIncluded: false
```

Each `routeFiles` value may be a file or directory. For a directory, current `Router` loads every direct `*.php` file with `glob()`; it does not recurse into subdirectories. Controller directories are scanned recursively for route attributes.

## Split Route Files by Business Concern

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

Define reusable middleware stacks in a route file loaded before their consumers. `middleware()` and `middlewareAll()` accept middleware instances, middleware-group names, and explicit service references:

```php
use App\Http\Middleware\CsrfMiddleware;
use App\Http\Middleware\SessionMiddleware;

$this->middlewareGroup(
	'web',
	$this->serviceRef(SessionMiddleware::class),
	$this->serviceRef(CsrfMiddleware::class),
);

$admin = $this->group('/admin')->middlewareAll('web');
$admin->get('', [AdminController::class, 'index']);
```

Bare strings are case-insensitive middleware-group names, not DI identifiers. Use `$this->serviceRef(SomeMiddleware::class)` to resolve exactly one service by type. Use `\Lsr\Core\Routing\ServiceReference::named('service.name')` only when an exact Nette service name is required. Direct middleware instances remain appropriate for dependency-free one-off middleware.

Group definitions append when registered repeatedly. Resolution preserves call order and removes only repeated references to the same middleware object; distinct instances of the same class remain distinct. Middleware groups cannot contain other group names. All referenced groups must exist before route loading finishes.

Resolve dependency-bearing middleware through DI. Prefer service references over serializing service objects into the compiled route cache.

## Domain Routing (Since 0.5.0)

Domain constraints select exact request hosts; they are separate from organizing files by business concern. `Router::domain(string $domain): RouteGroup` creates a group directly:

```php
$this->domain('public')
	->get('/', [PublicController::class, 'index'])
	->name('public.home');
$this->domain('admin')
	->get('/', [AdminController::class, 'index'])
	->name('admin.home');

// May live in a later route file: resolution happens after all sources load.
$this->declareDomain('www.example.test', alias: 'public');
$this->declareDomain('admin.example.test', alias: 'admin');

// Unrestricted routes remain eligible on every host.
$this->get('/health', [HealthController::class, 'show'])->name('health');
```

On an existing group, `domain()` creates a child with the same prefix and inherited settings. It never changes the active route, earlier routes or siblings. Thus `domain('admin')->group('/api')` and `group('/api')->domain('admin')` both constrain `/api`. Ordinary descendants inherit the domain; another `domain()` child selects its own domain. Keep authentication and authorization middleware explicit: hostname matching is not access control.

### Deferred Aliases and Normalization

- Resolve each reference with one exact-string alias lookup after all route files and controller attributes load. A declared alias becomes its concrete target; any other string is a literal hostname. Do not guess alias intent from dots or reject undeclared strings as missing aliases.
- Aliases may look like hostnames, and targets are not recursively expanded. Repeating a normalized mapping is allowed before resolution; conflicting targets for one alias fail.
- Hosts normalize case and one trailing DNS dot. ASCII DNS/punycode, single-label hosts, IPv4 and IPv6 literals are supported. Pass hostnames, not origins: schemes, ports, paths, user information and wildcards are invalid constraints. Convert Unicode names to punycode explicitly.
- `setup()` / `loadRoutes()` finalize domains after middleware resolution. For manual inline registration, call `$router->resolveDomains()` after all declarations and before host-aware matching, domain-aware links or sitemap discovery. Matching rejects pending domains rather than leaking them into unrestricted routes.
- Alias declarations freeze after resolution. New routes may use existing aliases; `unregisterAll()` resets route/domain state. Alias and literal declarations resolving to the same host share one tree, so conflicting routes are detected by final host, method and path.

### Matching and Introspection

Custom dispatchers must pass the URI host using the optional fifth argument; existing explicit fourth-argument route trees remain supported:

```php
use Lsr\Core\Routing\Router;
use Lsr\Enums\RequestMethod;

$params = [];
$route = Router::getRoute(
	RequestMethod::GET,
	['api', 'jobs'],
	$params,
	host: $request->getUri()->getHost(),
);
```

- Hostless calls consider only unrestricted routes. Host-aware calls prefer that host's routes, then use unrestricted routes as a per-method fallback. Domain-only paths on other hosts are absent; they do not redirect.
- HEAD/OPTIONS/405 only consider the selected host and unrestricted trees. A host-specific GET's synthetic HEAD precedes unrestricted HEAD. Explicit OPTIONS handlers precede synthesis; synthetic OPTIONS, including `OPTIONS *`, unions only applicable methods.
- Names remain globally unique across hosts. Obtain named routes from `getRouteByName()`; fluent HTTP methods on `RouteGroup` return the group, not the route.
- `availableRoutes` / `getAvailableRoutes()` retain the unrestricted tree shape. Use `getDomainRoutes()` for resolved per-host trees and the optional `Lsr\Core\Routing\Interfaces\DomainRouteInterface::getDomain()` capability for a route's resolved hostname. Existing custom `RouteInterface` implementations need not implement it.
- Localized variants retain the logical route's domain. Sitemap discovery spans registered domain trees but does not implicitly include/exclude routes; the application still filters hosts and generates absolute sitemap URLs.

### Attributes and Domain-Aware Destinations

`#[Lsr\Core\Routing\Attributes\Domain('admin')]` works on classes and methods. Precedence is route attribute `domain:` argument, then method `#[Domain]`, then class `#[Domain]`:

```php
use Lsr\Core\Routing\Attributes\Domain;
use Lsr\Core\Routing\Attributes\Get;
use Nyholm\Psr7\Response;
use Psr\Http\Message\ResponseInterface;

#[Domain('admin')]
class StatusController
{
	#[Get('/status', name: 'public.status', domain: 'public')]
	public function status(): ResponseInterface
	{
		return new Response(200, [], 'Public status');
	}
}
```

With core 0.5.0+, use `Generator::route()` / named `getLink()` for named destinations and `getRouteLink()` for route objects. Same-host pretty links remain relative; cross-host links are absolute and retain the current request's scheme and port. Raw path links remain local. Generators use the current request rather than retaining the first host in a long-running worker.

`redirectFrom()` inherits its destination's domain; an explicitly registered redirect alias may instead use a different source domain. Cross-domain alias redirects preserve scheme, port and query. Named menu items use the destination domain for links and active state. The Tracy routing panel shows the request host, selected route domain and separate host trees.

Domain routing does not establish a global host allowlist or trust proxy headers. Configure allowed hosts, trusted proxies, HTTPS and domain-specific ports at the application/web-server boundary.

## Parameter Binding

Route placeholders feed request parameters and controller action mapping. Use names matching the controller argument interface. For an ORM model argument `$article`, prefer `{articleId}`; `RouteHandler` then resolves the model by ID.

Use `RouteParamValidatorInterface` for reusable path validation instead of parsing inside controllers. Test overlapping dynamic paths because multiple validators affect route selection.

## Application-Owned Route Metadata

`meta(array $data)` is generic route metadata, not a sitemap option. It works on any HTTP method and on routes excluded from sitemaps. Retrieve the resolved data with `Route::getMeta()` after obtaining the route from the Router or request flow.

```php
$this->group('/api/jobs')
	->meta(['permission' => 'jobs'])
	->post('', [JobController::class, 'create'])
		->name('jobs.create')
		->meta(['audit' => true]);
```

- On `RouteGroup`, `meta()` targets the active route; before the first route, it sets group defaults. `metaAll()` always changes group defaults for existing and future descendants.
- Resolve each key from the most specific declaration: route, nearest group, then ancestor groups. Repeated calls merge shallowly; a child nested array replaces the parent's entire value for that key. `null` is an explicit value, not removal or inheritance.
- Parent changes remain live without erasing explicit child keys. Localized variants share their logical route family's metadata.
- Top-level keys must be strings; values may be scalars, `null`, or acyclic nested arrays. Objects, services, closures, resources and cycles are rejected. Values are detached from caller references and `getMeta()` returns an independent array snapshot.
- Metadata does not opt a route into a sitemap. Keys such as `priority`, `name`, or `included` remain application data and cannot override the dedicated sitemap settings.
- Compiled routes store generic metadata separately from sitemap declarations. Keep request-specific users, tenants, secrets and mutable runtime state out of route metadata.

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

## Sitemap Declarations and Discovery

The routing package owns declarations and discovery, **not sitemap generation**. Applications own content queries, parameter expansion, absolute origins, per-record publication/translation availability, `lastmod`, XML, file splitting and scheduling.

The default is explicit opt-in. Public-first applications can set `routing.sitemap.defaultIncluded: true`, or pass `sitemapDefaultIncluded: true` to the Router constructor, then exclude private routes/groups. This policy includes newly registered eligible GET routes automatically; it is not authorization or a `noindex` guarantee.

```php
use Lsr\Core\Routing\Sitemap\SitemapChangeFrequency;

$this->group('/articles')
	->sitemap('articles')
	->priority(0.6)
	->changefreq(SitemapChangeFrequency::WEEKLY)
	->get('/{articleId}', [ArticleController::class, 'show'])
		->name('articles.show')
		->localize('en_GB')
		->localize('cs_CZ', '/clanky/{articleId}')
		->meta(['source' => 'articles'])
	->get('/preview/{articleId}', [ArticleController::class, 'preview'])
		->sitemapExclude();
```

Declaration rules:

- `sitemap(?string $name = null)` explicitly includes a route. A non-null name selects one named sitemap; repeated names replace rather than accumulate. A null name preserves the existing/inherited name, falling back to the unnamed/default sitemap.
- `sitemapExclude()` explicitly excludes a route without deleting its name or generic metadata. A more-specific child declaration can re-include a route inside an excluded group.
- Inclusion is tri-state: include, exclude, or inherit. Resolve route first, then nearest declaring group, then Router policy.
- `priority(float)` accepts finite values from `0` through `1`. `changefreq()` accepts `SitemapChangeFrequency` or the strings `always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `never`. Neither setter changes inclusion.
- Group setters target the active route, or group defaults before the first route. Use `sitemapAll()`, `sitemapExcludeAll()`, `priorityAll()` and `changefreqAll()` to change group defaults after routes exist. Explicit descendants still win, independent of creation order.

After `Router::setup()` or manual registration:

```php
$names = $router->getSitemapNames();
$defaultRoutes = $router->getSitemapRoutes();
$articleRoutes = $router->getSitemapRoutes('articles');
$entries = $router->getSitemapEntries('articles');
```

`getSitemapNames()` lists occupied names, with `null` representing the default. A null argument selects only that default, never all named sitemaps. `getSitemapRoutes()` returns registered logical GET roots once, excluding aliases and localized wrappers. Non-GET, synthetic HEAD/OPTIONS and unregistered routes are not sitemap candidates. Order is unspecified; sort by stable route identity when partitioning output.

`getSitemapEntries()` expands each logical route into its registered canonical language paths. Each read-only `SitemapEntry` exposes:

- `route`: the physical route variant, whose parameters still need application-owned values;
- `metadata`: resolved `SitemapMetadata` containing `included`, `name`, `priority` and `changefreq`;
- `alternates`: a normalized `hreflang => Route` map shared by every entry in the family.

Read application data from `$entry->route->getMeta()`, not from sitemap metadata. A parameterized route declaration is not a generated URL; missing content expansion must be handled explicitly by the application.

### Localized Sitemap Output

Follow [Google's localized sitemap rules](https://developers.google.com/search/docs/specialty/international/localized-versions#sitemap):

- Generate one `<url><loc>...</loc></url>` entry per available language URL, with identical `<xhtml:link rel="alternate" hreflang="..." href="..."/>` alternatives on every entry, including itself.
- Use absolute URLs and `xmlns:xhtml="http://www.w3.org/1999/xhtml"`. Routing supplies route descriptors, not XML or absolute URLs.
- Hreflang keys normalize underscores to hyphens and use lowercase (`en_GB` becomes `en-gb`). Resolve links with the variant's original `getLocale()` value, not that normalized key: named localized lookup requires an exact locale.
- Language, optional script/region, and explicitly declared `x-default` shapes are supported. Unsupported shapes or duplicate normalized locale keys fail discovery; applications remain responsible for using assigned language/region codes.
- A primary path without a locale remains an entry but does not invent an alternate or `x-default`. An explicit `x-default` route locale requires compatible application locale handling; an application may instead add its own fallback alternate during generation.
- Translated slugs and record availability belong to the application. If one translation is unavailable, remove both its URL entry and its link from every alternate map for that record.
- Localized variants share family sitemap declarations and generic metadata, including after cache hydration. Redirect aliases are never alternates.

See `lsr-localization` for catalog IDs, language selection and link-generation coordination.

## Attribute Routes

Configured controller directories are scanned recursively for method attributes such as `Get`, `Post`, `Put`, `Patch`, `Delete`, `Head`, `Options`, `Connect`, `Trace`, and generic `Route`.

Use either route files or attributes according to the application's established ownership. Do not duplicate the same route in both. Route files are usually clearer for domain grouping, shared middleware, localization, and a navigable route map.

For sitemap declarations, use method attributes `#[Sitemap(...)]` and `#[SitemapExclude]`; exclusion wins when both appear. For generic metadata, use the independent `#[Meta([...])]` attribute, which works without any sitemap declaration and applies to non-GET routes too:

```php
use Lsr\Core\Routing\Attributes\Get;
use Lsr\Core\Routing\Attributes\Meta;
use Lsr\Core\Routing\Attributes\Sitemap;
use Nyholm\Psr7\Response;
use Psr\Http\Message\ResponseInterface;

#[Get('/articles', 'articles.index')]
#[Sitemap('articles', priority: 0.6, changefreq: 'weekly')]
#[Meta(['section' => 'articles'])]
public function index(): ResponseInterface
{
	return new Response(200, ['Content-Type' => 'text/html; charset=utf-8'], '<h1>Articles</h1>');
}
```

Metadata and sitemap attributes apply to every route declared on that method. `Sitemap` has no generic metadata argument; use `Meta` instead.

## Names and Cache

Name every route used by redirects or links. Names are globally unique; conflicting routes fail within their final host, method and path, not merely because another host uses the same path.

`Router::setup()` first loads a valid compiled PHP route artifact. Otherwise it loads route files and controller attributes, resolves middleware groups and service references, finalizes domains on 0.5.0+, and compiles the artifact when `cache.autoCompile` is enabled.

The artifact contains the finalized matcher tree and scalar service identifiers. Direct middleware, validators, object handlers, and serializable closures use an object pool for backward compatibility; prefer DI service references for dependency-bearing objects. `cache.checkTimestamps` also tracks route-file and controller-directory membership, but is disabled by default to avoid production filesystem scans.

Generic metadata and sitemap settings are cached separately. Group defaults are flattened into route declarations; unspecified inclusion remains unspecified so the current Router's policy is applied even when reusing a cache compiled under another policy. Localized paths retain their logical family relationship rather than frozen metadata copies. Incompatible cache formats are rejected and route sources are loaded again.

Since routing 0.5.0, compiled format **4** also stores resolved host constraints, per-host trees and aliases. Earlier artifacts are rejected and rebuilt. Warm loading does not rerun declarations: rebuild on every domain mapping change, including environment-derived targets even when source timestamps are unchanged. Keep caches deployment-specific and restart long-running workers after route changes.

Compile or remove the artifact explicitly with:

```sh
php bin/console routes:cache:compile
php bin/console routes:cache:clean
```

`routes:cache:clear` is an alias for `routes:cache:clean`. Explicit compilation fails with diagnostics when an object cannot be serialized. Automatic compilation failure leaves the already-loaded live routes usable and does not replace a valid cache with an incomplete file.

## Verification

- Force route loading and check duplicate-name/path failures.
- Resolve representative static, parameterized, optional, localized, and method-mismatch requests.
- Verify middleware order and parameter validators.
- Generate named links for every supported locale and test legacy redirects.
- Exercise routes through the real HTTP runtime; route-tree construction alone does not verify controller binding.
- Verify `getMeta()` on non-GET and sitemap-excluded routes, shallow inheritance, explicit null values, and late group overrides.
- Compare live and cached sitemap discovery under both inclusion policies, including named maps and localized variants.
- Generate application-owned XML and check one URL per available translation, complete reciprocal/self-referencing alternate maps, and fully qualified links.
- On 0.5.0+, exercise identical paths on two hosts, unknown-host unrestricted fallback, hostless calls, wrong-host misses, per-method fallback, HEAD/OPTIONS/405 isolation and alias/literal collisions after final resolution.
- Compare cold/warm domain matching and links; verify cross-host redirects and menu active state. Alternate hosts through the same runtime/generator, including same-path controllers with different argument types.
