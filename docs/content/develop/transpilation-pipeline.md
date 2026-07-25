<p class="section-label">Developers</p>

# Transpilation Pipeline

<p class="page-intro">Bascik transforms source HTML into deployable HTML by replacing every custom component tag with its resolved, scoped content. The pipeline runs in two nested phases: the page phase and the component phase.</p>

## Overview

Every time a source page or component file changes, `pageProcessing(filePath)` in `processing.ts` is called. This is the top-level entry point for the whole pipeline.

Build scripts (`<script data-bascik-build>`) run **first**, before minification, so their output can contain component tags that will be resolved by the component phase.

## Phase 1 — Page Phase (`pageProcessing`)

The page phase prepares the source HTML document and orchestrates the component phase:

1. **Execute build scripts.** Any `<script data-bascik-build>` blocks are run as Node.js ESM modules. Their stdout replaces the script tag. The result can contain component tags — these will be resolved in step 5.
2. **Minify.** HTML comments are stripped and excess whitespace is collapsed via `minifyHtml`.
3. **Extract body and head.** The inner content of `<body>` and `<head>` are extracted separately so component injection can happen in both zones independently.
4. **Load components.** All component HTML and CSS files are read from `src/components/` into a `ComponentList` map keyed by component name.
5. **Run component phase.** `recursivelyTranspile` is called on both the body and head HTML strings. Each call returns a `TranspileResult` containing the resolved HTML and the list of components that were used.
6. **Collect and deduplicate CSS.** All CSS from used components is gathered. Since multiple instances of the same component share identical scoped class names, `deduplicateCss` emits a single `<style>` block regardless of how many times a component appears on the page.
7. **Inject live-reload script.** In dev mode only, a small `<script>` that opens a Server-Sent Events connection to `/bascik-live-reload` is appended.
8. **Reassemble HTML.** The full document is reconstructed: `<!DOCTYPE html>`, `<html>`, `<head>` (with injected `<style>`), `<body>`.
9. **Filter build/dev script tags.** Tags with `data-bascik-build-only` are removed in dev; tags with `data-bascik-dev-only` are removed during builds.
10. **Write output.** The finished HTML is written to `dist/`. In dev mode it is also stored in the in-memory page store so the HTTP/2 server can serve it instantly.
11. **Emit reload event.** `eventEmitter.emit("page-changed")` triggers live-reload for any connected browser.

## Phase 2 — Component Phase (`recursivelyTranspile`)

The component phase recurses until no custom component tags remain in the HTML string. On each pass it finds the first component tag, fully resolves it, and substitutes it. It then repeats until no more tags are found.

For each component tag found:

### Step 1 — Scoping pipeline

A fresh `instanceId` (a random 8-byte hex string) is generated for this occurrence of the component. An ordered list of transform functions is assembled and applied in a pipeline (each step receives the output of the previous):

1. `prefixElementAttribute(c, "id", instanceId)` — scopes `id` attributes and all corresponding JS DOM selector references.
2. `prefixElementAttribute(c, "name", instanceId)` — scopes `name` attributes and `getElementsByName` calls.
3. `prefixElementAttribute(c, "class", instanceId)` — scopes class names in HTML attributes, CSS, and JS selector calls.
4. `namespaceScriptTags(c)` — wraps every inline `<script>` in an IIFE.

Each step is skipped if disabled in `bascik.config.js`.

### Step 2 — Template resolution

1. **Props.** `injectProps` replaces every `data-bascik-prop-*` placeholder in the component template with the corresponding attribute value from the usage tag.
2. **Named slots.** `replaceNamedSlots` fills each `data-bascik-slot="name"` zone in the template with the matching `<div data-bascik-slot="name">` content from the usage site.
3. **Default slot.** The inner content of the usage tag is placed into the element carrying `data-bascik-slot` (no value). If the usage tag has no inner content, the template's fallback content is preserved.
4. **Attribute inheritance.** `mergeAttributesOntoRoot` copies pass-through attributes (`aria-*`, `data-*`, `class`, etc.) from the usage tag onto the component's root element.

### Step 3 — Substitution

`replaceTag` replaces the original usage tag in the parent HTML string with the fully resolved component HTML. The outer loop runs again on the updated string. Because component templates can themselves contain other component tags, this naturally handles any depth of nesting.

## Termination

The recursion terminates when `getFirstComponent` no longer finds any custom tag in the HTML string — i.e., when all recognised component names have been replaced with plain HTML.

<div class="callout">
<p><strong>Performance note:</strong> Each call to <code>recursivelyTranspile</code> uses the same in-memory <code>ComponentList</code> built once at the start of <code>pageProcessing</code>. Components are never re-read from disk mid-pipeline.</p>
</div>

## Selective Re-transpilation

When a component file changes during dev, Bascik does not reprocess every page. The memory store maintains a reverse index mapping each component name to the set of pages that use it. `selectivelyProcessPages` uses this index to retranspile only the affected pages.

## Scoped Name Format

All scoped attribute names follow this pattern:

```text
bascik__<componentName>__<instanceId>__<originalName>

# id and name attributes include instanceId for uniqueness:
bascik__my-nav__a1b2c3d4__search-input

# class attributes use component name only (no instanceId):
bascik__my-nav__toggle-btn
```

When `obfuscateAttributeNames` is enabled (the default for builds), each full scoped name is hashed to a short hex string using SHAKE-256 before being written to the output, e.g. `ba1c2d3e4f`. See [Scoping System](/develop/scoping-system) for full details.
