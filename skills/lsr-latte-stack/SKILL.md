---
name: lsr-latte-stack
description: Use for LSR app Latte templating with LSR Latte services, templates, layouts, custom tags/filters/functions, assets, CSRF/link/lang helpers, sandbox rendering, and optional Inertia shell integration.
---

# LSR Latte Stack Workflow

## Read First

- Latte config: `config/di/extensions/latte.neon`.
- Templates: `templates`.
- Main layout: `templates/@layout.latte`.
- Inertia shell template: `templates/pages/index.latte`.
- LSR Latte wrapper: `vendor/lsr/core/src/Templating/Latte.php`.
- LSR Latte extension: `vendor/lsr/core/src/Templating/LatteExtension.php`.
- App Latte extension: `src/Latte/LacExtension.php`.
- Latte nodes: `vendor/lsr/core/src/Templating/Nodes`.
- Assets config: `config/di/extensions/assets.neon`.

## Rendering

- Controllers can render Latte through `Controller::view($template)`.
- `Lsr\Core\Templating\Latte::view()` and `viewToString()` resolve templates from `TEMPLATE_DIR` and append `.latte`.
- Template names should omit the `.latte` suffix, for example `pages/index`.
- Missing templates throw `TemplateDoesNotExistException`.
- `Controller::init()` provides common params such as `page`, `app`, `request`, `errors`, `notices`, and `flashMessages`.

## Template Parameters

- Prefer `Lsr\Core\Controllers\TemplateParameters` subclasses for template/page parameters. They are the default choice for type safety.
- Plain arrays are fine for small server-rendered templates.
- Keep controller-only/framework objects out of frontend-facing serialized props.

## Tags, Filters, and Functions

LSR core extension provides tags/functions such as:

- `{link ...}` / `link(...)` for route links.
- `{getUrl ...}` / `getUrl(...)` for base URLs.
- `{lang ...}` and `|lang` for translations.
- `{csrf ...}` and `{csrfInput ...}` for CSRF tokens.
- `{svgIcon ...}`, `{logo ...}`, and alert tags.
- `{tracyDump ...}` for debug dumps.

App extension `App\Latte\LacExtension` is treated as a stable extension point and provides:

- filters/functions: `json`, `xml`, `csv`.
- `escapeJs` filter for values embedded in scripts.

## Assets

- Nette assets extension is configured in `config/di/extensions/assets.neon`.
- `templates/@layout.latte` uses `n:asset` for favicon/manifest assets.
- Use `{asset 'assets/css/tailwind.css'}`, `{asset 'assets/css/app.scss'}`, and `<script n:asset="assets/js/app.ts" type="module"></script>` style patterns for Vite/Nette asset integration.

## Sandbox

- `Lsr\Core\Templating\Latte` configures Latte sandbox policy.
- Sandbox rendering methods include `sandbox`, `sandboxToString`, `sandboxFromString`, and `sandboxFromStringToString`.
- Allowed sandbox tags include `svgIcon`, `link`, `getUrl`, and `lang`; functions include `sprintf` and `lang`.
- Use sandbox rendering only when rendering user/admin-editable template strings or other untrusted template content.

## Inertia Notes

- This skill is not dependent on Inertia.
- Inertia initial page rendering uses Latte only as a shell template, usually `templates/pages/index.latte`.
- Inertia-specific props, partial reloads, and headers belong in the `lsr-inertia-backend` skill.

## Validation

```sh
composer cbf
composer phpstan
composer cs
composer test
pnpm run build
```
