---
name: lsr-latte-stack
description: Use for LSR server-rendered Latte templates, typed template parameters, core tags/functions, translation integration, sandbox rendering, custom extensions, assets, and optional Inertia shells.
---

# LSR Latte Stack

Use `lsr-localization` for gettext catalogs, locales, plurals/contexts, and PHP/Vue translation parity. Use `lsr-inertia-backend` when Latte only hosts the initial Inertia page shell.

## Read the Installed Stack

- `vendor/lsr/core/src/Templating/Latte.php`
- `LatteExtension.php` and `TranslatorExtension.php`
- the application's Latte/asset DI files
- layouts and the target template
- application-owned Latte extensions

Do not assume template directories, asset plugins, or custom filters from another LSR application.

## Rendering

`Lsr\Core\Templating\Latte` currently exposes `view()` and `viewToString()` for filesystem templates. `Lsr\Core\Controllers\Controller::view()` returns a response using the configured renderer.

- Pass template names in the format expected by the installed `Latte::getTemplate()` implementation.
- Prefer `TemplateParametersInterface` / `TemplateParameters` DTOs for stable page interfaces.
- Small private partials may use local arrays when their shape stays local.
- Escape at the rendering interface; do not pre-mark database, request, or translated text as safe HTML.

## Core Extension Surface

Current LSR core registers Latte tags including:

```text
alert, alertDanger, alertInfo, alertSuccess, alertWarning
csrf, csrfInput
getUrl, lang, link
logo, svgIcon, tracyDump
```

Functions include `csrf`, `getUrl`, `lang`, `link`, `logo`, and `svgIcon`; the translator extension also provides translation tags/filter behavior.

Check installed source before using these names. Application extensions should add only project-specific behavior and must be registered as Latte extension services in DI.

Keep custom extensions small:

- pure formatting belongs in filters/functions;
- structure-producing syntax belongs in a tag/node only when a function/partial is insufficient;
- never expose unsafe eval, filesystem, container, or arbitrary-call capabilities to templates.

## Layouts and Assets

Follow the application's established layout inheritance and asset integration. LSR core does not require a particular Vite/Nette-assets configuration.

- Put shared document structure in layouts.
- Put reusable presentation in components/partials.
- Keep controllers responsible for response/page orchestration, not HTML fragments.
- Resolve asset URLs through the installed asset integration; do not hard-code build hashes or deployment roots.

## Sandbox

Current `Latte` configures a safe policy and exposes:

- `sandbox()`
- `sandboxToString()`
- `sandboxFromString()`
- `sandboxFromStringToString()`

The installed policy currently allows all filters, only selected functions (`sprintf`, `lang`), and selected LSR tags (`svgIcon`, `link`, `getUrl`, `lang`). Re-read the installed policy before relying on it.

Use sandbox methods only for intentionally user/admin-authored templates. A sandbox is not permission to pass secrets or powerful objects into template parameters. Test that forbidden constructs fail.

## Inertia Shells

For an initial non-Inertia request, `lsr/inertia` renders a Latte shell containing the serialized page payload. Keep the shell limited to document metadata, root mount element, serialized Inertia page, and assets. Page props and partial reload semantics belong to `lsr-inertia-backend`.

Ensure `<html lang>` and server locale come from the same backend-owned locale contract used by the Inertia page.

## Verification

- Render through the actual controller/runtime, not only `Latte::renderToString()`.
- Check escaping, layout composition, missing template behavior, CSRF fields, links, assets, and locale.
- For sandbox changes, test allowed and rejected syntax.
- For visual changes, verify the rendered page in a browser.
- Run application static analysis, template checks, tests, and frontend build when the shell/assets changed.
