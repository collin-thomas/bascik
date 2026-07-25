import { readFile } from "node:fs/promises";
import { getComponentCss } from "./styles.js";
import { deepReadDirFlat } from "./file-system.js";
import { BascikConfig } from "./config.js";
import type { BascikComponent, ComponentList } from "./types.js";

// Warn if a component name shadows a native HTML element
const NATIVE_HTML_ELEMENTS = new Set([
  "a",
  "abbr",
  "address",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "base",
  "bdi",
  "bdo",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "data",
  "datalist",
  "dd",
  "del",
  "details",
  "dfn",
  "dialog",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "legend",
  "li",
  "link",
  "main",
  "map",
  "mark",
  "menu",
  "meta",
  "meter",
  "nav",
  "noscript",
  "object",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "picture",
  "pre",
  "progress",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "script",
  "search",
  "section",
  "select",
  "small",
  "source",
  "span",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "title",
  "tr",
  "track",
  "u",
  "ul",
  "var",
  "video",
  "wbr",
]);

/** Load all component HTML and CSS files from the configured components directory. */
export const listComponents = async (): Promise<ComponentList> => {
  const componentFileNames =
    (await deepReadDirFlat(
      BascikConfig.directory.components,
      /\.(html|css)$/,
    )) ?? [];
  const componentHtmlFileNames = (componentFileNames as string[]).filter(
    (fileName) => fileName.match(/\.(html)$/),
  );
  const componentCssFileNames = (componentFileNames as string[]).filter(
    (fileName) => fileName.match(/\.(css)$/),
  );
  const components = await Promise.all(
    componentHtmlFileNames.map(async (fileName) => {
      // Name the file name without the extension.
      // Name is used in all the mappings components
      try {
        const componentName = fileName.replace(/^.*[\\/]/, "").split(".")[0];
        if (NATIVE_HTML_ELEMENTS.has(componentName)) {
          console.warn(
            `warning: Component "${componentName}" has the same name as a native HTML element. ` +
            `This may cause unexpected behaviour — consider a hyphenated name like "my-${componentName}".`,
          );
        }
        const [fileContent, cssFileContent] = await Promise.all([
          readFile(fileName),
          getComponentCss(fileName, componentCssFileNames),
        ]);
        const component: BascikComponent = {
          name: componentName,
          fileName,
          fileContent: minifyHtml(fileContent.toString()),
        };
        if (cssFileContent) {
          component.cssFileContent = cssFileContent;
        }
        return component;
      } catch (e) {
        console.warn(
          `warning: Failed to process ${fileName}`,
          ...(BascikConfig.verboseLogging ? [{ cause: e }] : []),
        );
        return {};
      }
    }),
  );
  return (components as BascikComponent[]).reduce(
    (acc: ComponentList, { name, ...rest }) => {
      if (!name) return acc;
      acc[name] = rest as Omit<BascikComponent, "name">;
      return acc;
    },
    {} as ComponentList,
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HTML tag manipulation
// ─────────────────────────────────────────────────────────────────────────────

export const replaceTag = (
  htmlString: string,
  tagName: string,
  transpiledTag: string,
): string => {
  // Try paired tags first: <tagName ...>...</tagName>
  const pairedRegexp = new RegExp(
    `(?<content><${tagName}[^>]*>(?<innerContent>([\\s\\S]*?))<\/${tagName}>)`,
    "i",
  );
  if (pairedRegexp.test(htmlString)) {
    return htmlString.replace(pairedRegexp, transpiledTag);
  }
  // Fall back to self-closing: <tagName ... /> or <tagName/>
  const selfClosingRegexp = new RegExp(`<${tagName}(\\s[^>]*)?\\/?>`, "i");
  return htmlString.replace(selfClosingRegexp, transpiledTag);
};

export const getTagContents = (
  htmlString: string,
  tagName: string,
): { content?: string; innerContent?: string } => {
  const regexp = new RegExp(
    `(?<content><${tagName}[^>]*>(?<innerContent>([\\s\\S]*?))<\/${tagName}>)`,
    "i",
  );
  const match = htmlString.match(regexp);
  if (!match) return {};
  // { content, innerContent }
  return { ...match.groups };
};

export const getFirstComponent = (
  htmlString: string,
  componentList: ComponentList,
): Partial<BascikComponent> & { index?: number } => {
  if (!htmlString) return {};
  // Super important here, reverse, makes it so we're matching on the most specific tag first
  // Meaning, it will find test-comp-clone before test-comp,
  // because reverse, the longer tag will be first in the regexp, and therefore match first.
  // It's like how an ingress controller works.
  const componentNames = Object.keys(componentList).sort(
    (a, b) => b.length - a.length,
  );
  const matchComponentName = new RegExp(
    `<\\b(${componentNames.join("|")})\\b[\\s\\S]*?>`,
    "i",
  );
  const match = htmlString.match(matchComponentName);
  if (!match) {
    return {};
  }
  const firstComponentName = match[1].toLowerCase();
  return {
    name: firstComponentName,
    index: match.index,
    ...getTag(htmlString, firstComponentName, componentList),
  };
};

export const getTag = (
  htmlString: string,
  tagName: string,
  componentList?: ComponentList,
): { content?: string; innerContent?: string } => {
  // Try paired tags: <tagName ...>content</tagName>
  // Using [\s\S] instead of . to match newlines
  const pairedPattern = new RegExp(
    `<${tagName}[\\s\\S]*?>([\\s\\S]*?)<\\/${tagName}>`,
    "i",
  );
  const pairedMatch = htmlString.match(pairedPattern);
  if (pairedMatch) {
    const returnObj = {
      content: pairedMatch[0],
      innerContent: pairedMatch[1],
    };
    if (!componentList) return returnObj;
    return { ...returnObj, ...componentList[tagName.toLowerCase()] };
  }

  // Try self-closing: <tagName ... /> or <tagName/>
  const selfClosingPattern = new RegExp(
    `<${tagName}([\\s\\S]*?)\\/?>`,
    "i",
  );
  const selfClosingMatch = htmlString.match(selfClosingPattern);
  if (selfClosingMatch) {
    const returnObj = {
      content: selfClosingMatch[0],
      innerContent: "",
    };
    if (!componentList) return returnObj;
    return { ...returnObj, ...componentList[tagName.toLowerCase()] };
  }

  return {};
};

// ─────────────────────────────────────────────────────────────────────────────
// HTML minification
// ─────────────────────────────────────────────────────────────────────────────

export const extractScriptTags = (htmlString: string): string => {
  const html = htmlString.replace(/<!--[\s\S]*?-->/g, "");
  const pattern = new RegExp(`<script[^>]*>([\\s\\S]*?)<\\/script>`, "gi");
  const arr = [...html.matchAll(pattern)];
  if (!arr.length) return "";
  return arr
    .map((script) => script[0])
    .join("\n")
    .trim();
};

export const minifyHtml = (htmlString: string): string => {
  let html = htmlString.replace(/<!--[\s\S]*?-->/g, "");
  const scriptTags = extractScriptTags(html);
  if (scriptTags) {
    const pattern = new RegExp(`<script[^>]*>([\\s\\S]*?)<\\/script>`, "gi");
    html = html.replace(pattern, "").trim();
  }
  html = html.replace(/\n/g, "").replace(/>\s+</g, "><").replace(/\s\s+/g, " ");
  if (scriptTags) {
    html += `\n${scriptTags}`;
  }
  return html;
};

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Extract data-bascik-prop-* attributes from a component usage tag string.
 * e.g. '<my-comp data-bascik-prop-title="Hello">' → { title: "Hello" }
 */
export const extractProps = (
  componentContent: string | undefined,
): Record<string, string> => {
  const props: Record<string, string> = {};
  if (!componentContent) return props;
  const regexp = /data-bascik-prop-([\w-]+)="([^"]*)"/gi;
  let match;
  while ((match = regexp.exec(componentContent)) !== null) {
    props[match[1]] = match[2];
  }
  return props;
};

// ─────────────────────────────────────────────────────────────────────────────
// Prop injection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * For each prop, find elements in the component template that carry a
 * `data-bascik-prop-{name}` attribute, replace their inner content with the
 * prop value, and strip the marker attribute.
 *
 * e.g. template `<p data-bascik-prop-title></p>` + { title: "Hi" }
 *      → `<p>Hi</p>`
 */
export const injectProps = (
  fileContent: string | undefined,
  props: Record<string, string>,
): string => {
  if (!fileContent) return "";
  let result = fileContent;
  Object.entries(props).forEach(([propName, propValue]) => {
    const attrName = `data-bascik-prop-${propName}`;
    // Match: <tagName [attrsBefore] data-bascik-prop-name [attrsAfter]>...</tagName>
    result = result.replace(
      new RegExp(
        `<(\\w+(?:-\\w+)*)([^>]*?)\\s+${attrName}([^>]*)>(.*?)<\\/\\1>`,
        "gi",
      ),
      (
        _match: string,
        tagName: string,
        attrsBefore: string,
        attrsAfter: string,
        _oldContent: string,
      ) => `<${tagName}${attrsBefore}${attrsAfter}>${propValue}</${tagName}>`,
    );
  });
  // Strip any remaining data-bascik-prop-* markers whose prop was not provided
  return result.replace(/\s+data-bascik-prop-[\w-]+/gi, "");
};

// ─── Named Slots ──────────────────────────────────────────────────────────────

/**
 * Strip `data-bascik-slot="name"` wrapper elements from inner content,
 * leaving only the content intended for the default slot.
 *
 * e.g. '<p>body</p><div data-bascik-slot="side"><nav>nav</nav></div>'
 *      → '<p>body</p>'
 */
export const extractDefaultSlotContent = (
  innerContent: string | undefined,
): string => {
  if (!innerContent) return "";
  return innerContent.replace(
    /<(\w+(?:-\w+)*)\s+data-bascik-slot="[^"]*"[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );
};

/**
 * Extract named slot content from a component usage's inner HTML.
 * Looks for wrapper elements carrying `data-bascik-slot="slotName"`.
 *
 * e.g. '<div data-bascik-slot="header"><h1>H</h1></div>'
 *      → { header: "<h1>H</h1>" }
 */
export const extractNamedSlotContent = (
  innerContent: string | undefined,
): Record<string, string> => {
  const slots: Record<string, string> = {};
  if (!innerContent) return slots;
  const regexp = new RegExp(
    `<(\\w+(?:-\\w+)*)\\s+data-bascik-slot="([^"]+)"[^>]*>([\\s\\S]*?)<\\/\\1>`,
    "gi",
  );
  let match;
  while ((match = regexp.exec(innerContent)) !== null) {
    slots[match[2]] = match[3];
  }
  return slots;
};

/**
 * In a component template, replace `data-bascik-slot="name"` placeholder
 * elements with the corresponding named slot content.  Placeholders with no
 * matching content are removed entirely.
 *
 * e.g. template `<footer><div data-bascik-slot="links"></div></footer>`
 *      slots   `{ links: "<a href='/'>Home</a>" }`
 *      → `<footer><a href='/'>Home</a></footer>`
 */
export const replaceNamedSlots = (
  fileContent: string,
  slots: Record<string, string>,
): string => {
  return fileContent.replace(
    new RegExp(
      `<(\\w+(?:-\\w+)*)\\s+data-bascik-slot="([^"]+)"[^>]*>([\\s\\S]*?)<\\/\\1>`,
      "gi",
    ),
    // Use the element's own inner content as fallback when the slot is not provided
    (_match: string, _tag: string, slotName: string, innerFallback: string) =>
      slotName in slots ? slots[slotName] : innerFallback,
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Attribute inheritance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract attributes from a component usage tag that should be inherited by
 * the component's root element.  All data-bascik-* attributes are excluded.
 *
 * e.g. '<my-nav class="sticky" aria-label="nav" data-bascik-prop-x="y">'
 *      → { class: "sticky", "aria-label": "nav" }
 */
export const extractInheritableAttributes = (
  componentContent: string | undefined,
): Record<string, string> => {
  if (!componentContent) return {};
  const attrs: Record<string, string> = {};
  // Grab just the opening tag text (up to the first > or />)
  const openTagMatch = componentContent.match(/^<[\w-]+([\s\S]*?)(?:\s*\/?>)/);
  if (!openTagMatch || !openTagMatch[1]) return attrs;
  const attrStr = openTagMatch[1];
  const attrRegex = /\s+([\w:-]+)(?:="([^"]*)")?/g;
  let match;
  while ((match = attrRegex.exec(attrStr)) !== null) {
    const [, name, value = ""] = match;
    if (!name.startsWith("data-bascik-")) {
      attrs[name] = value;
    }
  }
  return attrs;
};

/**
 * Merge inheritable attributes onto the first (root) element of transpiled HTML.
 *  - class: appended to existing classes, or added if absent.
 *  - Other attributes: added only if the root element does not already have them.
 */
export const mergeAttributesOntoRoot = (
  html: string,
  attrs: Record<string, string>,
): string => {
  if (!Object.keys(attrs).length) return html;
  return html.replace(
    /^(<[\w-]+)((?:\s[^>]*?)?)(\s*\/?>)/,
    (_match: string, tagName: string, existing: string, close: string) => {
      let attrStr = existing || "";
      for (const [name, value] of Object.entries(attrs)) {
        if (name === "class" && value) {
          if (attrStr.includes('class="')) {
            attrStr = attrStr.replace(
              /class="([^"]*)"/,
              (_, cls) => `class="${cls} ${value}"`,
            );
          } else {
            attrStr += ` class="${value}"`;
          }
        } else if (value !== undefined && !attrStr.includes(` ${name}`)) {
          attrStr += ` ${name}="${value}"`;
        }
      }
      return `${tagName}${attrStr}${close}`;
    },
  );
};
