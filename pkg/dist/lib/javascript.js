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
 *
 *   class attribute:
 *     getElementsByClassName("x") → getElementsByClassName("bascik__...__x")
 *     querySelector(".x")        →  querySelector(".bascik__...__x")
 *     querySelectorAll(".x")     →  querySelectorAll(".bascik__...__x")
 *     querySelector(".x .y")     →  querySelector(".bascik__...__x .bascik__...__y")
 *     closest(".x")              →  closest(".bascik__...__x")
 *     matches(".x")              →  matches(".bascik__...__x")
 *     classList.add("x")         →  classList.add("bascik__...__x")
 *     classList.remove("x")      →  classList.remove("bascik__...__x")
 *     classList.toggle("x")      →  classList.toggle("bascik__...__x")
 *     classList.contains("x")    →  classList.contains("bascik__...__x")
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
import { addElementClassesInHtml, addIdClassesInHtml, convertCssElementSelectorsToClasses, convertCssIdSelectorsToClasses, prefixKeyframes, removeIdSelectors, scopeCssCustomProperties, scopeLayerNames, scopeContainerNames, scopeInlineStyleTags, } from "./styles.js";
/**
 * Preserve the inner content of named elements in `html`, replacing each with a
 * placeholder sentinel.  Returns the modified html and a `restore` function
 * that puts the original content back.  Used to shield element contents (e.g.
 * `<code>`, `<pre>`) from the scoping pipeline so their text is never rewritten.
 */
const preserveElementContents = (html, tags) => {
    if (!tags.length)
        return { html, restore: (h) => h };
    const preserved = [];
    let result = html;
    for (const tag of tags) {
        const esc = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result = result.replace(new RegExp(`(<${esc}(?:\\b[^>]*)?>)([\\s\\S]*?)(<\\/${esc}>)`, "gi"), (_match, open, inner, close) => {
            preserved.push(inner);
            return `${open}\x00BSKIP${preserved.length - 1}\x00${close}`;
        });
    }
    return {
        html: result,
        restore: (h) => {
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
export const prefixElementAttribute = (component, attribute, componentInstanceId = null, deduplicateCss = true, skipElementContents = []) => {
    if (!component.fileContent)
        return component;
    // Shield inner content of skip elements (e.g. <code>, <pre>) from all transforms.
    const { html: shieldedContent, restore } = preserveElementContents(component.fileContent, skipElementContents);
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
    const scopeKey = attribute === "class" && deduplicateCss ? component.name : componentInstanceName;
    const attributesToReplace = [];
    // Use [\s\n\r\t] or \s to handle newlines before the attribute name
    const regexp = new RegExp(`(?<=\\s${attribute}=")[\\s\\S]+?(?=")`, "gm");
    const scopedAttrsHtml = component.fileContent.replace(regexp, (match) => {
        if (!match)
            return "";
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
    // Rewrite DOM selector references in script blocks to use the scoped attribute values.
    const scopedHtml = scopedAttrsHtml.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (match) => {
        let updatedMatch = match;
        attributesToReplace.forEach(({ attributeName, obfuscatedAttributeName }) => {
            const rewriteSelectorRef = (regexp, dot = "") => {
                // https://www.codemzy.com/blog/regex-groups-with-replace
                return updatedMatch.replace(regexp, (match, start, middle, end) => {
                    return `${start}${dot}${obfuscatedAttributeName}${end}`;
                });
            };
            // Escape the attribute name once for use in RegExp patterns.
            const escapedAttr = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            // Rewrite the full selector string of a querySelector-family call,
            // replacing every occurrence of the scoped token.  Handles both
            // single-token selectors ("#id", ".cls") and compound selectors
            // (".foo .bar", "#id .child", etc.).
            // Limitation: adjacent-class compound selectors without a space
            // (.foo.bar) are not rewritten for the non-leading token because
            // `.bar` is preceded by a word character.  Use a space or combinator
            // to separate selectors instead.
            const rewriteInSelectorString = (method, prefix) => {
                updatedMatch = updatedMatch.replace(new RegExp(`(${method}\\(['"][^'"]*['"]\\))`, "gm"), (call) => call.replace(
                // Token must NOT be immediately preceded or followed by
                // alphanumeric, underscore, or hyphen (avoids partial
                // matches inside already-scoped names like __myClass).
                new RegExp(`(?<![a-zA-Z0-9_-])\\${prefix}${escapedAttr}(?![a-zA-Z0-9_-])`, "g"), `${prefix}${obfuscatedAttributeName}`));
            };
            if (attribute === "id") {
                updatedMatch = rewriteSelectorRef(new RegExp(`(?<start>getElementById\\(["'])(?<middle>${attributeName})(?<end>["']\\))`, "gm"));
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
                updatedMatch = rewriteSelectorRef(new RegExp(`(?<start>setAttribute\\(["']id["'],\\s*["'])(?<middle>${attributeName})(?<end>["']\\))`, "gm"));
            }
            else if (attribute === "name") {
                updatedMatch = rewriteSelectorRef(new RegExp(`(?<start>getElementsByName\\(["'])(?<middle>${attributeName})(?<end>["']\\))`, "gm"));
            }
            else if (attribute === "class") {
                updatedMatch = rewriteSelectorRef(new RegExp(`(?<start>getElementsByClassName\\(["'])(?<middle>${attributeName})(?<end>["']\\))`, "gm"));
                // querySelector-family — compound-aware
                for (const method of [
                    "querySelector",
                    "querySelectorAll",
                    "closest",
                    "matches",
                ]) {
                    rewriteInSelectorString(method, ".");
                }
                // classList methods take the class name without the leading `.`
                updatedMatch = rewriteSelectorRef(new RegExp(`(?<start>classList\\.(?:add|remove|toggle|contains)\\(["'])(?<middle>${attributeName})(?<end>["']\\))`, "gm"));
                // element.setAttribute("class", "value")
                updatedMatch = rewriteSelectorRef(new RegExp(`(?<start>setAttribute\\(["']class["'],\\s*["'])(?<middle>${attributeName})(?<end>["']\\))`, "gm"));
                // element.className setter — handles both single-class and
                // space-separated multi-class assignments (className = "…" or
                // className += "…").  Replaces each known class token in the
                // string value using the same word-boundary guards as above.
                updatedMatch = updatedMatch.replace(/(\bclassName\s*\+?=\s*["'])([^"']*)(['"])/gm, (_, prefix, classes, suffix) => {
                    const replaced = classes.replace(new RegExp(`(?<![a-zA-Z0-9_-])${escapedAttr}(?![a-zA-Z0-9_-])`, "g"), obfuscatedAttributeName);
                    return `${prefix}${replaced}${suffix}`;
                });
            }
        });
        return updatedMatch;
    });
    component.fileContent = scopedHtml;
    // CSS
    if (attribute === "class") {
        // Collect element names and id names converted to classes from all CSS
        // sources so we can inject the generated classes into the HTML in one pass.
        let allElementClasses = [];
        let allIdsConverted = [];
        if (component.cssFileContent) {
            // Handle basic replacement of classnames in css file
            component.cssFileContent = component.cssFileContent.replace(/(?<=\.)[a-z_][a-z0-9-_]*/gim, (className) => {
                return obfuscateAttributeName(`bascik__${scopeKey}__${className}`);
            });
            const { css: elSelectorToClassCss, elementsConvertedClasses } = convertCssElementSelectorsToClasses(component.cssFileContent, scopeKey);
            component.cssFileContent = elSelectorToClassCss;
            allElementClasses.push(...elementsConvertedClasses);
            component.cssFileContent = prefixKeyframes(component.cssFileContent, scopeKey);
            // Convert CSS hash-ID selectors (#id) to component-scoped class selectors.
            // Uses a context-aware lookahead to avoid matching hex colour values.
            const { css: idSelectorCss, idsConverted } = convertCssIdSelectorsToClasses(component.cssFileContent, scopeKey);
            component.cssFileContent = idSelectorCss;
            allIdsConverted.push(...idsConverted);
            // Strip the [id] attribute-selector form (cannot be scoped without wrapping).
            component.cssFileContent = removeIdSelectors(component.cssFileContent);
            // Scope CSS custom properties (--var-name declarations and var() references)
            component.cssFileContent = scopeCssCustomProperties(component.cssFileContent, scopeKey);
            // Scope @layer names
            component.cssFileContent = scopeLayerNames(component.cssFileContent, scopeKey);
            // Scope @container names
            component.cssFileContent = scopeContainerNames(component.cssFileContent, scopeKey);
        }
        // Scope inline <style> tags in the component HTML and collect any
        // element/id classes they define.
        const inlineResult = scopeInlineStyleTags(component.fileContent, scopeKey);
        component.fileContent = inlineResult.html;
        allElementClasses.push(...inlineResult.elementsConvertedClasses);
        allIdsConverted.push(...inlineResult.idsConverted);
        // Inject element classes into the HTML once from all CSS sources combined.
        component.fileContent = addElementClassesInHtml(component.fileContent, scopeKey, allElementClasses);
        // Inject id-derived classes onto elements with matching id attributes.
        component.fileContent = addIdClassesInHtml(component.fileContent, allIdsConverted);
    }
    // Restore any inner content that was shielded from transforms.
    component.fileContent = restore(component.fileContent);
    return component;
};
export const namespaceScriptTags = (component) => {
    // Only wrap <script> tags with no type or type="text/javascript"
    component.fileContent = component.fileContent.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (match, open, code, close) => {
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
    });
    return component;
};
//# sourceMappingURL=javascript.js.map