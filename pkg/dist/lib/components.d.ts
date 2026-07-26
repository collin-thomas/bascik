import type { BascikComponent, ComponentList } from "./types.js";
/** Load all component HTML and CSS files from the configured components directory. */
export declare const listComponents: () => Promise<ComponentList>;
export declare const replaceTag: (htmlString: string, tagName: string, transpiledTag: string) => string;
export declare const getTagContents: (htmlString: string, tagName: string) => {
    content?: string;
    innerContent?: string;
};
export declare const getFirstComponent: (htmlString: string, componentList: ComponentList) => Partial<BascikComponent> & {
    index?: number;
};
export declare const getTag: (htmlString: string, tagName: string, componentList?: ComponentList) => {
    content?: string;
    innerContent?: string;
};
export declare const extractScriptTags: (htmlString: string) => string;
export declare const minifyHtml: (htmlString: string) => string;
/**
 * Extract data-bascik-prop-* attributes from a component usage tag string.
 * e.g. '<my-comp data-bascik-prop-title="Hello">' → { title: "Hello" }
 */
export declare const extractProps: (componentContent: string | undefined) => Record<string, string>;
/**
 * For each prop, find elements in the component template that carry a
 * `data-bascik-prop-{name}` attribute, replace their inner content with the
 * prop value, and strip the marker attribute.
 *
 * e.g. template `<p data-bascik-prop-title></p>` + { title: "Hi" }
 *      → `<p>Hi</p>`
 */
export declare const injectProps: (fileContent: string | undefined, props: Record<string, string>) => string;
/**
 * Strip `data-bascik-slot="name"` wrapper elements from inner content,
 * leaving only the content intended for the default slot.
 *
 * e.g. '<p>body</p><div data-bascik-slot="side"><nav>nav</nav></div>'
 *      → '<p>body</p>'
 */
export declare const extractDefaultSlotContent: (innerContent: string | undefined) => string;
/**
 * Extract named slot content from a component usage's inner HTML.
 * Looks for wrapper elements carrying `data-bascik-slot="slotName"`.
 *
 * e.g. '<div data-bascik-slot="header"><h1>H</h1></div>'
 *      → { header: "<h1>H</h1>" }
 */
export declare const extractNamedSlotContent: (innerContent: string | undefined) => Record<string, string>;
/**
 * In a component template, replace `data-bascik-slot="name"` placeholder
 * elements with the corresponding named slot content.  Placeholders with no
 * matching content are removed entirely.
 *
 * e.g. template `<footer><div data-bascik-slot="links"></div></footer>`
 *      slots   `{ links: "<a href='/'>Home</a>" }`
 *      → `<footer><a href='/'>Home</a></footer>`
 */
export declare const replaceNamedSlots: (fileContent: string, slots: Record<string, string>) => string;
/**
 * Extract attributes from a component usage tag that should be inherited by
 * the component's root element.  All data-bascik-* attributes are excluded.
 *
 * e.g. '<my-nav class="sticky" aria-label="nav" data-bascik-prop-x="y">'
 *      → { class: "sticky", "aria-label": "nav" }
 */
export declare const extractInheritableAttributes: (componentContent: string | undefined) => Record<string, string>;
/**
 * Merge inheritable attributes onto the first (root) element of transpiled HTML.
 *  - class: appended to existing classes, or added if absent.
 *  - Other attributes: added only if the root element does not already have them.
 */
export declare const mergeAttributesOntoRoot: (html: string, attrs: Record<string, string>) => string;
