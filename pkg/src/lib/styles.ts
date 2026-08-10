import { readFile } from "node:fs/promises";
import { obfuscateAttributeName } from "./names.js";
import type { BascikComponent } from "./types.js";

// CSS unit keywords that are not valid HTML element names.  A CSS syntax
// error (e.g. breaking `0.7rem 1em` across two lines) can place a unit
// keyword at column 0 where the element-selector regex would otherwise
// match it and produce a garbled scoped class name.
const CSS_UNIT_KEYWORDS = new Set([
  // Relative length
  "rem", "ex", "rex", "cap", "rcap", "ch", "rch", "ic", "ric", "lh", "rlh",
  // Viewport
  "vw", "vh", "vmin", "vmax",
  "svw", "svh", "svmin", "svmax",
  "dvw", "dvh", "dvmin", "dvmax",
  "lvw", "lvh", "lvmin", "lvmax",
  // Container query
  "cqw", "cqh", "cqi", "cqb", "cqmin", "cqmax",
  // Absolute length
  "px", "cm", "mm", "in", "pt", "pc",
  // Angle
  "deg", "rad", "grad", "turn",
  // Time  (note: "s" IS an HTML element, so it is intentionally omitted)
  "ms",
  // Frequency
  "hz", "khz",
  // Resolution
  "dpi", "dpcm", "dppx",
]);

export const convertCssElementSelectorsToClasses = (
  css: string,
  componentName: string,
): { css: string; elementsConvertedClasses: string[] } => {
  // Deduplicate: use a Set so the same element name is only pushed once even
  // if it appears in multiple selector passes.  addElementClassesInHtml loops
  // over this list, so duplicates would inject the class twice.
  const seen = new Set<string>();
  const elementsConvertedClasses: string[] = [];

  const toClass = (elementName: string): string => {
    // CSS unit keywords (rem, vw, px, …) are not HTML elements.  A syntax
    // error in the user's CSS can place them at column 0 where the regex
    // would otherwise match.  Return unchanged so the unit is preserved as-is.
    if (CSS_UNIT_KEYWORDS.has(elementName.toLowerCase())) return elementName;
    if (!seen.has(elementName)) {
      seen.add(elementName);
      elementsConvertedClasses.push(elementName);
    }
    return `.${obfuscateAttributeName(`bascik__${componentName}__el__${elementName}`)}`;
  };

  // Pass 1: standalone element selectors after a selector boundary.
  // Handles top-level rules and indented selectors inside at-rules:
  //   p { }
  //   @media (...) { p { } }
  //   p:hover { }
  // The context-aware lookahead confirms we are still in selector position.
  let result = css.replace(
    /(^\s*|[;{}]\s*)([a-z1-6]+)(?=[^{};)]*\{)/gim,
    (_match, prefix: string, elementName: string) => `${prefix}${toClass(elementName)}`,
  );

  // Pass 2: same-line comma-separated selector list, e.g. `h1, h2 { }`.
  // Multi-line lists (`h1,\nh2`) are already handled by Pass 1.
  // The context-aware lookahead [^{};)]*\{ confirms selector position:
  //   - In selector context, `{` follows before any `;` or `}`.
  //   - In value context (property values, gradient functions, etc.) a
  //     `;`, `}`, or `)` always appears before the next `{`.
  // Adding `)` to the stop set is essential — it prevents false positives
  // inside :is(), :where(), :has() pseudo-functions (e.g. h2 in :is(p, h2)).
  result = result.replace(/(?<=,[ \t]*)[a-z1-6]+(?=[^{};)]*\{)/g, toClass);

  // Pass 3: element selectors in CSS nesting context.
  // Handles `& p { }`, `& > h2 { }`, `& + li { }`, `& ~ span { }`.
  // The `&` anchor is only valid in CSS nesting selectors, making this
  // safe — `&\s+` never appears in property value position.
  result = result.replace(
    /(?<=&\s+(?:[>+~]\s+)?)[a-z1-6]+(?=[^{};)]*\{)/g,
    toClass,
  );

  // Pass 4: element selectors that are descendants of an already-scoped class.
  // Handles `.foo p {}`, `.foo > h2 {}`, `.foo + li {}`, `.foo ~ span {}`.
  //
  // After Pass 1 (class scoping), class names become `bascik__…__foo`. The
  // `bascik__` prefix is a uniquely safe anchor — it never appears in CSS
  // property value position. The negative lookahead `(?!__)` prevents
  // matching the start of another scoped class name (e.g. `bascik__comp__bar`
  // starts with `b` which is in [a-z1-6] but is followed by `ascik__`, so
  // `(?!__)` stops the second `_` from matching after `bascik`).
  //
  // Note: this pass only applies when CSS scoping has already run (Pass 1
  // rewrites `.foo` → `.bascik__comp__foo`, making the anchor available).
  result = result.replace(
    /(?<=bascik__[\w-]+\s+(?:[>+~]\s+)?)[a-z1-6]+(?!__)(?=[^{};)]*\{)/g,
    toClass,
  );

  return { css: result, elementsConvertedClasses };
};

/**
 * If a component's css styles any element, add bascik classes to those elements
 */
export const addElementClassesInHtml = (
  componentHtml: string,
  componentName: string,
  elementsConvertedClasses: string[] = [],
): string => {
  // Loop through each element that has styling
  elementsConvertedClasses.forEach((element) => {
    // Find all the instances of that element in the component.
    // The `s` (dotAll) flag lets `.` match newlines for multi-line element content.
    componentHtml = componentHtml.replace(
      new RegExp(`<${element}[^>]*>([\\s\\S]*?)<\\/${element}>`, "gis"),
      (elementHtml: string) => {
        // If the instance of the element already has classes add to it
        if (elementHtml.match('class="')) {
          elementHtml = elementHtml.replace(/class=".*?(?=")/i, (classStr) => {
            const bascikClassName = obfuscateAttributeName(
              `bascik__${componentName}__el__${element}`,
            );
            return `${classStr} ${bascikClassName}`;
          });
        } else {
          // Otherwise set the element class as the only class
          const bascikClassName = obfuscateAttributeName(
            `bascik__${componentName}__el__${element}`,
          );
          elementHtml = elementHtml.replace(
            new RegExp(`<${element}`, "i"),
            `<${element} class="${bascikClassName}"`,
          );
        }
        return elementHtml;
      },
    );
  });
  return componentHtml;
};

/** Returns all `.class { }` rule strings. Useful for CSS analysis. */
export const getCssClasses = (css: string): string[] => {
  const classes = css.match(/\.[\.\w\s\(\)]+{[\w\s\:;#-_]+}/g);
  if (Array.isArray(classes)) return classes;
  return [];
};

export const getKeyframeNames = (css: string): string[] | null => {
  return css.match(/(?<=@keyframes.*?)([a-z]+)(?=[\s]*{)/gim);
};

export const prefixKeyframes = (css: string, componentName: string): string => {
  const keyframeNames = getKeyframeNames(css);
  if (!Array.isArray(keyframeNames)) return css;
  return css.replace(
    new RegExp(`${keyframeNames.join("|")}`, "gmi"),
    (keyframeName) => {
      return obfuscateAttributeName(
        `bascik__${componentName}__keyframe__${keyframeName}`,
      );
    },
  );
};

export const removeIdSelectors = (css: string): string => {
  // Strips the [id] / [id="…"] attribute-selector form which cannot be
  // reliably scoped without DOM wrapping.  The hash form (#foo) is now
  // handled by convertCssIdSelectorsToClasses.
  return css.replace(/\[id\b[^\]]*\].*?{[\s\S]*?}/gim, "");
};

// ─── CSS #id Selector → Class Conversion ─────────────────────────────────────

/**
 * Convert CSS hash ID selectors (`#idName { … }`) to component-scoped class
 * selectors, then inject the generated class onto the matching HTML element.
 *
 * Context-aware approach
 * ───────────────────────
 * The regex uses a lookahead to identify SELECTOR position vs VALUE position:
 *
 *   /#([a-zA-Z][a-zA-Z0-9-_]*)(?=[^{};]*\{)/g
 *
 * In selector position the next `{` appears before any `;` or `}`.
 * In value position (colour declarations, gradient functions, etc.) a `;` or
 * `}` always appears before the next `{`.
 *
 * This correctly handles all common cases:
 *   #btn { }                  → MATCHES  (selector)
 *   #btn:hover { }            → MATCHES  (pseudo-class on selector)
 *   .parent #btn { }          → MATCHES  (compound selector)
 *   color: #abc;              → skipped  (value, `;` before `{`)
 *   background: linear-gradient(#abc, #def)  → skipped  (inside rule, `}` before next `{`)
 *   color: #abc\n}            → skipped  (`}` terminates before `{`)
 *
 * Known remaining edge case: a bare property declaration at the top level of
 * CSS (which is itself invalid) could theoretically produce a false positive.
 * In valid component CSS this does not occur.
 *
 * @example
 *   #btn { color: red }  →  .bascik__my-comp__id__btn { color: red }
 */
export const convertCssIdSelectorsToClasses = (
  css: string,
  componentName: string,
): { css: string; idsConverted: { idName: string; className: string }[] } => {
  const seen = new Map<string, string>();
  const idsConverted: { idName: string; className: string }[] = [];
  const cssStr = css.replace(
    /#([a-zA-Z][a-zA-Z0-9-_]*)(?=[^{};]*\{)/g,
    (_: string, idName: string) => {
      if (!seen.has(idName)) {
        const className = obfuscateAttributeName(
          `bascik__${componentName}__id__${idName}`,
        );
        seen.set(idName, className);
        idsConverted.push({ idName, className });
      }
      return `.${seen.get(idName)!}`;
    },
  );
  return { css: cssStr, idsConverted };
};

/**
 * Inject the generated id-class onto every HTML element whose `id` attribute
 * matches.  Works for both unscoped (`id="idName"`) and already-scoped
 * (`id="bascik__comp__instanceId__idName"`) forms.
 */
export const addIdClassesInHtml = (
  html: string,
  idsConverted: { idName: string; className: string }[],
): string => {
  if (idsConverted.length === 0) return html;
  idsConverted.forEach(({ idName, className }) => {
    const escaped = idName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(
      new RegExp(`(<[^>]+(?<=\\s)id="(?:[^"]*__)?${escaped}"[^>]*)>`, "gi"),
      (_: string, tagContent: string) => {
        if (/\bclass="/.test(tagContent)) {
          return (
            tagContent.replace(
              /\bclass="([^"]*)"/,
              (_: string, c: string) => `class="${c} ${className}"`,
            ) + ">"
          );
        }
        return `${tagContent} class="${className}">`;
      },
    );
  });
  return html;
};

export const removeCommentsFromCss = (css: string): string => {
  return css.replace(/\/\*[\s\S]*?\*\//gim, "");
};

/**
 * Minify a CSS string: strip comments, collapse whitespace, and remove
 * spaces around structural characters (`{`, `}`, `:`, `;`, `,`).
 */
export const minifyCss = (css: string): string => {
  return removeCommentsFromCss(css)
    .replace(/\n/g, " ")
    .replace(/\s\s+/g, " ")
    .replace(/\s*([{}:;,])\s*/g, "$1")
    .trim();
};

export const getComponentCss = async (
  htmlFileName: string,
  cssFileNames: string[],
): Promise<string | undefined> => {
  if (!htmlFileName || !Array.isArray(cssFileNames)) return;
  const cssFileName = cssFileNames.find(
    (cssFileName) => cssFileName.replace(/\.css$/, ".html") === htmlFileName,
  );
  if (!cssFileName) return;
  try {
    return removeCommentsFromCss((await readFile(cssFileName)).toString());
  } catch (error) {
    console.warn(`warning: Failed to read css for ${htmlFileName}`, error);
  }
};

// ─── CSS Custom Properties Scoping ───────────────────────────────────────────

/**
 * Scope CSS custom property (--var) declarations and all var() references
 * within a component's stylesheet.
 *
 * Only properties *declared* in this CSS are scoped — external custom
 * properties consumed via var() that are not declared here are left untouched.
 *
 * @example
 *   --brand: #d3ff8d   →  --bascik__my-comp__x1__brand: #d3ff8d
 *   var(--brand)        →  var(--bascik__my-comp__x1__brand)
 */
export const scopeCssCustomProperties = (
  css: string,
  componentName: string,
): string => {
  const propMap = new Map();
  // Collect all --var-name declarations in this CSS
  const declRegex = /(?<!-)--(\w[\w-]*)(?=\s*:)/gm;
  let m;
  while ((m = declRegex.exec(css)) !== null) {
    const originalName = m[1];
    if (!propMap.has(originalName)) {
      propMap.set(
        originalName,
        obfuscateAttributeName(`bascik__${componentName}__${originalName}`),
      );
    }
  }
  if (propMap.size === 0) return css;
  let result = css;
  propMap.forEach((scopedName, originalName) => {
    // Replace declarations:  --original:
    result = result.replace(
      new RegExp(`(?<!-)--${originalName}(?=\\s*:)`, "gm"),
      `--${scopedName}`,
    );
    // Replace var() references:  var(--original)  and  var(--original, fallback)
    result = result.replace(
      new RegExp(`var\\(\\s*--${originalName}(\\s*[,)])`, "gm"),
      `var(--${scopedName}$1`,
    );
  });
  return result;
};

// ─── @layer Name Scoping ─────────────────────────────────────────────────────

/**
 * Scope `@layer` names declared in a component's CSS so that layer identifiers
 * from different components never collide.
 *
 * All forms are handled:
 *   @layer base { ... }             →  @layer bascik__comp__layer__base { ... }
 *   @layer reset, base, utilities;  →  each name scoped individually
 *
 * Only names that appear in this CSS are scoped — external layer names
 * referenced elsewhere are left untouched.
 */
export const scopeLayerNames = (css: string, componentName: string): string => {
  const layerNames = new Set<string>();
  css.replace(
    /@layer\s+([\w-]+(?:\s*,\s*[\w-]+)*)/g,
    (_: string, nameList: string) => {
      nameList.split(",").forEach((n) => layerNames.add(n.trim()));
      return "";
    },
  );
  if (layerNames.size === 0) return css;
  let result = css;
  layerNames.forEach((name) => {
    const scoped = obfuscateAttributeName(
      `bascik__${componentName}__layer__${name}`,
    );
    result = result.replace(
      new RegExp(`(?<=@layer[^{;]*)\\b${name}\\b`, "gm"),
      scoped,
    );
  });
  return result;
};

// ─── @container Name Scoping ──────────────────────────────────────────────────

/**
 * Scope named `container-name` declarations and `@container name` queries so
 * that container identifiers from different components never collide.
 *
 * Only container names *declared* in this CSS are scoped — unnamed container
 * queries (`@container (min-width: …)`) are left untouched.
 *
 * @example
 *   container-name: sidebar            →  container-name: bascik__comp__container__sidebar
 *   @container sidebar (min-width: …)  →  @container bascik__comp__container__sidebar (…)
 */
export const scopeContainerNames = (
  css: string,
  componentName: string,
): string => {
  const containerNames = new Set<string>();
  css.replace(
    /container(?:-name)?\s*:\s*([\w-]+)/g,
    (_: string, name: string) => {
      if (name !== "none") containerNames.add(name);
      return "";
    },
  );
  if (containerNames.size === 0) return css;
  let result = css;
  containerNames.forEach((name) => {
    const scoped = obfuscateAttributeName(
      `bascik__${componentName}__container__${name}`,
    );
    result = result.replace(
      new RegExp(`(?<=@container\\s+)${name}(?=\\s*[({])`, "gm"),
      scoped,
    );
    result = result.replace(
      new RegExp(`(container(?:-name)?\\s*:\\s*)${name}`, "gm"),
      `$1${scoped}`,
    );
  });
  return result;
};

// ─── Inline <style> Tag Scoping ───────────────────────────────────────────────

/**
 * Process every `<style>` block inside a component's HTML, applying the full
 * CSS scoping pipeline (class names, element selectors, @keyframes, @layer,
 * @container names, and custom properties).
 *
 * Returns the modified HTML and the list of element names converted to classes
 * so the caller can inject those classes into the HTML in one pass, alongside
 * any classes from a paired `.css` file.
 */
export const scopeInlineStyleTags = (
  html: string,
  componentName: string,
): {
  html: string;
  elementsConvertedClasses: string[];
  idsConverted: { idName: string; className: string }[];
} => {
  const allElementClasses: string[] = [];
  const allIdsConverted: { idName: string; className: string }[] = [];
  const processedHtml = html.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, open: string, styleContent: string, close: string) => {
      let css = removeCommentsFromCss(styleContent);
      css = css.replace(/(?<=\.)[a-z_][a-z0-9-_]*/gim, (className) =>
        obfuscateAttributeName(`bascik__${componentName}__${className}`),
      );
      const { css: elCss, elementsConvertedClasses } =
        convertCssElementSelectorsToClasses(css, componentName);
      css = elCss;
      allElementClasses.push(...elementsConvertedClasses);
      const { css: idCss, idsConverted } = convertCssIdSelectorsToClasses(
        css,
        componentName,
      );
      css = idCss;
      allIdsConverted.push(...idsConverted);
      css = prefixKeyframes(css, componentName);
      css = removeIdSelectors(css);
      css = scopeCssCustomProperties(css, componentName);
      css = scopeLayerNames(css, componentName);
      css = scopeContainerNames(css, componentName);
      return `${open}${css}${close}`;
    },
  );
  return {
    html: processedHtml,
    elementsConvertedClasses: allElementClasses,
    idsConverted: allIdsConverted,
  };
};

// ─── CSS Deduplication ────────────────────────────────────────────────────────

/**
 * Return the CSS string for each unique component name exactly once,
 * preserving first-seen order. Prevents duplicate `<style>` blocks when a
 * component is used multiple times on the same page.
 */
export const deduplicateCss = (
  usedComponents: Pick<BascikComponent, "name" | "cssFileContent">[],
  dedup: boolean = true,
): string => {
  if (!dedup) {
    // Per-instance class scoping: every instance emits its own CSS block.
    return usedComponents
      .map(({ cssFileContent }) => cssFileContent)
      .filter((css): css is string => Boolean(css))
      .join(" ");
  }
  const seen = new Set<string>();
  return usedComponents
    .filter(({ name }) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .map(({ cssFileContent }) => cssFileContent)
    .filter((css): css is string => Boolean(css))
    .join(" ");
};
