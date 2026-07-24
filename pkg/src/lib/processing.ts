/**
 * @module processing
 *
 * Bascik Transpilation Pipeline
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Bascik transforms source HTML into deployable HTML by replacing every custom
 * component tag with its resolved, scoped content.  The pipeline runs in two
 * nested phases:
 *
 * ┌─ PAGE PHASE  (pageProcessing) ─────────────────────────────────────────┐
 * │  1. Read source page HTML file.                                        │
 * │  2. Strip comments, collapse whitespace (minifyHtml).                  │
 * │  3. Extract <body> and <head> inner content separately.                │
 * │  4. Run COMPONENT PHASE on each (recursivelyTranspile).                │
 * │  5. Collect all CSS from used components, deduplicate, inject <style>. │
 * │  6. Optionally inject live-reload SSE script (dev mode only).          │
 * │  7. Reassemble full HTML document.                                     │
 * │  8. Filter build-only / dev-only <script> tags.                        │
 * │  9. Store in memory (dev) and write to dist/ (both modes).             │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ COMPONENT PHASE  (recursivelyTranspile) ──────────────────────────────┐
 * │  Recurses until no custom component tags remain in the HTML string.    │
 * │                                                                        │
 * │  For each component tag found:                                         │
 * │                                                                        │
 * │  1. SCOPING PIPELINE  (buildScopingPipeline → applyTransforms)        │
 * │     Each step is BascikComponent → BascikComponent:                   │
 * │     a. prefixElementAttribute('id')    — scope id attrs + JS refs     │
 * │     b. prefixElementAttribute('name')  — scope name attrs + JS refs   │
 * │     c. prefixElementAttribute('class') — scope class attrs, CSS       │
 * │        classes, element selectors, @keyframes, custom properties      │
 * │     d. namespaceScriptTags             — wrap scripts in IIFEs         │
 * │     (Each step is skipped if disabled in bascik.config.js.)           │
 * │                                                                        │
 * │  2. TEMPLATE RESOLUTION                                                │
 * │     a. injectProps          — replace data-bascik-prop-* markers      │
 * │     b. replaceNamedSlots    — fill data-bascik-slot="name" zones      │
 * │     c. default slot         — fill <slot-component> / data-bascik-slot │
 * │        with inner content or template fallback                         │
 * │     d. mergeAttributesOntoRoot — pass-through attrs (aria-*, data-*)  │
 * │                                                                        │
 * │  3. SUBSTITUTION                                                       │
 * │     Replace the original usage tag with the resolved template HTML.   │
 * │     Recurse until no custom tags remain.                               │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * All scoped names follow the pattern:
 *   bascik__<componentName>__<instanceId>__<originalName>
 *
 * When `obfuscateAttributeNames` is enabled (default in builds), names are
 * hashed to short hex strings (e.g. `bab12cd3`) for smaller output.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  listPages,
  getDirectoryPath,
  getDistPagePath,
  deleteDistFile,
  getRelativePath,
} from "./file-system.js";
import {
  listComponents,
  replaceTag,
  getFirstComponent,
  getTag,
  minifyHtml,
  extractProps,
  injectProps,
  extractNamedSlotContent,
  extractDefaultSlotContent,
  replaceNamedSlots,
  extractInheritableAttributes,
  mergeAttributesOntoRoot,
} from "./components.js";
import { namespaceScriptTags, prefixElementAttribute } from "./javascript.js";
import { deduplicateCss } from "./styles.js";
import { executeBuildScripts } from "./build-scripts.js";
import { getUniqueId } from "./names.js";
import { BascikConfig } from "./config.js";
import { mem } from "./mem.js";
import { eventEmitter } from "./events.js";
import type {
  BascikComponent,
  ComponentList,
  TranspileResult,
} from "./types.js";

const liveReloadScript = `
<script>
  (function() {
  const eventSource = new EventSource("/bascik-live-reload");
  eventSource.onmessage = function(event) {
    if (event.data === 'reload') {
      window.location.reload();
    }
  };
  eventSource.onerror = function(event) {
    eventSource.close();
    console.warn('Live-Reload Connection Lost: Start development server and refresh the page to restart live-reload.')
  }
  window.onbeforeunload = function () {
    eventSource.close();
  };
  })();
</script>
`;

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline utilities
// ─────────────────────────────────────────────────────────────────────────────

/** A function that transforms a component in place and returns it. */
type ComponentTransform = (component: BascikComponent) => BascikComponent;

/**
 * Apply an ordered list of transforms to a component, threading the output of
 * each step as the input to the next — the pipeline pattern.
 */
const applyTransforms = (
  component: BascikComponent,
  transforms: ComponentTransform[],
): BascikComponent => transforms.reduce((c, fn) => fn(c), component);

/**
 * Build the ordered list of attribute/script scoping transforms for this
 * component instance, filtered by the current BascikConfig flags.
 */
const buildScopingPipeline = (instanceId: string): ComponentTransform[] =>
  (
    [
      BascikConfig.scopeAttribute.id &&
        ((c: BascikComponent) => prefixElementAttribute(c, "id", instanceId)),
      BascikConfig.scopeAttribute.name &&
        ((c: BascikComponent) => prefixElementAttribute(c, "name", instanceId)),
      BascikConfig.scopeAttribute.class &&
        ((c: BascikComponent) =>
          prefixElementAttribute(c, "class", instanceId)),
      BascikConfig.scopeScriptBlocks && namespaceScriptTags,
    ] as (ComponentTransform | false)[]
  ).filter((t): t is ComponentTransform => Boolean(t));

// ─────────────────────────────────────────────────────────────────────────────
// Core transpile pipeline
// ─────────────────────────────────────────────────────────────────────────────

export const recursivelyTranspile = (
  transpiledHtmlBody: string,
  componentList: ComponentList,
  usedComponents: BascikComponent[] = [],
): TranspileResult => {
  const partial = getFirstComponent(transpiledHtmlBody, componentList);
  if (!partial.name) {
    return { transpiledHtmlBody, usedComponents };
  }
  // Cast: getFirstComponent merges component list data so all required fields are present
  let component = partial as BascikComponent;

  // One stable ID shared across all attribute-scoping passes for this instance.
  // Run the scoping pipeline — each step is `BascikComponent → BascikComponent`.
  const instanceId = getUniqueId(8);
  try {
    component = applyTransforms(component, buildScopingPipeline(instanceId));
  } catch (error) {
    console.error("Component scoping failed", { component, error });
  }

  // Inject props — always call so unused data-bascik-prop-* markers are stripped.
  const props = extractProps(component.content);
  component.fileContent = injectProps(component.fileContent, props);

  // Resolve named slots from the usage inner HTML.
  const namedSlots = extractNamedSlotContent(component.innerContent);
  component.fileContent = replaceNamedSlots(component.fileContent, namedSlots);

  // Resolve the default slot:
  //   1. innerContent with named-slot wrappers stripped
  //   2. fall back to the <slot-component>'s own inner content in the template
  const { innerContent: slotComponentFallback = "" } = getTag(
    component.fileContent,
    "slot-component",
  );
  const defaultSlotContent =
    extractDefaultSlotContent(component.innerContent) || slotComponentFallback;

  // Replace <slot-component> (backward-compatible default slot)
  let transpiledTag = replaceTag(
    component.fileContent,
    "slot-component",
    defaultSlotContent,
  );

  // Replace <element data-bascik-slot> (preferred default slot convention).
  // Named slots were already handled above by replaceNamedSlots.
  transpiledTag = transpiledTag.replace(
    /<(\w+(?:-\w+)*)\s+data-bascik-slot(?!\s*=)((?:\s[^>]*)?)>([\s\S]*?)<\/\1>/gi,
    (_match, _tag, _extraAttrs, innerFallback) =>
      defaultSlotContent || innerFallback,
  );

  // Merge non-bascik attributes from the usage tag onto the component root element.
  const inheritableAttrs = extractInheritableAttributes(component.content);
  transpiledTag = mergeAttributesOntoRoot(transpiledTag, inheritableAttrs);

  transpiledHtmlBody = replaceTag(
    transpiledHtmlBody,
    component.name,
    transpiledTag,
  );
  usedComponents.push(component);
  return recursivelyTranspile(
    transpiledHtmlBody,
    componentList,
    usedComponents,
  );
};

export const selectivelyProcessPages = async (path: string): Promise<void> => {
  const relativePath = getRelativePath(path, "components");
  const match = relativePath.match(/^components[\/](?<componentName>(\w|-)+)/);
  const componentName = match?.groups?.componentName;
  if (!componentName) return;
  const pagesToTranspile = mem.pagesThisComponentIsUsedOn(componentName);
  const componentList = await listComponents();
  pagesToTranspile.map((absolutePagePath: string) => {
    // We need the absolute page path for pageProcessing
    return pageProcessing(absolutePagePath, componentList);
  });
};

export const processAllPages = async () => {
  const start = performance.now();
  // Parallel processing of pages
  const [pages, componentList] = await Promise.all([
    listPages(),
    listComponents(),
  ]);
  const pageList = pages ?? [];
  const results = await Promise.all(
    pageList.map((path: string) => {
      return pageProcessing(path, componentList);
    }),
  );
  const count = results.filter(Boolean).length;
  const elapsed = Math.round(performance.now() - start);
  console.log(
    `\n✓ ${count} page${count !== 1 ? "s" : ""} transpiled in ${elapsed}ms`,
  );
  return results;
};

export const pageProcessing = async (
  pagePath: string,
  componentList?: ComponentList,
) => {
  const relativePagePath = getRelativePath(pagePath, "pages");

  if (!componentList) {
    componentList = await listComponents();
  }
  // Execute <script data-bascik-build> blocks before minification so that the
  // generated HTML can contain component tags, which will be resolved below.
  const rawHtml = (await readFile(pagePath)).toString();
  const htmlWithBuildOutput = await executeBuildScripts(rawHtml);
  const html = minifyHtml(htmlWithBuildOutput);

  if (!html) return;

  // Gets all the text between the <body></body> tags
  const { innerContent: body } = getTag(html, "body");

  if (!body) {
    console.warn(
      `warning: ${pagePath} does not contain <body></body> or body does not have content`,
    );
    return;
  }

  let { transpiledHtmlBody, usedComponents } = recursivelyTranspile(
    body,
    componentList,
  );

  // Also transpile the <head> so components can be used there (e.g. shared <meta> tags)
  const { innerContent: headRaw } = getTag(html, "head");
  let {
    transpiledHtmlBody: transpiledHeadContent,
    usedComponents: headUsedComponents,
  } = recursivelyTranspile(headRaw ?? "", componentList);

  // Deduplicate CSS — each component's styles included only once even if used many times
  let transpiledHead = `${transpiledHeadContent}
    <style>
    ${deduplicateCss([...usedComponents, ...headUsedComponents])}
    </style>`;
  // Compress styles
  // Remove new lines and multiple spaces become single spaces

  if (BascikConfig.minifyStyles) {
    transpiledHead = transpiledHead.replace(/\n/g, " ").replace(/\s\s+/g, " ");
  }

  if (!BascikConfig.isBuild) {
    transpiledHtmlBody = `${transpiledHtmlBody}${liveReloadScript}`;
  }

  // Puts our processed markup back between the <body></body> tags
  let distHtml = html
    .replace(/<body>([\s\S]*?)<\/body>/i, `<body>${transpiledHtmlBody}</body>`)
    .replace(/<head>([\s\S]*?)<\/head>/i, `<head>${transpiledHead}</head>`);

  const allUsedComponents = [...usedComponents, ...headUsedComponents];

  // Memory
  if (!BascikConfig.isBuild) {
    mem.storePage({
      relativePagePath,
      absolutePagePath: pagePath,
      pageContent: distHtml,
      usedComponentsNames: allUsedComponents.map(({ name }) => name),
    });
  }

  // File system is done async.
  // Wrapped in try catch in IIFE so we know where the exception came from.
  (async () => {
    // Create directory
    // Doesn't hurt to run it if it exists, and it creates dist if it doesn't exist
    const directoryPath = getDirectoryPath(relativePagePath);
    try {
      await mkdir(`dist/${directoryPath}`, { recursive: true });
    } catch (error) {
      console.error("Make directory error", error);
    }

    // Write the transpiled html
    const distPagePath = getDistPagePath(relativePagePath);
    try {
      await writeFile(distPagePath, distHtml);
    } catch (error) {
      // Ignore file doesn't exist, race condition
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Write file error", error);
      }
    }
  })();

  console.log(`transpiled: ${relativePagePath}`);

  eventEmitter.emit("transpiled", { relativePagePath });

  // The return is only for debugging
  return relativePagePath;
};

export const removePage = (absolutePagePath: string): void => {
  const relativePagePath = getRelativePath(absolutePagePath, "pages");

  // Memory
  if (!BascikConfig.isBuild) {
    mem.removePage(absolutePagePath);
  }
  // File system is async, do not await
  deleteDistFile(relativePagePath);
};
