---
name: lsr-localization
description: Use for LSR internationalization/localization with native gettext, PO/MO catalogs, contexts/plurals/domains, localized routes and Latte, plus optional vue3-gettext and Inertia locale synchronization.
---

# LSR Localization with Gettext

LSR's native gettext implementation is the backend authority. For Inertia + Vue 3, prefer `vue3-gettext` as a compatibility layer over the same canonical catalogs; do not create a separate translation system.

## Read the Installed Backend

- `vendor/lsr/core/src/Translations.php`
- `vendor/lsr/core/include/functions.php`
- `src/Templating/{LatteExtension,TranslatorExtension}.php`
- `src/Links/Generator.php` and installed localized routing APIs
- the application's `LANGUAGE_DIR`, `LANGUAGE_FILE_NAME`, `CHECK_TRANSLATIONS`, and translation config
- catalog/build scripts and existing PO/MO files

Current core DI options live under:

```neon
lsr:
	translations:
		defaultLang: cs_CZ
		supportedLanguages:
			- cs_CZ
			- en_GB
		domains:
			- UI
```

Read `LsrExtension::getConfigSchema()` for the installed version.

## Backend Translation Interface

The global helper delegates to `Lsr\Core\Translations::translate()`:

```php
lang(
	msg: 'hráč',
	plural: 'hráči',
	num: $count,
	context: 'team roster',
	domain: 'UI',
	format: [],
);
```

Current semantics support:

- singular through `gettext` / `dgettext`;
- plural through `ngettext` / `dngettext`;
- context by gettext's `context\004message` convention;
- configured domains;
- optional positional `sprintf` formatting after translation.

Latte exposes LSR translation tags/functions/filters through the installed extensions. Prefer those over direct catalog access in templates.

## Catalog Layout

Use PO files as the translator-edited source of truth:

```text
languages/
  UI.pot
  cs_CZ/LC_MESSAGES/UI.po
  en_GB/LC_MESSAGES/UI.po
```

Native gettext consumes compiled `UI.mo`. Do not edit MO or generated Vue JSON manually.

Keep system/application UI in gettext. Keep administrator-authored multilingual content in explicit database fields/tables and editing interfaces; it is not a gettext catalog entry.

## Extraction and Compilation

Own the full update in one deterministic project script:

1. extract PHP/Latte messages;
2. optionally extract Vue/TypeScript through the installed `vue3-gettext` CLI;
3. merge templates (`msgcat`/`msguniq` or equivalent);
4. update locale PO files with `msgmerge`;
5. validate syntax, placeholders, plurals, obsolete/fuzzy policy;
6. compile PO -> MO with `msgfmt` for PHP;
7. compile the same PO -> locale JSON for Vue.

Expose clear scripts such as `i18n:extract`, `i18n:validate`, and `i18n:compile`; make them idempotent and run validation/compilation in CI.

`Translations` can collect missing messages at runtime when `CHECK_TRANSLATIONS` and Tracy/debug behavior enable it, then write PO/MO/POT through `updateTranslations()`. Treat this as a development bridge, not the preferred deterministic extractor. Never enable catalog mutation in production workers.

Follow the application's policy on committing generated MO/JSON. Whatever the choice, builds must reproduce them from PO.

## Locale Representations

Keep three representations explicit:

| Purpose | Czech | English |
| --- | --- | --- |
| gettext/catalog/OS locale | `cs_CZ` | `en_GB` |
| HTML, HTTP, browser `Intl` | `cs-CZ` | `en-GB` |
| URL segment when used | `cs` | `en` |

Create one typed mapping module. Never pass underscore gettext IDs to `<html lang>` or browser `Intl` APIs.

Gettext translates messages; it does not format dates/numbers. Centralize `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat`, and locale-aware collation using the active BCP 47 locale. Keep protocol/storage formats locale-independent.

## Optional Vue 3 Compatibility Layer

When the app uses Vue 3/Inertia:

- install/configure `vue3-gettext` only in the application frontend;
- generate one JSON bundle per locale from the canonical PO files;
- lazy-load bundles where useful;
- use Composition API `useGettext()` and `$gettext`, `$pgettext`, `$ngettext`, `$npgettext` semantics;
- keep the frontend entrypoint limited to provider wiring;
- do not add a second reactive locale source.

The backend owns active locale. Shared Inertia props should include at least:

```ts
interface LocaleProps {
  catalogLocale: string // cs_CZ
  browserLocale: string // cs-CZ
  defaultLocale: string
  supportedLocales: Array<{
    catalog: string
    browser: string
    label: string
    url?: string
  }>
}
```

Initialize Vue from the first page and synchronize/lazy-load before displaying a subsequent page with a changed locale. A language switch must visit a backend-owned localized/canonical URL; changing Vue state alone leaves PHP, routes, session/cookie, `<html lang>`, and formatting inconsistent.

## Named Placeholder Compatibility

`vue3-gettext` commonly uses named placeholders such as `%{player}`. Current LSR backend formatting uses positional `sprintf`. Until the framework exposes shared named interpolation, add an application-owned adapter that:

- retrieves singular/context/plural/domain translations through LSR/gettext without positional formatting;
- replaces `%{name}` from an explicit scalar map;
- exposes plural count as an agreed named parameter;
- fails clearly on missing/extra placeholders in development/tests;
- never treats interpolated output as trusted HTML.

Add a build-time validator requiring each translation to preserve the exact placeholder-name set from its `msgid`/plural forms. Keep the adapter's interface aligned with gettext semantics so it can later move into a dedicated LSR package without changing callers.

## Localized Routes

Use installed `lsr/routing` localized variants and `lsr/core` link generation. Do not duplicate a route per locale manually. Backend locale selection, generated links, canonical route, catalogs, and Inertia props must change as one request-level operation.

## Safety and Migration

- Prefer context over unnatural message IDs when one source string has multiple meanings.
- Use real plural forms; do not concatenate counts with a translated singular.
- Never use translated `v-html` or assume translators produce safe HTML.
- Migrate UI incrementally by vertical slice: singular + context + plural + placeholder + formatted value + language switch.
- Keep source-language fallback and missing-translation behavior explicit.
- Define whether CI completeness applies globally or only to production locales/features during migration.

## Verification

- PO extraction/merge is deterministic and idempotent.
- Every PO validates and compiles to MO and optional Vue JSON.
- PHP and Vue render equivalent singular, contextual, plural, and contextual-plural examples.
- Named placeholders match and interpolate identically.
- Backend locale drives route, PHP/Latte, Inertia props, Vue bundle, `<html lang>`, and `Intl` formatting.
- Two sequential RoadRunner requests with different locales remain isolated.
- Fuzzy/obsolete/missing entries follow the documented release policy.
- Run backend tests/static analysis, frontend typecheck/tests/build, and a browser language-switch smoke flow.
