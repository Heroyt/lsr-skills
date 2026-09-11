---
name: lsr-localization
description: Use for LSR internationalization/localization with native gettext, PO/MO catalogs, contexts/plurals/domains, localized routes, sitemap hreflang alternatives and Latte, plus optional NEON source-copy catalogs, vue3-gettext, Inertia locale synchronization, and the boundary with ORM-owned multilingual content.
---

# LSR Localization with Gettext

LSR's native gettext implementation is the backend UI-message translation authority. For Inertia + Vue 3, use the same gettext translations through `vue3-gettext`; do not create a separate UI translation system. Applications optionally using `lsr/text-catalog` and `lsr-text-catalog` should also follow [lsr-text-catalog](../lsr-text-catalog/SKILL.md) for NEON source ownership, compiler artifacts and injected adapters. Neither package replaces application-owned locale selection. Database-backed multilingual content is a separate responsibility; see [ORM-owned content](#database-backed-multilingual-content).

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
- formatting through the shared `format` argument: numeric keys use positional `sprintf`, while string keys use
  vue-gettext-compatible named placeholders.

Latte exposes LSR translation tags/functions/filters through the installed extensions. Prefer those over direct catalog access in templates.

## Catalog Layout

Use PO files as the translator-edited source of truth for translations. With the optional text-catalog pipeline, NEON owns canonical source copy and semantic keys; PO owns translated text, not the source definitions:

```text
languages/
  UI.pot
  cs_CZ/LC_MESSAGES/UI.po
  en_GB/LC_MESSAGES/UI.po
```

For direct-gettext applications, commit PO catalog sources; native gettext consumes compiled MO files and Vue consumes generated JSON bundles. Compile both from PO during the application's Docker/CI build and copy them into the runtime artifact. Never hand-edit generated artifacts. With text-catalog packages, also commit canonical NEON sources and use the package's PHP/gettext/TypeScript/manifest outputs instead of assuming locale JSON is the frontend contract.

Keep system/application UI in gettext. Keep administrator-authored multilingual content in explicit database fields/tables and editing interfaces; it is not a gettext catalog entry.

### Database-Backed Multilingual Content

For administrator/user-authored content, `lsr/orm` **0.3.23+** offers the opt-in `#[Translations]` relation and `TranslationCollection<T>`. Follow [lsr-orm](../lsr-orm/SKILL.md#owned-locale-keyed-content-0323) for complete ordinary parent/child declarations, migration constraints, exact writes, whole-row fallback, batch loading and cache lifecycle. Older installed ORM versions do not have this feature: inspect the application's lock file and installed source before adopting it. Updating a skill does not migrate an application or publish/install a package.

- Store source/default-language content as a row alongside other locales, not in gettext/PO or NEON UI source catalogs.
- Select supported locale keys and fallback order in the application. The collection never reads the active gettext, route or Inertia locale, nor normalizes case, whitespace or underscore/hyphen spellings. Map representations explicitly and keep SQL collation/uniqueness consistent with exact stored keys.
- Use `find($locale)` for an exact row or `null`; `resolve([$requested, $default])` selects the first existing whole row without per-field fallback. Preserve the actual returned row's locale in output.
- Editing must use exact lookup and explicit child save. A resolved fallback is a real writable row; saving it would edit the fallback language. `create()` makes an unsaved child and requires a persisted parent; saving the parent never saves translations.
- Batch known locales with `withTranslations()` rather than causing one lookup per parent. Translation relations are omitted by default from `Model::jsonSerialize()` even when loaded; expose intentional DTO fields.
- Locale switching does not itself refresh content state. ORM mutation invalidation is in-process, and raw/external writers require explicit cache/instance lifecycle management; do not retain content models across requests/jobs.

## Extraction and Compilation

For direct-gettext catalogs without the text-catalog packages, own the full update in one deterministic project script:

1. extract PHP/Latte messages;
2. optionally extract Vue/TypeScript through the installed `vue3-gettext` CLI;
3. merge templates (`msgcat`/`msguniq` or equivalent);
4. update locale PO files with `msgmerge`;
5. validate syntax, placeholders, plurals, obsolete/fuzzy policy;
6. compile PO -> MO with `msgfmt` for PHP;
7. compile the same PO -> locale JSON for Vue.

Expose clear scripts such as `i18n:extract`, `i18n:validate`, and `i18n:compile`; make them idempotent and run validation/compilation in CI.

For package-owned catalogs, use `TextCatalogCompiler` instead: it loads NEON, maintains POT/PO with semantic-key contexts, validates translations, and produces MO plus the PHP cache and optional `catalog.ts`, `catalog.compiled.ts`, and format-v1 `catalog.build.json`. Follow [lsr-text-catalog](../lsr-text-catalog/SKILL.md) for the build contract. Do not extract compiled macros/generated output or independently run the generic PHP/Latte/Vue extractor against package-owned catalogs; keep any remaining direct-gettext catalogs under explicitly separate ownership.

For direct-gettext catalogs, `Translations` can collect missing messages at runtime when `CHECK_TRANSLATIONS` and Tracy/debug behavior enable it, then write PO/MO/POT through `updateTranslations()`. Treat this as a development bridge, not the preferred deterministic extractor or a writer for package-owned catalogs. Never enable catalog mutation in production workers.

The build must fail when catalog validation or compilation fails. Production startup must consume immutable compiled artifacts; it must not compile or mutate catalogs.

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

For direct-gettext applications using Vue 3/Inertia:

- install/configure `vue3-gettext` only in the application frontend;
- generate one JSON bundle per locale from the canonical PO files;
- lazy-load bundles where useful;
- use Composition API `useGettext()` and `$gettext`, `$pgettext`, `$ngettext`, `$npgettext` semantics;
- keep the frontend entrypoint limited to provider wiring;
- do not add a second reactive locale source.

With `lsr-text-catalog`, consume the package-generated catalog instead of creating a separate JSON/gettext provider. Create and install a catalog instance per Vue app and SSR request; synchronize its `gettext.current` from backend-owned locale props. Coordinate SSR/hydration locale and the application sanitizer's policy and resource lifetime as described in [lsr-text-catalog](../lsr-text-catalog/SKILL.md).

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

`lsr/core` 0.4.4 and newer supports vue-gettext-compatible placeholders directly through the existing `format`
argument:

```php
lang(
    'Player %{player} has %{ points } points',
    format: ['player' => $playerName, 'points' => $points],
);
```

Use either numeric or string keys, never both:

- numeric keys preserve positional `sprintf` formatting;
- string keys replace `%{name}` placeholders after translation, including repeated placeholders and whitespace inside
  the braces;
- values must be scalar or `null`;
- unresolved named placeholders remain unchanged;
- mixed key modes and non-scalar values throw `InvalidArgumentException`.

Never treat interpolated output as trusted HTML. For direct-gettext catalogs, add a build-time validator requiring each translation to preserve the exact placeholder-name set from its `msgid`/plural forms. The text-catalog compiler already validates its translations' placeholders; its HTML adapters additionally require an application sanitizer after translation and interpolation.

## Localized Routes

Use installed `lsr/routing` localized variants and `lsr/core` link generation. Do not duplicate a route per locale manually. Backend locale selection, generated links, canonical route, catalogs, and Inertia props must change as one request-level operation.

### Localized Sitemaps

With `lsr/routing` 0.4.2 or newer, use the declarations and discovery described in `lsr-routing` instead of traversing the Router's matcher tree or guessing paths. `getSitemapEntries($name)` returns one descriptor per canonical language path, with the same `hreflang => Route` alternative map on every descriptor, including self when a locale is declared.

Render according to [Google's localized sitemap requirements](https://developers.google.com/search/docs/specialty/international/localized-versions#sitemap): one `<url>`/`<loc>` per translated URL, an identical set of `<xhtml:link rel="alternate">` children on each, fully qualified URLs, and the XHTML namespace. The routing package does not render XML.

Alternative keys normalize `cs_CZ` to `cs-cz`; preserve the route's original `getLocale()` when calling exact localized link generation. Never infer `x-default` from a locale-neutral primary route. Declaring `x-default` as a route locale requires corresponding application locale handling; fallback links can also be added by the application generator.

Content availability and translated parameter values remain application-owned. Filter unavailable translations out of both URL entries and every alternative map for that record. Generic route hints are available through `$entry->route->getMeta()` independently of sitemap participation; sitemap settings live in `$entry->metadata`.


## Safety and Migration

- Prefer context over unnatural message IDs when one source string has multiple meanings.
- Use real plural forms; do not concatenate counts with a translated singular.
- Never render raw translated HTML or assume translators produce safe HTML. With text-catalog packages, only render explicit HTML keys through the sanitizer-backed HTML adapter; keep plain strings escaped.
- Migrate UI incrementally by vertical slice: singular + context + plural + placeholder + formatted value + language switch.
- Keep source-language fallback and missing-translation behavior explicit.
- Define whether CI completeness applies globally or only to production locales/features during migration.

## Verification

- The selected extraction/compiler pipeline is deterministic and idempotent; no competing writer modifies package-owned catalogs.
- Every PO validates and compiles to MO; direct-gettext Vue builds produce locale JSON, while text-catalog builds produce PHP and optional TypeScript/format-v1 manifest artifacts before frontend typechecking/build.
- PHP and Vue render equivalent singular, contextual, plural, and contextual-plural examples.
- Named placeholders match and interpolate identically.
- Backend locale drives route, PHP/Latte, Inertia props, Vue catalog instance/bundle, `<html lang>`, and `Intl` formatting.
- Two sequential RoadRunner requests with different locales remain isolated.
- Fuzzy/obsolete/missing entries follow the documented release policy.
- Localized sitemap URLs and alternate maps agree on available translations, include self/reciprocal links, and match before/after compiled-route cache hydration.
- Run backend tests/static analysis, frontend typecheck/tests/build, and a browser language-switch smoke flow.
