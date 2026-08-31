---
name: lsr-auth-session
description: Use for LSR app authentication and sessions with lsr/auth, App\Models\Auth\User, Auth service, login/logout/register flow, auth middleware, RedisSession, and flash messages.
---

# Auth + Session Workflow

## Read First

- Auth config: `config/di/extensions/auth.neon`.
- App user class: `src/Models/Auth/User.php`.
- Login route/controller/request/page: `routes/web.php`, `src/Http/Controllers/Auth/Login.php`, `src/Http/Requests/Auth/LoginRequest.php`, `assets/js/pages/Auth/Login.vue`.
- Session service: `src/Core/RedisSession.php`, `config/di/services-common.neon`.
- Auth service package: `vendor/lsr/auth/src/Services/Auth.php`.
- Auth middleware: `vendor/lsr/auth/src/Middleware/LoggedIn.php`, `LoggedOut.php`.
- Auth schema: `vendor/lsr/auth/migrations.neon`.

## Auth Service

- Inject `Lsr\Core\Auth\Services\Auth` when checking or changing auth state.
- `Auth::login($email, $password, $remember = false)` verifies against the configured user class table and stores serialized user data in session key `usr`.
- `Auth::logout()` removes the session user.
- `Auth::register($email, $password, $name = '')` hashes passwords with Nette `Passwords` and returns the created user or `null`.
- `Auth::getLoggedIn()` returns the current user or `null`; `loggedIn()` checks presence.
- `Auth::hasRight($right)` and `getRights()` delegate to the logged-in user.
- Default user roles/rights from `lsr/auth` can be overridden or extended for app-specific use cases. Do not treat the default role structure as fixed.

## User Model

- `config/di/extensions/auth.neon` sets `auth.userClass` to `App\Models\Auth\User`.
- The app user extends `Lsr\Core\Auth\Models\User` and sets `#[PrimaryKey('id_user')]`.
- Keep auth schema alignment with the package migrations unless intentionally extending user fields.
- For app-owned user extensions, update both the model and migrations.

## Middleware and Routes

- Use `LoggedOut` for pages only guests should see, such as login.
- Use `LoggedIn` for pages that require an authenticated user.
- Middleware is attached in `routes/web.php` through route groups or route-specific `->middleware(...)`.
- Redirect route names should match named routes in `routes/web.php`.

## Sessions and Flash Messages

- The app uses `App\Core\RedisSession`, wired as the `session` service with Redis in `services-common.neon`.
- Controllers can call `flashSuccess`, `flashError`, `flashWarning`, and `flashInfo`.
- `Controller::init()` exposes `flashMessages` to template/Inertia parameters.
- Session cookie handling goes through `App::cookieJar()` and LSR response cookie propagation.

## Validation

```sh
composer phpstan
composer cs
php ./bin/console app:create-user user@example.com
```
