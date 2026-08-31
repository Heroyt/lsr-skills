---
name: lsr-request-flow
description: Use for LSR app HTTP request flow work: routes, middleware, controllers, Inertia responses, request validation DTOs, route params, and controller argument mapping.
---

# Request Flow Workflow

## Read First

- Routes: `routes/web.php`.
- Controllers: `src/Http/Controllers`.
- Request DTOs: `src/Http/Requests`.
- Page/template parameters: `src/Http/Templates`.
- Middleware example: `src/Core/Middleware/CSRFCheck.php`.
- Request resolver: `vendor/lsr/core/src/RouteHandler.php`.
- Router API: `vendor/lsr/routing/src/RouteGroup.php`, `Route.php`, `Middleware.php`.

## Routing

- Define app routes in `routes/web.php`.
- The file is executed with the router as `$this`.
- Use groups for shared prefixes and middleware:

```php
$routes = $this->group('/')->middlewareAll($inertiaMiddleware);
$routes->get('/dashboard', [Dashboard::class, 'show'])->name('dashboard');
```

- Available group methods include `get`, `post`, `put`, `update`, `delete`, `group`, `middleware`, `middlewareAll`, `name`, and `param`.
- Name routes that are redirected to or linked from other code.
- Resolve middleware services from DI for shared middleware; instantiate simple route-specific middleware only when it has local constructor data.

## Controllers

- Controllers extend `Lsr\Core\Controllers\Controller`.
- Inertia controllers use `Lsr\Inertia\Http\WithInertia` and return `$this->inertia('Page/Name')`.
- Return `Psr\Http\Message\ResponseInterface` from controller actions.
- Set `$this->title` and `$this->params` before rendering when the page/template needs them.
- Use `$this->redirect('route.name')` for named-route redirects where possible.

## Controller Argument Mapping

`Lsr\Core\RouteHandler` resolves action arguments as follows:

- Scalars are read from route params by argument name.
- `Lsr\Interfaces\RequestInterface` or an implementing request class receives the current request.
- `Lsr\Orm\Model` subclasses can be used directly as controller action arguments. `RouteHandler` loads them with `Model::get((int) $id)`.
- For model arguments, name route placeholders `<argumentName>Id`, for example route `/admin/task-pairs/{taskPairId}` with action `edit(TaskPair $taskPair)`. The resolver checks `<argumentName>Id`, lowercase variants, and finally `id`.
- A required model argument that cannot be found becomes a routing model-not-found exception; nullable/optional model arguments may receive `null`.
- Classes marked with `#[Lsr\Core\Attributes\MapRequest]` are mapped from query params for GET requests and parsed body for other methods.
- Other classes are resolved from DI by type.

## Request DTOs

- Put request DTOs under `src/Http/Requests/<Feature>`.
- Request DTOs are specific mapped HTTP DTOs. Keep them separate from generic serializer/read DTOs.
- Use public typed properties with `Lsr\ObjectValidation\Attributes`, for example `#[Required]` and `#[Email]`.
- Add a `validate()` method only for cross-field/business validation that cannot be expressed by attributes.
- Use framework defaults for validation failure handling unless the feature explicitly requires custom behavior.
- In controller actions, request mapping should look like:

```php
public function store(
    #[MapRequest]
    StoreThingRequest $request,
): ResponseInterface {
    // ...
}
```

## Template Parameters

- Prefer `Lsr\Core\Controllers\TemplateParameters` subclasses under `src/Http/Templates` for page/template parameters.
- Use arrays only for very small/simple templates where type safety does not add value.

## Middleware

- Middleware implements `Lsr\Core\Routing\Middleware` or PSR-15 `MiddlewareInterface`.
- Use `process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface`.
- Return early for denied/invalid requests; otherwise call `$handler->handle($request)`.
- For JSON-style error responses, `MiddlewareResponder` and `Lsr\Core\Requests\Dto\ErrorResponse` are available.

## Validation

```sh
composer phpstan
composer cs
php ./bin/console routes:list
```

If route resolution is relevant, also use:

```sh
php ./bin/console routes:resolve <path>
```
