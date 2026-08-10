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
 * │     c. default slot         — fill data-bascik-slot element              │
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
import { readFileSync } from "node:fs";
import {
  listPages,
  getDirectoryPath,
  getDistPagePath,
  deleteDistFile,
  getRelativePath,
  deepReadDirFlat,
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
import { namespaceScriptTags, prefixElementAttribute, minifyJs } from "./javascript.js";
import { deduplicateCss, minifyCss } from "./styles.js";
import { executeBuildScripts } from "./build-scripts.js";
import { getUniqueId } from "./names.js";
import { BascikConfig } from "./config.js";
import { mem } from "./mem.js";
import { eventEmitter } from "./events.js";
import { generateSitemapFiles } from "./sitemap.js";
import type {
  BascikComponent,
  ComponentList,
  TranspileResult,
} from "./types.js";

export const getFilePosition = (
  filePath: string,
  searchString: string,
  tagName?: string,
): { line: number; character: number } | null => {
  try {
    const content = readFileSync(filePath, "utf8");
    let index = content.indexOf(searchString);
    if (index === -1 && tagName) {
      const regex = new RegExp(`<${tagName}\\b`, "i");
      const match = content.match(regex);
      if (match && match.index !== undefined) {
        index = match.index;
      }
    }
    if (index === -1 && searchString.length > 30) {
      index = content.indexOf(searchString.slice(0, 30));
    }
    if (index !== -1) {
      const prefix = content.slice(0, index);
      const lines = prefix.split(/\r?\n/);
      return {
        line: lines.length,
        character: lines[lines.length - 1].length + 1,
      };
    }
  } catch {
    // Ignore read errors
  }
  return null;
};

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

const resolveInlineStyles = async (): Promise<string[]> => {
  if (BascikConfig.inlineStyles === true) {
    return (await deepReadDirFlat(BascikConfig.directory.pages, /\.css$/i)).sort();
  }
  if (Array.isArray(BascikConfig.inlineStyles)) {
    return BascikConfig.inlineStyles;
  }
  return [];
};

// ─────────────────────────────────────────────────────────────────────────────
// Script minification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the `minifyScripts` config value to a concrete async minifier
 * function, or `null` when minification is disabled.
 */
const resolveScriptMinifier = (): ((code: string) => Promise<string>) | null => {
  const cfg = BascikConfig.minifyScripts;
  if (!cfg) return null;
  const fn = cfg === true ? minifyJs : cfg;
  return async (code: string) => fn(code);
};

/**
 * Minify the content of every inline `<script>` tag in `html` (excluding
 * external scripts and non-JS types such as application/ld+json).
 */
const minifyScriptTagsInHtml = async (
  html: string,
  minifyFn: (code: string) => string | Promise<string>,
): Promise<string> => {
  const regex = /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi;
  const ops: Array<{ index: number; len: number; open: string; code: string; close: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    const [full, open, code, close] = m as unknown as [string, string, string, string];
    // Skip non-JS types (e.g. application/ld+json, text/template)
    const typeMatch = open.match(/type\s*=\s*["']?([^"'>\s]+)["']?/i);
    if (typeMatch && typeMatch[1].toLowerCase() !== "text/javascript") continue;
    // Skip external scripts — no inline content to minify
    if (/\bsrc\s*=/i.test(open)) continue;
    ops.push({ index: m.index, len: full.length, open, code, close });
  }
  if (!ops.length) return html;
  const minified = await Promise.all(ops.map(({ code }) => minifyFn(code)));
  let result = html;
  for (let i = ops.length - 1; i >= 0; i--) {
    const { index, len, open, close } = ops[i];
    result = result.slice(0, index) + `${open}${minified[i]}${close}` + result.slice(index + len);
  }
  return result;
};

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
const buildScopingPipeline = (instanceId: string): ComponentTransform[] => {
  const skip = BascikConfig.skipTranspilingElementContents;
  return (
    [
      BascikConfig.scopeAttribute.id &&
      ((c: BascikComponent) => prefixElementAttribute(c, "id", instanceId, true, skip)),
      BascikConfig.scopeAttribute.name &&
      ((c: BascikComponent) => prefixElementAttribute(c, "name", instanceId, true, skip)),
      BascikConfig.scopeAttribute.class &&
      ((c: BascikComponent) =>
        prefixElementAttribute(c, "class", instanceId, BascikConfig.deduplicateCss, skip)),
      BascikConfig.scopeScriptBlocks && namespaceScriptTags,
    ] as (ComponentTransform | false)[]
  ).filter((t): t is ComponentTransform => Boolean(t));
};

// ─────────────────────────────────────────────────────────────────────────────
// Core transpile pipeline
// ─────────────────────────────────────────────────────────────────────────────

export const getDisplayPath = (path: string): string => {
  if (BascikConfig.directory?.components && path.includes(BascikConfig.directory.components)) {
    return getRelativePath(path, "components");
  }
  if (BascikConfig.directory?.pages && path.includes(BascikConfig.directory.pages)) {
    return getRelativePath(path, "pages");
  }
  return path;
};

export const findActiveSourceFile = (
  html: string,
  index: number,
  fallback: string,
): string => {
  const substring = html.slice(0, index);
  const regex = /<!--bascik-source-file:(.*?)-->|<!--bascik-source-file-end:(.*?)-->/g;
  const stack: string[] = [];
  let match;
  while ((match = regex.exec(substring)) !== null) {
    if (match[1] !== undefined) {
      stack.push(match[1]);
    } else if (match[2] !== undefined) {
      const idx = stack.lastIndexOf(match[2]);
      if (idx !== -1) {
        stack.splice(idx, 1);
      } else {
        stack.pop();
      }
    }
  }
  return stack[stack.length - 1] || fallback;
};

export const recursivelyTranspile = (
  transpiledHtmlBody: string,
  componentList: ComponentList,
  usedComponents: BascikComponent[] = [],
  filePath?: string,
): TranspileResult => {
  if (filePath && !transpiledHtmlBody.includes("<!--bascik-source-file:")) {
    transpiledHtmlBody = `<!--bascik-source-file:${filePath}-->${transpiledHtmlBody}<!--bascik-source-file-end:${filePath}-->`;
  }

  const partial = getFirstComponent(transpiledHtmlBody, componentList);
  if (!partial.name) {
    const cleanedHtml = transpiledHtmlBody
      .replace(/<!--bascik-source-file:[\s\S]*?-->/g, "")
      .replace(/<!--bascik-source-file-end:[\s\S]*?-->/g, "");
    return { transpiledHtmlBody: cleanedHtml, usedComponents };
  }
  // Cast: getFirstComponent merges component list data so all required fields are present
  let component = partial as BascikComponent;

  if (!component.fileContent) {
    const cleanedHtml = transpiledHtmlBody
      .replace(component.content || "", "")
      .replace(/<!--bascik-source-file:[\s\S]*?-->/g, "")
      .replace(/<!--bascik-source-file-end:[\s\S]*?-->/g, "");
    return {
      transpiledHtmlBody: cleanedHtml,
      usedComponents
    };
  }

  let currentStage = "";
  try {
    // One stable ID shared across all attribute-scoping passes for this instance.
    // Run the scoping pipeline — each step is `BascikComponent → BascikComponent`.
    const instanceId = getUniqueId(8);
    currentStage = "attribute scoping";
    component = applyTransforms(component, buildScopingPipeline(instanceId));

    currentStage = "prop injection";
    // Inject props — always call so unused data-bascik-prop-* markers are stripped.
    const props = extractProps(component.content);
    component.fileContent = injectProps(component.fileContent, props);

    currentStage = "slot resolution";
    // Resolve named slots from the usage inner HTML.
    const namedSlots = extractNamedSlotContent(component.innerContent);
    component.fileContent = replaceNamedSlots(component.fileContent, namedSlots);

    // Resolve the default slot: innerContent with named-slot wrappers stripped.
    const defaultSlotContent = extractDefaultSlotContent(component.innerContent);

    // Replace <element data-bascik-slot> default slot markers.
    // Named slots were already handled above by replaceNamedSlots.
    let transpiledTag = component.fileContent.replace(
      /<(\w+(?:-\w+)*)\s+data-bascik-slot(?!\s*=)((?:\s[^>]*)?)>([\s\S]*?)<\/\1>/gi,
      (_match, _tag, _extraAttrs, innerFallback) =>
        defaultSlotContent || innerFallback,
    );

    currentStage = "attribute inheritance";
    // Merge non-bascik attributes from the usage tag onto the component root element.
    if (BascikConfig.inheritAttributes) {
      const inheritableAttrs = extractInheritableAttributes(component.content);
      transpiledTag = mergeAttributesOntoRoot(transpiledTag, inheritableAttrs);
    }

    currentStage = "substitution";
    if (component.fileName) {
      transpiledTag = `<!--bascik-source-file:${component.fileName}-->${transpiledTag}<!--bascik-source-file-end:${component.fileName}-->`;
    }
    transpiledHtmlBody = replaceTag(
      transpiledHtmlBody,
      component.name,
      transpiledTag,
    );
    usedComponents.push(component);
  } catch (error) {
    const activeSourceFile = findActiveSourceFile(
      transpiledHtmlBody,
      component.index || 0,
      filePath || "",
    );
    let errorMsg = `[bascik] Transpilation failed for component <${component.name}> during ${currentStage}`;
    if (activeSourceFile) {
      const pos = getFilePosition(activeSourceFile, component.content || "", component.name);
      if (pos) {
        errorMsg += ` in "${getDisplayPath(activeSourceFile)}" at (line ${pos.line}, column ${pos.character})`;
      } else {
        errorMsg += ` in "${getDisplayPath(activeSourceFile)}"`;
      }
    }
    if (component.fileName) {
      errorMsg += `\n  Defined in component template: "${getDisplayPath(component.fileName)}"`;
    }
    console.error(`${errorMsg}\n  Error: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    transpiledHtmlBody = transpiledHtmlBody.replace(component.content || "", "");
  }

  return recursivelyTranspile(
    transpiledHtmlBody,
    componentList,
    usedComponents,
    filePath,
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

  if (BascikConfig.isBuild) {
    await generateSitemapFiles();
  }

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

  // Execute <script data-bascik-build> blocks first so that the generated HTML
  // can contain component tags, which will be resolved below.
  const rawHtml = (await readFile(pagePath)).toString();
  const htmlWithBuildOutput = await executeBuildScripts(rawHtml, pagePath);

  // Do NOT minify before component resolution. Minification runs after transpilation
  // so that whitespace-sensitive content (e.g. code inside resolved <pre> blocks
  // from components like <code-block>) is preserved by minifyHtml's <pre> handling.

  // Gets all the text between the <body></body> tags
  const { innerContent: body } = getTag(htmlWithBuildOutput, "body");

  if (!body) {
    console.warn(
      `warning: ${pagePath} does not contain <body></body> or body does not have content`,
    );
    return;
  }

  let { transpiledHtmlBody, usedComponents } = recursivelyTranspile(
    body,
    componentList,
    [],
    pagePath,
  );

  // Also transpile the <head> so components can be used there (e.g. shared <meta> tags)
  const { innerContent: headRaw } = getTag(htmlWithBuildOutput, "head");
  let {
    transpiledHtmlBody: transpiledHeadContent,
    usedComponents: headUsedComponents,
  } = recursivelyTranspile(headRaw ?? "", componentList, [], pagePath);

  // Warn about any hyphenated tags remaining after transpilation — these have no
  // matching component file and will appear unresolved in the output HTML.
  {
    const unresolved = new Set<string>();
    for (const chunk of [transpiledHtmlBody, transpiledHeadContent]) {
      const re = /<([a-z][a-z0-9]*(?:-[a-z0-9]+)+)[\s\/>]/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(chunk)) !== null) {
        const tag = m[1].toLowerCase();
        unresolved.add(tag);
      }
    }
    if (unresolved.size > 0) {
      console.warn(
        `[bascik] Unresolved component tag${unresolved.size > 1 ? "s" : ""} in "${relativePagePath}": ` +
        `${[...unresolved].map((t) => `<${t}>`).join(", ")} — no matching component file found. ` +
        `Run \`bascik --check\` for a full report.`,
      );
    }
  }

  // Deduplicate CSS — each component's styles included only once even if used many times
  const componentCss = deduplicateCss([...usedComponents, ...headUsedComponents], BascikConfig.deduplicateCss);

  // Read and inline any global stylesheets configured via `inlineStyles`.
  // Global styles are injected before component styles so component rules win.
  let globalStylesHtml = "";
  const inlineStyles = await resolveInlineStyles();
  if (inlineStyles.length > 0) {
    const sheets = await Promise.all(
      inlineStyles.map(async (filePath) => {
        try {
          const css = (await readFile(filePath)).toString();
          return BascikConfig.minifyStyles ? minifyCss(css) : css;
        } catch (error) {
          console.warn(`[bascik] inlineStyles: could not read "${filePath}":`, (error as Error).message);
          return "";
        }
      }),
    );
    const combined = sheets.filter(Boolean).join(" ");
    if (combined) globalStylesHtml = `<style>${combined}</style>`;
  }

  let transpiledHead = `${transpiledHeadContent}${globalStylesHtml}
    <style>
    ${BascikConfig.minifyStyles ? minifyCss(componentCss) : componentCss}
    </style>`;
  // Compress the entire head (removes newlines, collapses whitespace in inline <style> tags too)

  if (BascikConfig.minifyStyles) {
    // Also minify any inline <style> blocks that came from the page source
    transpiledHead = transpiledHead.replace(
      /<style>([\s\S]*?)<\/style>/gi,
      (_: string, css: string) => `<style>${minifyCss(css)}</style>`,
    );
    transpiledHead = transpiledHead.replace(/\n/g, " ").replace(/\s\s+/g, " ");
  }

  if (!BascikConfig.isBuild) {
    transpiledHtmlBody = `${transpiledHtmlBody}${liveReloadScript}`;
  }

  // Minify the body AFTER component resolution so that <pre> blocks from resolved
  // components (e.g. <code-block> → <pre><code>…</code></pre>) are preserved intact.
  transpiledHtmlBody = minifyHtml(transpiledHtmlBody);

  // Minify inline <script> content when configured.
  const jsMinifier = resolveScriptMinifier();
  if (jsMinifier) {
    transpiledHtmlBody = await minifyScriptTagsInHtml(transpiledHtmlBody, jsMinifier);
    transpiledHead = await minifyScriptTagsInHtml(transpiledHead, jsMinifier);
  }

  // Puts our processed markup back between the <body></body> tags
  let distHtml = htmlWithBuildOutput
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
