/**
 * @module javascript
 *
 * Component Attribute & Script Scoping
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `prefixElementAttribute` is the core scoping transform.  It is called once
 * per attribute type (id / name / class) per component instance, using the
 * same `instanceId` for id and name so that HTML and JS stay in sync.
 *
 * Class attributes intentionally use the component NAME as their scope key
 * (not the instanceId).  This means every instance of the same component on
 * a page shares identical scoped class names, which lets `deduplicateCss`
 * emit a single `<style>` block regardless of how many times the component
 * is used.  IDs and names still use the instanceId to guarantee unique DOM
 * identifiers across multiple instances.
 *
 * For EACH value of the targeted attribute in the component template:
 *
 *   id / name  → bascik__<name>__<instanceId>__<original>
 *   class      → bascik__<name>__<original>          (no instanceId)
 *
 * HTML pass  — rewrites every matching attribute value in the template HTML.
 *
 * JS pass    — rewrites DOM selector references in every <script> block:
 *
 *   id attribute:
 *     getElementById("x")        →  getElementById("bascik__...__x")
 *     querySelector("#x")        →  querySelector("#bascik__...__x")
 *     querySelectorAll("#x")     →  querySelectorAll("#bascik__...__x")
 *     querySelector("#x .child") →  querySelector("#bascik__...__x .child")
 *     closest("#x")              →  closest("#bascik__...__x")
 *     matches("#x")              →  matches("#bascik__...__x")
 *     setAttribute("id","x")     →  setAttribute("id","bascik__...__x")
 *
 *   name attribute:
 *     getElementsByName("x")     →  getElementsByName("bascik__...__x")
 *     setAttribute("name","x")   →  setAttribute("name","bascik__...__x")
 *
 *   class attribute:
 *     getElementsByClassName("x") → getElementsByClassName("bascik__...__x")
 *     querySelector(".x")        →  querySelector(".bascik__...__x")
 *     querySelectorAll(".x")     →  querySelectorAll(".bascik__...__x")
 *     querySelector(".x .y")     →  querySelector(".bascik__...__x .bascik__...__y")
 *     closest(".x")              →  closest(".bascik__...__x")
 *     matches(".x")              →  matches(".bascik__...__x")
 *     classList.add("x")         →  classList.add("bascik__...__x")
 *     classList.add("x","y")     →  classList.add("bascik__...__x","bascik__...__y")
 *     classList.remove("x")      →  classList.remove("bascik__...__x")
 *     classList.remove("x","y")  →  classList.remove("bascik__...__x","bascik__...__y")
 *     classList.toggle("x")      →  classList.toggle("bascik__...__x")
 *     classList.toggle("x",cond) →  classList.toggle("bascik__...__x",cond)
 *     classList.contains("x")    →  classList.contains("bascik__...__x")
 *     classList.replace("x","y") →  classList.replace("bascik__...__x","bascik__...__y")
 *     setAttribute("class","x")  →  setAttribute("class","bascik__...__x")
 *     el.className = "x"         →  el.className = "bascik__...__x"
 *     el.className = "x y"       →  el.className = "bascik__...__x bascik__...__y"
 *     el.className += " x"       →  el.className += " bascik__...__x"
 *
 * CSS pass  (class attribute only) — rewrites the component's .css file AND
 * any inline <style> tags in the HTML:
 *   .className       →  .bascik__...__className      (class prefixing)
 *   p { }            →  .bascik__...__el__p { }       (element → class)
 *   @keyframes name  →  @keyframes bascik__...__keyframe__name
 *   animation: name  →  animation: bascik__...__keyframe__name
 *   @layer name      →  @layer bascik__...__layer__name
 *   container-name:  →  container-name: bascik__...__container__name
 *   --var-name:      →  --bascik__...__var-name:      (custom properties)
 *   var(--var-name)  →  var(--bascik__...__var-name)
 *   [id] { }         →  (stripped — cannot be scoped without DOM wrapping)
 *
 * `namespaceScriptTags` wraps every `text/javascript` script in an IIFE so
 * that variables declared inside one component cannot leak into another.
 */

import { getUniqueId, obfuscateAttributeName } from "./names.js";
import {
  addElementClassesInHtml,
  addIdClassesInHtml,
  convertCssElementSelectorsToClasses,
  convertCssIdSelectorsToClasses,
  prefixKeyframes,
  removeIdSelectors,
  scopeCssCustomProperties,
  scopeLayerNames,
  scopeContainerNames,
  scopeViewTransitionNames,
  scopeCounterStyleNames,
  scopeAnchorNames,
  scopeInlineStyleTags,
  shieldCssStrings,
} from "./styles.js";
import type { BascikComponent } from "./types.js";

/**
 * Preserve the inner content of named elements in `html`, replacing each with a
 * placeholder sentinel.  Returns the modified html and a `restore` function
 * that puts the original content back.  Used to shield element contents (e.g.
 * `<code>`, `<pre>`) from the scoping pipeline so their text is never rewritten.
 */
const preserveElementContents = (
  html: string,
  tags: string[],
): { html: string; restore: (h: string) => string } => {
  if (!tags.length) return { html, restore: (h) => h };
  const preserved: string[] = [];
  let result = html;
  for (const tag of tags) {
    const esc = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Quote-aware open tag: attribute values may contain `>` (e.g.
    // <code data-x="a>b">), so consume quoted strings or non-`>` runs
    // instead of a plain [^>]* that would end the match early.
    const attr = `(?:"[^"]*"|'[^']*'|[^>"'])*`;
    result = result.replace(
      new RegExp(`(<${esc}(?:\\b${attr})?>)([\\s\\S]*?)(<\\/${esc}>)`, "gi"),
      (_match, open, inner, close) => {
        preserved.push(inner);
        return `${open}\x00BSKIP${preserved.length - 1}\x00${close}`;
      },
    );
  }
  return {
    html: result,
    restore: (h: string) => {
      // Restore from highest index to lowest so that outer sentinels (which were
      // created after inner ones and whose preserved content may itself contain
      // inner sentinels) are expanded first, revealing the inner sentinels for
      // the subsequent iterations to resolve.
      let out = h;
      for (let i = preserved.length - 1; i >= 0; i--) {
        out = out.split(`\x00BSKIP${i}\x00`).join(preserved[i]);
      }
      return out;
    },
  };
};

export const prefixElementAttribute = (
  component: BascikComponent,
  attribute: "id" | "name" | "class",
  componentInstanceId: string | null = null,
  deduplicateCss: boolean = true,
  skipElementContents: string[] = [],
): BascikComponent => {
  if (!component.fileContent) return component;

  // Shield inner content of skip elements (e.g. <code>, <pre>) from all transforms.
  const { html: shieldedContent, restore } = preserveElementContents(
    component.fileContent,
    skipElementContents,
  );
  component.fileContent = shieldedContent;
  // All class/name/id attrs will get this ID.
  // Accept an externally provided ID so that a single component instance can
  // share one ID across all attribute types (id, name, class).
  const instanceId = componentInstanceId ?? getUniqueId(8);
  const componentInstanceName = `${component.name}__${instanceId}`;
  // When deduplicateCss is true (default): class attributes are scoped to the
  // component NAME only (no instanceId) so all instances share identical class
  // names, allowing CSS to be emitted once per component type.
  // When deduplicateCss is false: class attributes use the per-instance key
  // (same as id/name) so each instance gets unique class names — JS class-
  // selector queries like querySelector('.myClass') naturally target only the
  // current instance's elements, at the cost of per-instance CSS blocks.
  // IDs and names always keep the instanceId so multiple instances have unique DOM nodes.
  const scopeKey =
    attribute === "class" && deduplicateCss ? component.name : componentInstanceName;
  const attributesToReplace: Array<{
    attributeName: string;
    obfuscatedAttributeName: string;
  }> = [];

  // Shield <meta> elements from name-attribute scoping. The `name` attribute
  // on <meta> refers to a standardized metadata vocabulary (e.g. "viewport",
  // "description", "robots") and must never be mangled by the scoping pipeline.
  const shieldedMetaTags: string[] = [];
  if (attribute === "name") {
    component.fileContent = component.fileContent.replace(
      /<meta\b[^>]*(?:\/>|>)/gi,
      (tag) => {
        const idx = shieldedMetaTags.push(tag) - 1;
        return `\x00BMETATAG${idx}\x00`;
      },
    );
  }

  // Use [\s\n\r\t] or \s to handle newlines before the attribute name
  const regexp = new RegExp(`(?<=\\s${attribute}=")[\\s\\S]+?(?=")`, "gm");
  const scopedAttrsHtml = component.fileContent.replace(regexp, (match) => {
    if (!match) return "";
    return match
      .replace(/  +/g, " ")
      .split(" ")
      .map((attributeName) => {
        const name = `bascik__${scopeKey}__${attributeName}`;
        const obfuscatedAttributeName = obfuscateAttributeName(name);
        attributesToReplace.push({ attributeName, obfuscatedAttributeName });
        return obfuscatedAttributeName;
      })
      .join(" ");
  });

  // Discover class names used only in JS (never in a class= attr).
  // The CSS pass scopes every class name it finds, so JS-only classes would
  // otherwise be scoped in CSS but left unscoped in JS, making the two out of sync.
  // Covers: classList.*, querySelector-family (".cls"), className =, setAttribute("class",…)
  if (attribute === "class") {
    const knownClasses = new Set(attributesToReplace.map((a) => a.attributeName));
    const addIfNew = (className: string): void => {
      if (!knownClasses.has(className)) {
        attributesToReplace.push({
          attributeName: className,
          obfuscatedAttributeName: obfuscateAttributeName(`bascik__${scopeKey}__${className}`),
        });
        knownClasses.add(className);
      }
    };

    for (const scriptMatch of scopedAttrsHtml.matchAll(
      /<script\b[^>]*>([\s\S]*?)<\/script[^>]*>/gi,
    )) {
      const src = scriptMatch[1];

      // classList.add/remove/toggle/contains/replace — extract every quoted token
      for (const callMatch of src.matchAll(
        /classList\.(?:add|remove|toggle|contains|replace)\(([^)]*)\)/gm,
      )) {
        for (const tokenMatch of callMatch[1].matchAll(/["']([^"']+)["']/g)) {
          addIfNew(tokenMatch[1]);
        }
      }

      // querySelector / querySelectorAll / closest / matches — extract ".token" class tokens
      for (const callMatch of src.matchAll(
        /(?:querySelector(?:All)?|closest|matches)\(\s*["']([^"']*)["']\s*\)/gm,
      )) {
        for (const tokenMatch of callMatch[1].matchAll(
          /(?<![a-zA-Z0-9_-])\.([a-zA-Z_][a-zA-Z0-9_-]*)/g,
        )) {
          addIfNew(tokenMatch[1]);
        }
      }

      // el.className = "x y" and el.className += " x"
      for (const assignMatch of src.matchAll(
        /\bclassName\s*\+?=\s*["']([^"']*)["']/gm,
      )) {
        for (const token of assignMatch[1].trim().split(/\s+/)) {
          if (token) addIfNew(token);
        }
      }

      // setAttribute("class", "x y")
      for (const attrMatch of src.matchAll(
        /setAttribute\(\s*["']class["']\s*,\s*["']([^"']*)["']\s*\)/gm,
      )) {
        for (const token of attrMatch[1].trim().split(/\s+/)) {
          if (token) addIfNew(token);
        }
      }
    }
  }

  // Rewrite DOM selector references in script blocks to use the scoped attribute values.
  const scopedHtml = scopedAttrsHtml.replace(
    /<script\b[^>]*>([\s\S]*?)<\/script[^>]*>/gi,
    (match) => {
      let updatedMatch = match;
      attributesToReplace.forEach(
        ({ attributeName, obfuscatedAttributeName }) => {
          const rewriteSelectorRef = (regexp: RegExp, dot = ""): string => {
            // https://www.codemzy.com/blog/regex-groups-with-replace
            return updatedMatch.replace(regexp, (match, start, middle, end) => {
              return `${start}${dot}${obfuscatedAttributeName}${end}`;
            });
          };

          // Escape the attribute name once for use in RegExp patterns.
          const escapedAttr = attributeName.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          );

          // Rewrite the full selector string of a querySelector-family call,
          // replacing every occurrence of the scoped token.  Handles both
          // single-token selectors ("#id", ".cls") and compound selectors
          // (".foo .bar", "#id .child", etc.).
          // Limitation: adjacent-class compound selectors without a space
          // (.foo.bar) are not rewritten for the non-leading token because
          // `.bar` is preceded by a word character.  Use a space or combinator
          // to separate selectors instead.
          const rewriteInSelectorString = (
            method: string,
            prefix: string,
          ): void => {
            updatedMatch = updatedMatch.replace(
              new RegExp(`(${method}\\(['"][^'"]*['"]\\))`, "gm"),
              (call) =>
                call.replace(
                  // Token must NOT be immediately preceded or followed by
                  // alphanumeric, underscore, or hyphen (avoids partial
                  // matches inside already-scoped names like __myClass).
                  new RegExp(
                    `(?<![a-zA-Z0-9_-])\\${prefix}${escapedAttr}(?![a-zA-Z0-9_-])`,
                    "g",
                  ),
                  `${prefix}${obfuscatedAttributeName}`,
                ),
            );
          };

          if (attribute === "id") {
            updatedMatch = rewriteSelectorRef(
              new RegExp(
                `(?<start>getElementById\\(["'])(?<middle>${escapedAttr})(?<end>["']\\))`,
                "gm",
              ),
            );
            // querySelector-family — compound-aware
            for (const method of [
              "querySelector",
              "querySelectorAll",
              "closest",
              "matches",
            ]) {
              rewriteInSelectorString(method, "#");
            }
            // element.setAttribute("id", "value")
            updatedMatch = rewriteSelectorRef(
              new RegExp(
                `(?<start>setAttribute\\(["']id["'],\\s*["'])(?<middle>${escapedAttr})(?<end>["']\\))`,
                "gm",
              ),
            );
          } else if (attribute === "name") {
            updatedMatch = rewriteSelectorRef(
              new RegExp(
                `(?<start>getElementsByName\\(["'])(?<middle>${escapedAttr})(?<end>["']\\))`,
                "gm",
              ),
            );
            // element.setAttribute("name", "value")
            updatedMatch = rewriteSelectorRef(
              new RegExp(
                `(?<start>setAttribute\\(["']name["'],\\s*["'])(?<middle>${escapedAttr})(?<end>["']\\))`,
                "gm",
              ),
            );
          } else if (attribute === "class") {
            updatedMatch = rewriteSelectorRef(
              new RegExp(
                `(?<start>getElementsByClassName\\(["'])(?<middle>${escapedAttr})(?<end>["']\\))`,
                "gm",
              ),
            );
            // querySelector-family — compound-aware
            for (const method of [
              "querySelector",
              "querySelectorAll",
              "closest",
              "matches",
            ]) {
              rewriteInSelectorString(method, ".");
            }
            // classList.add / classList.remove — multi-arg aware.
            // Match the entire call then replace every quoted token matching
            // the class name. Handles both `classList.add("x")` and
            // `classList.add("x", "y", …)` forms.
            updatedMatch = updatedMatch.replace(
              /classList\.(?:add|remove)\([^)]*\)/gm,
              (call) =>
                call.replace(
                  new RegExp(`(["'])${escapedAttr}\\1`, "g"),
                  `$1${obfuscatedAttributeName}$1`,
                ),
            );
            // classList.toggle — rewrites the class-name (first) arg only.
            // Deliberately does NOT require `)` after the closing quote so
            // `classList.toggle("open", condition)` is handled correctly.
            updatedMatch = rewriteSelectorRef(
              new RegExp(
                `(?<start>classList\.toggle\\(["'])(?<middle>${escapedAttr})(?<end>["'])`,
                "gm",
              ),
            );
            // classList.contains — always single arg
            updatedMatch = rewriteSelectorRef(
              new RegExp(
                `(?<start>classList\.contains\\(["'])(?<middle>${escapedAttr})(?<end>["']\\))`,
                "gm",
              ),
            );
            // classList.replace(oldToken, newToken) — rewrites both args if
            // either matches a scoped class name.
            updatedMatch = updatedMatch.replace(
              /classList\.replace\([^)]*\)/gm,
              (call) =>
                call.replace(
                  new RegExp(`(["'])${escapedAttr}\\1`, "g"),
                  `$1${obfuscatedAttributeName}$1`,
                ),
            );
            // element.setAttribute("class", "value")
            updatedMatch = rewriteSelectorRef(
              new RegExp(
                `(?<start>setAttribute\\(["']class["'],\\s*["'])(?<middle>${escapedAttr})(?<end>["']\\))`,
                "gm",
              ),
            );
            // element.className setter — handles both single-class and
            // space-separated multi-class assignments (className = "…" or
            // className += "…").  Replaces each known class token in the
            // string value using the same word-boundary guards as above.
            updatedMatch = updatedMatch.replace(
              /(\bclassName\s*\+?=\s*["'])([^"']*)(['"])/gm,
              (_, prefix, classes, suffix) => {
                const replaced = classes.replace(
                  new RegExp(
                    `(?<![a-zA-Z0-9_-])${escapedAttr}(?![a-zA-Z0-9_-])`,
                    "g",
                  ),
                  obfuscatedAttributeName,
                );
                return `${prefix}${replaced}${suffix}`;
              },
            );
          }
        },
      );
      return updatedMatch;
    },
  );
  component.fileContent = scopedHtml;

  // Restore shielded <meta> elements.
  if (shieldedMetaTags.length > 0) {
    component.fileContent = component.fileContent.replace(
      /\x00BMETATAG(\d+)\x00/g,
      (_, idx) => shieldedMetaTags[parseInt(idx, 10)],
    );
  }

  // CSS
  if (attribute === "class") {
    // Collect element names and id names converted to classes from all CSS
    // sources so we can inject the generated classes into the HTML in one pass.
    let allElementClasses: string[] = [];
    let allIdsConverted: { idName: string; className: string }[] = [];

    if (component.cssFileContent) {
      // Handle basic replacement of classnames in css file.
      // Shield string literals and url(...) contents first so dots inside
      // them (file extensions, domains) are never mistaken for class selectors:
      //   url(./img.png)  must NOT become  url(./img.bascik__…__png)
      const { css: shieldedCss, restore: restoreCssStrings } = shieldCssStrings(
        component.cssFileContent,
      );
      component.cssFileContent = restoreCssStrings(
        shieldedCss.replace(/(?<=\.)[a-z_][a-z0-9-_]*/gim, (className) => {
          return obfuscateAttributeName(`bascik__${scopeKey}__${className}`);
        }),
      );

      const { css: elSelectorToClassCss, elementsConvertedClasses } =
        convertCssElementSelectorsToClasses(component.cssFileContent, scopeKey);
      component.cssFileContent = elSelectorToClassCss;
      allElementClasses.push(...elementsConvertedClasses);

      component.cssFileContent = prefixKeyframes(
        component.cssFileContent,
        scopeKey,
      );

      // Convert CSS hash-ID selectors (#id) to component-scoped class selectors.
      // Uses a context-aware lookahead to avoid matching hex colour values.
      const { css: idSelectorCss, idsConverted } =
        convertCssIdSelectorsToClasses(component.cssFileContent, scopeKey);
      component.cssFileContent = idSelectorCss;
      allIdsConverted.push(...idsConverted);

      // Strip the [id] attribute-selector form (cannot be scoped without wrapping).
      component.cssFileContent = removeIdSelectors(component.cssFileContent);

      // Scope CSS custom properties (--var-name declarations and var() references)
      component.cssFileContent = scopeCssCustomProperties(
        component.cssFileContent,
        scopeKey,
      );

      // Scope @layer names
      component.cssFileContent = scopeLayerNames(
        component.cssFileContent,
        scopeKey,
      );

      // Scope @container names
      component.cssFileContent = scopeContainerNames(
        component.cssFileContent,
        scopeKey,
      );

      // Scope view-transition-name values
      component.cssFileContent = scopeViewTransitionNames(
        component.cssFileContent,
        scopeKey,
      );

      // Scope @counter-style names
      component.cssFileContent = scopeCounterStyleNames(
        component.cssFileContent,
        scopeKey,
      );

      // Scope anchor-name / @position-try identifiers
      component.cssFileContent = scopeAnchorNames(
        component.cssFileContent,
        scopeKey,
      );
    }

    // Scope inline <style> tags in the component HTML and collect any
    // element/id classes they define.
    const inlineResult = scopeInlineStyleTags(component.fileContent, scopeKey);
    component.fileContent = inlineResult.html;
    allElementClasses.push(...inlineResult.elementsConvertedClasses);
    allIdsConverted.push(...inlineResult.idsConverted);

    // Inject element classes into the HTML once from all CSS sources combined.
    component.fileContent = addElementClassesInHtml(
      component.fileContent,
      scopeKey,
      allElementClasses,
    );

    // Inject id-derived classes onto elements with matching id attributes.
    component.fileContent = addIdClassesInHtml(
      component.fileContent,
      allIdsConverted,
    );
  }

  // Restore any inner content that was shielded from transforms.
  component.fileContent = restore(component.fileContent);

  return component;
};

export const namespaceScriptTags = (
  component: BascikComponent,
): BascikComponent => {
  // Only wrap <script> tags with no type or type="text/javascript"
  component.fileContent = component.fileContent.replace(
    /(<script\b[^>]*>)([\s\S]*?)(<\/script[^>]*>)/gi,
    (match, open, code, close) => {
      // Server scripts run in Node.js at request time — never wrap in browser IIFE
      if (/\bdata-bascik-server\b/i.test(open)) return match;
      // Check for type attribute
      const typeMatch = open.match(/type\s*=\s*["']?([^"'>\s]+)["']?/i);
      if (typeMatch && typeMatch[1].toLowerCase() !== "text/javascript") {
        // If type is present and not text/javascript, leave unchanged
        return match;
      }
      // Otherwise, wrap in IIFE
      return `${open}
        (function() {
          ${code}
        })();
        ${close}`;
    },
  );
  return component;
};

// ─── Built-in JS minifier ────────────────────────────────────────────────────

/**
 * Strip block/line comments and collapse whitespace from a JS string.
 * String literals and template literals are copied verbatim so their content
 * is never altered.  This is the default minifier used when
 * `minifyScripts: true` is set in bascik.config.ts.
 *
 * For production-quality output (dead-code elimination, identifier mangling,
 * etc.) configure `minifyScripts` with a custom function backed by esbuild,
 * terser, or similar instead.
 */
export const minifyJs = (js: string): string => {
  // Collect segments: code regions get whitespace collapsed; literal regions
  // (strings, template literals) are preserved exactly so their content is
  // never altered by the post-processing regex passes.
  type Segment = { literal: boolean; text: string };
  const segments: Segment[] = [];
  let codeAccum = "";
  let i = 0;
  const len = js.length;

  const flushCode = (): void => {
    if (codeAccum) {
      segments.push({ literal: false, text: codeAccum });
      codeAccum = "";
    }
  };

  while (i < len) {
    const ch = js[i];

    // Quoted string literals — flush code, collect literal verbatim
    if (ch === '"' || ch === "'") {
      flushCode();
      const quote = ch;
      let lit = ch;
      i++;
      while (i < len) {
        const c = js[i];
        if (c === "\\" && i + 1 < len) { lit += c + js[i + 1]; i += 2; continue; }
        lit += c;
        i++;
        if (c === quote) break;
      }
      segments.push({ literal: true, text: lit });
      continue;
    }

    // Template literals — flush code, collect literal verbatim
    if (ch === "`") {
      flushCode();
      let lit = "`";
      i++;
      while (i < len) {
        const c = js[i];
        if (c === "\\" && i + 1 < len) { lit += c + js[i + 1]; i += 2; continue; }
        lit += c;
        i++;
        if (c === "`") break;
      }
      segments.push({ literal: true, text: lit });
      continue;
    }

    // Potential comment, division, or regex literal — all start with "/".
    if (ch === "/") {
      const next = js[i + 1];

      // A regex literal can only appear where an *expression* is expected —
      // i.e. the previous significant token is not an identifier, number,
      // string-ending quote, `)`, `]`, or `}`.  Division, by contrast, always
      // follows a value.  Use that to disambiguate `/` before deciding whether
      // `//` or `/*` starts a comment.
      const prevSignificant = codeAccum.replace(/\s+$/, "").slice(-1);
      // `//` and `/*` can never open a regex literal — only a lone `/` can.
      const couldBeRegex =
        next !== "/" && next !== "*" && !/[\w)\]}"'`$]/.test(prevSignificant);

      if (couldBeRegex) {
        // Try to read a regex literal: /pattern/flags, honouring escapes and
        // character classes so `/` inside `[/]` or after `\` doesn't end it.
        let j = i + 1;
        let inClass = false;
        let closed = false;
        while (j < len) {
          const c = js[j];
          if (c === "\\") { j += 2; continue; }
          if (c === "[") inClass = true;
          else if (c === "]") inClass = false;
          else if (c === "/" && !inClass) { closed = true; j++; break; }
          else if (c === "\n") break; // unterminated — not a regex
          j++;
        }
        if (closed) {
          // Consume flags
          while (j < len && /[a-z]/i.test(js[j])) j++;
          flushCode();
          segments.push({ literal: true, text: js.slice(i, j) });
          i = j;
          continue;
        }
        // Not a valid regex — fall through and treat as division/operators.
      }

      if (next === "*") {
        // Block comment: skip to */
        i += 2;
        while (i + 1 < len && !(js[i] === "*" && js[i + 1] === "/")) i++;
        i += 2;
        // Preserve a token boundary
        if (codeAccum.length > 0 && !/\s$/.test(codeAccum)) codeAccum += " ";
        continue;
      }
      if (next === "/") {
        // Line comment: skip to end of line (the newline itself is kept)
        i += 2;
        while (i < len && js[i] !== "\n") i++;
        continue;
      }
    }

    codeAccum += ch;
    i++;
  }
  flushCode();

  return segments
    .map(({ literal, text }) => {
      if (literal) return text;
      return text
        .replace(/[ \t]+/g, " ")  // collapse runs of spaces/tabs
        .replace(/ *\n */g, "\n") // trim spaces around newlines
        .replace(/\n{2,}/g, "\n"); // collapse multiple blank lines
    })
    .join("")
    .trim();
};
