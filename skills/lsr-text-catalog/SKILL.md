---
name: lsr-text-catalog
description: Use for lsr/text-catalog and @lsr/text-catalog integration, canonical NEON source copy, gettext PO compilation, typed Vue runtime facades, strict compiled Vite macros, artifact validation, HTML safety and app/request isolation.
---

# LSR Text Catalog

Use this skill when adding or changing semantic copy keys, compiling NEON/gettext catalogs, wiring the optional PHP DI/command adapter, consuming generated Vue types, or diagnosing runtime/compiled-mode and catalog HMR failures.

This is a source-copy and compilation seam, not a replacement for application-owned locale selection. Use [localization](../lsr-localization/SKILL.md) for native gettext setup, PO/MO conventions, locale mappings, routes and language switching; [Vue/Inertia](../lsr-vue-inertia/SKILL.md) for the optional frontend/SSR application lifecycle.

## Establish the Installed Contract

Read the consumer's manifests/locks and actual installed exports before adapting examples:

- PHP package README and `composer.json`; `src/{CatalogConfig,TextCatalogLoader,TextCatalog,TextCatalogCompiler}.php`.
- Optional `src/Di/TextCatalogExtension.php`, `src/Console/CompileTextCatalogCommand.php` and `src/Translation/TextTranslator.php`.
- npm README and `package.json`; `src/{types,language}.ts`, `src/{runtime,compiled}/index.ts`, and `src/vite/{index,manifest,transform}.ts`.
- Consumer compiler entrypoint, source/PO directories, generated output, real facades, Vite root/aliases and typecheck/build scripts.

The packages are independently installed and versioned: Composer `lsr/text-catalog` and npm `@lsr/text-catalog`. Read each installed manifest for its package version; artifact format **1** is a separate compatibility contract. Tags and installation instructions do not establish registry publication; verify availability before selecting a registry version.

- PHP requires **>=8.5**, `ext-dom`, `ext-libxml`, `nette/neon ^3.4` and `gettext/gettext ^5.7`. Do not reuse the older PHP >=8.4 floor of current LSR core/console packages.
- Loading/compiling needs no LSR framework, DI container, native gettext extension, Node, Vue or Redis. The native translator alone needs `ext-gettext`.
- Optional integrations require `nette/di ^3.2` and/or `symfony/console ^7.4 || ^8.0`; `lsr/console ^0.2` is optional command discovery, not a compiler requirement.
- npm is ESM, requires Node `^20.19.0 || >=22.12.0`, Vue `^3.5.42` and vue3-gettext `^4.0.1`. `/vite` needs optional peer Vite `^8.2.2`; browser `/runtime`, `/compiled` and `/types` exports do not import the Node plugin.
- Runtime-only consumers can use prebuilt data without PHP compilation, Vite or LSR. No sanitizer is bundled or required for plain text.

## Own Source, Translations and Outputs Separately

Canonical source-language copy belongs in NEON; translators own non-source-locale PO translations. Do not interpret the localization skill's PO ownership as moving canonical source copy out of NEON.

For `copy/example.neon`:

```neon
example:
    title: 'Welcome %{name}'
    count:
        one: '%{count} item'
        plural: '%{count} items'
    rich:
        html: '<strong>%{name}</strong>'
```

Directory/file names and nested key segments are camelCase. Each file has exactly one root matching its basename; relative directories prefix the semantic key. This produces `example.title`, `example.count.one`, `example.count.plural` and HTML key `example.rich`, not `example.rich.html`.

- Leaves are nonempty strings. `html` and the sibling pair `one`/`plural` are reserved shapes, not ordinary nested names; incomplete shapes fail.
- Plural forms must have identical named placeholder sets. HTML source validation restricts markup/attributes/links; it does not make translated or interpolated output safe.
- The compiler owns the domain POT, merges PO entries by semantic context, and emits MO, PHP cache and optional frontend files. Choose a dedicated catalog domain; do not mix unrelated extraction pipelines into its PO files.
- Singular gettext context is the semantic key; plural context is the parent, such as `example.count`. Source-locale translations are regenerated from NEON. Existing target translations/comments/flags are preserved; source changes or revived entries become fuzzy, removed entries become obsolete.
- **All configured locales must have complete, non-fuzzy active translations and plural forms with matching placeholders.** A failed compile publishes neither updated PO/POT nor other artifacts. Prepare translator PO entries at `languages/<locale>/LC_MESSAGES/<domain>.po` before adding a target locale; do not expect a failed compile to create empty translation files for editing.
- Version canonical NEON and translator PO inputs. POT, MO, PHP cache, generated TypeScript and the manifest are reproducible outputs, not hand-edited copy. Deploy coherent immutable artifacts; never compile or mutate PO files during production requests.

## Standalone PHP First

A consumer-owned `compile.php` at the project root can be independent of application bootstrap:

```php
<?php
require __DIR__ . '/vendor/autoload.php';

use Lsr\TextCatalog\CatalogConfig;
use Lsr\TextCatalog\TextCatalogCompiler;
use Lsr\TextCatalog\TextCatalogLoader;

$config = new CatalogConfig(
    sourceDirectory: __DIR__ . '/copy',
    cacheFile: __DIR__ . '/var/catalog.php',
    languageDirectory: __DIR__ . '/languages',
    sourceRoot: __DIR__,
    domain: 'example',
    locales: ['en_US'],
    sourceLocale: 'en_US',
    frontendDirectory: __DIR__ . '/generated',
);
$loader = new TextCatalogLoader($config->sourceDirectory);
$result = new TextCatalogCompiler($loader, $config)->compile();
```

This source-only example can compile before translator POs exist. Add prepared target locales to both PHP and frontend configurations together. `locales` must be a nonempty unique list containing `sourceLocale`. Paths are local filesystem paths; prefer absolute paths in PHP. `sourceRoot` controls source references. `potFile` defaults to `<languageDirectory>/<domain>.pot`; set `frontendDirectory: null` for PHP-only output.

`TextCatalog` is source lookup, not translation or interpolation:

```php
$catalog = new Lsr\TextCatalog\TextCatalog(
    $loader, $config->cacheFile, useCompiledCache: true,
);
$source = $catalog->text('example.title'); // Welcome %{name}
```

It also exposes `has()`, `isHtml()` and `all()`. It memoizes the selected definition; it does not check freshness or compile during lookup. With `useCompiledCache: true`, an absent cache still loads source NEON; a malformed existing cache fails. Deploy the cache explicitly rather than treating this switch as a deployment check. PHP caches are trusted executable build output; restart/recreate application-owned catalog services when replacing them.

### Optional DI and Console

Follow [application DI](../lsr-app-di/SKILL.md) and [console](../lsr-console/SKILL.md), not a new bootstrap convention:

```neon
extensions:
    textCatalog: Lsr\TextCatalog\Di\TextCatalogExtension
```

The sibling `textCatalog:` configuration takes the same named fields as `CatalogConfig`, including optional `potFile`/`frontendDirectory`, plus `useCompiledCache` and `command` (both default `false`). With this extension name, services are `textCatalog.config`, `.loader`, `.catalog` and `.compiler`; `command: true` additionally registers `.command`.

`CompileTextCatalogCommand($compiler)` is named `texts:cache:compile`. Add it to a consumer-owned Symfony Console application or let installed LSR console discover its DI service. There is no package-provided `bin/console`, automatic application boot or global helper registration. Verify command discovery before using `php bin/console texts:cache:compile`; compilation failures must retain a nonzero exit status.

### Native Translation and HTML

Inject `Lsr\TextCatalog\Translation\TextTranslator($catalog, domain: 'example', sanitizeHtml: $applicationSanitizer)`; the sanitizer is an application-supplied callable, not a package helper. Omit it for plain-text-only use.

- `langText('example.title', format: ['name' => 'Ada'])` translates with the semantic context, then interpolates.
- `langText('example.count.one', 'example.count.plural', 3, ['count' => 3])` uses sibling plural keys and their parent context.
- PHP supports named `%{name}` placeholders or numeric `sprintf` arguments, never mixed key modes. Plain output remains unescaped data: render through normal escaping.
- `langHtmlText('example.rich', ['name' => $untrustedName])` checks HTML eligibility, translates/interpolates, then sanitizes the **final output**. Missing sanitizer rejects the call. Never raw-render `text()` or `langText()` output or trust translation/source validation alone.

The application owns `setlocale`, environment, gettext domain binding and encoding. Creating a translator does not isolate process-global native gettext state. Verify sequential locale resets on the actual deployment platform; concurrent native locale mutation needs serialization or isolated workers. Use [long-running runtime guidance](../lsr-roadrunner-runtime/SKILL.md) rather than assuming a new adapter instance resets native caches.

## Generated Authoring Files and Runtime Facade

Frontend generation emits ordinary consumer-owned files:

| File | Contract |
| --- | --- |
| `catalog.ts` | Source map/lookup, `TextKey`, `HtmlTextKey`, `htmlTextKeys`, locales and contextual translations. |
| `catalog.compiled.ts` | Key unions, locales/translations and declaration-only `text` macro; no runtime source map. |
| `catalog.build.json` | Format 1 identity, source/HTML/plural snapshot, artifact SHA-256 digests and generation digest. |

Generated types import `@lsr/text-catalog/types`. Keep files resolvable by ordinary TypeScript before Vite starts: **generate before standalone `tsc`/`vue-tsc`**. Do not replace them with Vite-only virtual declarations or invent a globally registered key union.

Create a real consumer facade, for example `src/copy.ts`:

```ts
import * as generated from '../generated/catalog.js';
import { createRuntimeCatalog } from '@lsr/text-catalog/runtime';

export const {
  text, langText, langTextPlural, langHtmlText, createCatalog, installCatalog,
} = createRuntimeCatalog(generated);
export type { TextKey, HtmlTextKey } from '../generated/catalog.js';
```

Runtime is the default and supports typed dynamic keys. `text(key)` only returns source copy; `langText` and `langTextPlural` translate/interpolate. HTML membership is checked at runtime, and HTML calls throw without a sanitizer. Supply an application sanitizer through `createRuntimeCatalog({ ...generated, sanitizeHtml })` or per-instance options; never use an identity/no-op sanitizer to make HTML calls pass.

Create/install fresh mutable state for **each Vue app and SSR request**:

```ts
import { createSSRApp } from 'vue';
import App from './App.vue';
import { createCatalog, installCatalog } from './copy.js';

const app = createSSRApp(App);
const copy = createCatalog({ locale: 'en_US' });
installCatalog(app, copy);
```

Use the application's selected configured locale, not a second language-selection authority. Update that instance through `copy.gettext.current` when application locale changes; keep backend, routes, HTML language and `Intl` mappings synchronized. Match initial locale, translations and sanitizer policy between SSR and hydration. Request-specific sanitizer/DOM lifetimes can use `createCatalog({ locale, sanitizeHtml })`.

Each instance clones nested translation/plural data; each facade has its own injection key. Imported helpers select the current app **at invocation**, not module initialization. Outside injection context they use a private fixed source-language fallback; locale-sensitive non-Vue runtime code must call explicit instance helpers. Compiled instances expose `gettext` and `htmlPgettext`, not runtime key lookup helpers. Never store one request's mutable instance in a module singleton.

Use Composition API and escaped rendering:

```vue
<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { langText, langTextPlural } from './copy.js';

const count = shallowRef(3);
const label = computed(() => langText('example.title', { name: 'Ada' }));
</script>

<template>
  <h1>{{ label }}</h1>
  <p>{{ langTextPlural('example.count.one', 'example.count.plural', count, { count }) }}</p>
</template>
```

Only deliberately declared HTML passed through `langHtmlText` with the final-output sanitizer may reach raw rendering such as `v-html`. The package imposes no application-specific HTML policy or sanitizer dependency.

## Vite Runtime Default and Strict Compiled Opt-In

Use the same explicit paths, domain and **ordered locale list** as PHP. Paths are relative to Vite root (or explicit plugin `root`) unless absolute; input directories must not overlap `frontendDirectory`.

```ts
import { execFileSync } from 'node:child_process';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { textCatalog } from '@lsr/text-catalog/vite';

export default defineConfig({
  plugins: [
    textCatalog({
      mode: 'runtime',
      sourceDirectory: 'copy',
      languageDirectory: 'languages',
      frontendDirectory: 'generated',
      facade: 'src/copy.ts',
      domain: 'example',
      sourceLocale: 'en_US',
      locales: ['en_US'],
      compile(root) {
        execFileSync('php', ['compile.php'], { cwd: root, stdio: 'inherit' });
      },
    }),
    vue(),
  ],
});
```

The consumer owns the compiler callback, command, environment and bootstrap; it may return a promise. PHP is needed only when that callback invokes it. Prebuilt runtime consumers need not use this plugin.

To opt into `mode: 'compiled'`, also set `compiledFacade: 'src/copy.compiled.ts'` and create that distinct file:

```ts
import * as generated from '../generated/catalog.compiled.js';
import { createCompiledCatalog } from '@lsr/text-catalog/compiled';

export const {
  pgettext, npgettext, htmlPgettext, createCatalog, installCatalog,
} = createCompiledCatalog(generated);
```

Apply the same application sanitizer policy to both facades/instances when HTML is enabled. Keep authored imports pointed at `src/copy.ts`; Vite resolves aliases/symlinks canonically, redirects bootstrap/adapter imports, and expands literal-key calls before Vue. `text` becomes source literals; translated calls use contextual adapters. There is **no runtime lookup-map fallback**. The source-language translation fallback outside injection is a different concern.

Compiled calls require literal keys, direct helper calls and valid sibling plural/HTML membership. Dynamic selectors, helper escapes/re-exports, optional calls, unsupported argument/import forms and external/preprocessed/custom SFC macro usage fail. Use explicit literal branches or intentionally retain runtime mode; never silence transform errors or let declaration-only `text` escape into JavaScript execution. Non-key arguments retain evaluation order; ordinary lexical shadows are not catalog calls.

## Failure Barriers and Verification

The compiler validates/renders all locales and representations before publication, stages output, publishes the manifest last and rolls back handled replacement failures. This is not a distributed transaction. Vite validates format **1**, exact identity, key references, safe artifact paths, exact-byte SHA-256 hashes and the canonical generation digest; it also rejects a generation changing while read. Missing/unknown formats, tampering and mixed outputs fail even after a successful compiler callback.

A failed generation blocks catalog reads/builds until repaired; do not serve last-good output as a hidden fallback. Client, SSR and custom environments must consume one coherent validated generation, not stale in-flight work.

Verify through the consumer's actual commands and surfaces, not source inspection alone:

1. Run the real PHP compiler/registered command from clean generated output with prepared PO inputs. Inspect PHP, MO and frontend artifacts; repeat unchanged input to check deterministic generation. Verify malformed NEON, missing/fuzzy PO/plural translations and placeholder mismatches fail without publishing partial output.
2. Generate first, then run the real standalone TypeScript/Vue typecheck, then production client and enabled SSR builds. Exercise each mode actually supported by the application; compilation success alone does not prove type resolution or macro transformation.
3. Render singular, plural, named-placeholder and sanitized HTML cases in PHP/Vue as applicable. Check disallowed HTML/missing sanitizer and hostile interpolated markup. Verify two app instances and sequential SSR/native-locale requests do not leak state; inspect real browser hydration and locale switching.
4. In real Vite development, edit NEON and translator PO without touching callers; verify browser output and already-evaluated SSR refresh. Edit ordinary Vue content and verify its normal HMR remains intact.
5. If build-watch is used, exercise nested input creation/deletion and cleaned generated directories. Break compilation, observe blocked output/build failure, repair it and verify recovery without perpetual generated-file watch loops.
6. In disposable artifacts, verify unknown format, identity mismatch, tampering and mixed generations are rejected. In compiled mode, also exercise rejected dynamic/escaped calls and confirm production output does not retain the runtime source lookup map.
