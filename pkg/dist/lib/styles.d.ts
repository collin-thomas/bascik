import type { BascikComponent } from "./types.js";
export declare const convertCssElementSelectorsToClasses: (css: string, componentName: string) => {
    css: string;
    elementsConvertedClasses: string[];
};
/**
 * If a component's css styles any element, add bascik classes to those elements
 */
export declare const addElementClassesInHtml: (componentHtml: string, componentName: string, elementsConvertedClasses?: string[]) => string;
/** Returns all `.class { }` rule strings. Useful for CSS analysis. */
export declare const getCssClasses: (css: string) => string[];
export declare const getKeyframeNames: (css: string) => string[] | null;
export declare const prefixKeyframes: (css: string, componentName: string) => string;
export declare const removeIdSelectors: (css: string) => string;
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
export declare const convertCssIdSelectorsToClasses: (css: string, componentName: string) => {
    css: string;
    idsConverted: {
        idName: string;
        className: string;
    }[];
};
/**
 * Inject the generated id-class onto every HTML element whose `id` attribute
 * matches.  Works for both unscoped (`id="idName"`) and already-scoped
 * (`id="bascik__comp__instanceId__idName"`) forms.
 */
export declare const addIdClassesInHtml: (html: string, idsConverted: {
    idName: string;
    className: string;
}[]) => string;
export declare const removeCommentsFromCss: (css: string) => string;
/**
 * Minify a CSS string: strip comments, collapse whitespace, and remove
 * spaces around structural characters (`{`, `}`, `:`, `;`, `,`).
 */
export declare const minifyCss: (css: string) => string;
export declare const getComponentCss: (htmlFileName: string, cssFileNames: string[]) => Promise<string | undefined>;
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
export declare const scopeCssCustomProperties: (css: string, componentName: string) => string;
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
export declare const scopeLayerNames: (css: string, componentName: string) => string;
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
export declare const scopeContainerNames: (css: string, componentName: string) => string;
/**
 * Process every `<style>` block inside a component's HTML, applying the full
 * CSS scoping pipeline (class names, element selectors, @keyframes, @layer,
 * @container names, and custom properties).
 *
 * Returns the modified HTML and the list of element names converted to classes
 * so the caller can inject those classes into the HTML in one pass, alongside
 * any classes from a paired `.css` file.
 */
export declare const scopeInlineStyleTags: (html: string, componentName: string) => {
    html: string;
    elementsConvertedClasses: string[];
    idsConverted: {
        idName: string;
        className: string;
    }[];
};
/**
 * Return the CSS string for each unique component name exactly once,
 * preserving first-seen order. Prevents duplicate `<style>` blocks when a
 * component is used multiple times on the same page.
 */
export declare const deduplicateCss: (usedComponents: Pick<BascikComponent, "name" | "cssFileContent">[], dedup?: boolean) => string;
