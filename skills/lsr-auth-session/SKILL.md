---
name: lsr-auth-session
description: Use for LSR authentication and session integration with lsr/auth, custom user models, login/register/logout, auth middleware, session storage, cookies, and authorization checks.
---

# LSR Authentication and Sessions

## Read the Local Contract

- Read `vendor/lsr/auth/services.neon`, `migrations.neon`, and `src/Services/Auth.php`.
- Read the application's included auth service config and migration root.
- Identify the concrete `Lsr\Interfaces\SessionInterface` service; do not assume native files or Redis.
- Read the concrete user model and any local role/right extensions.
- Read auth routes, controllers, request DTOs, and middleware wiring.

## Service and Schema Setup

`lsr/auth` ships service definitions rather than a Nette compiler extension. Include or reproduce the installed service configuration deliberately. Override the user class through the package parameter contract:

```neon
parameters:
	auth:
		userClass: App\Models\Auth\User
```

Include `vendor/lsr/auth/migrations.neon` from the application's modular migration root when using the package schema. Put application-owned auth extensions in a separate domain migration file; do not edit `vendor/`.

The concrete user class must remain compatible with `Lsr\Core\Auth\Models\User` and its table/primary-key expectations. Read the installed model before extending fields or role behavior.

## Auth Service

Inject `Lsr\Core\Auth\Services\Auth` or the application's typed specialization.

Current behavior:

- `login($email, $password, $remember)` returns `bool`, verifies via Nette `Passwords`, rehashes when needed, stores serialized user state under session key `usr`, and extends session parameters for remember-me.
- `logout()` removes `usr` and clears the in-memory user.
- `register($email, $password, $name)` may throw `DuplicateEmailException` and returns the created user or `null`.
- `getLoggedIn()` returns the current user or `null`.
- `loggedIn()`, `hasRight()`, and `getRights()` expose authentication/authorization state.

Do not expose which part of login failed. Never log or serialize plaintext passwords. Keep password validation at the request/application interface and hashing in the auth module.

## Middleware and Authorization

Package middleware:

- `Lsr\Core\Auth\Middleware\LoggedIn`
- `Lsr\Core\Auth\Middleware\LoggedOut`

Resolve middleware through DI when it has dependencies. Attach it through the application's route/group convention.

Authentication proves identity, not permission. Use `hasRight()` or an application authorization module for protected actions, and enforce it server-side even when Vue/Latte hides controls.

## Sessions and Cookies

`Auth` depends on `SessionInterface`. The application owns the storage adapter, expiry policy, cookie flags, and infrastructure.

- Use secure/HTTP-only/SameSite cookie settings appropriate to the deployment.
- Rotate or otherwise protect session identity according to the concrete session implementation.
- Scope remembered sessions explicitly.
- Do not put service objects or secrets in session values.
- Under long-running workers, ensure per-request session open/close and auth reinitialization follow the application's runtime lifecycle. Never let one request's auth object leak into the next.

Framework response handling propagates cookies through the LSR cookie/session flow. Verify this with the actual FPM or RoadRunner entrypoint in use.

## Verification

Cover:

- successful and failed login without account enumeration;
- password rehash;
- logout and session deletion;
- duplicate registration and validation failure;
- remembered vs normal expiry;
- `LoggedIn` / `LoggedOut` redirects or responses;
- authorization denial;
- isolation between sequential RoadRunner requests when applicable.

Run the application's auth tests, static analysis, and a real HTTP login/logout smoke flow.
