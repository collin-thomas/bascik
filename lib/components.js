import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { BascikConfig } from "./config.js";
import {
  prefixClassesInHtml,
  addElementClassesInHtml,
  getComponentCss,
} from "./styles.js";
import { deepReadDirFlat } from "./file-system.js";

export const scopeTag = ({ component }) => {
  const { fileContent } = component;
  // Just working on id right now, also have to take care of name.

  // We may have to ignore the component.innerContent, but we'll see.
  //console.log(fileContent);
  // For each id you find in the html
  //   Generate a unique hash
  //   Append the hash to the id in the html
  //   Inside the script tag, find every instance of the id being referenced by name
  //   Append the hash to the id in the JavaScript
  let fileContentWithoutScriptTags = fileContent.replace(
    /<script[^>]*>[^>]*<\/script>/gm,
    ""
  );

  if (fileContentWithoutScriptTags === null) {
    return fileContent;
  }

  let fileContentScriptTagsOnly = fileContent.match(
    /<script[^>]*>[^>]*<\/script>/gm
  );

  if (fileContentScriptTagsOnly === null) {
    return fileContent;
  }

  fileContentScriptTagsOnly = fileContentScriptTagsOnly.join("");

  // Get all id attribute values
  const ids = fileContentWithoutScriptTags.match(/(?<=id=").+?(?=")/gm) || [];

  // Get all name attribute values
  const names =
    fileContentWithoutScriptTags.match(/(?<=name=").+?(?=")/gm) || [];

  // Get all class names
  // (class names might already be scoped actually, but idk in conjunction with the javascript)

  // The random string only needs generated per component
  const randomStr = generateRandomString();

  ids.forEach((id) => {
    // Covers when the id is first defined in the html, ie: <a id="myId">
    fileContentWithoutScriptTags = fileContentWithoutScriptTags.replace(
      new RegExp(`(?<=id=")${id}(?=")`, "gm"),
      (id) => `${id}-${randomStr}`
    );

    // Covers getElementById("id") single or double quotes
    fileContentScriptTagsOnly = fileContentScriptTagsOnly.replace(
      new RegExp(`(?<=.getElementById\\(['|"])${id}(?=['|"]\\))`, "gm"),
      (id) => `${id}-${randomStr}`
    );

    // Covers querySelector("[id='myId']") single or double quotes
    fileContentScriptTagsOnly = fileContentScriptTagsOnly.replace(
      new RegExp(
        `(?<=.querySelector\\(['|"]\\[id=['|"])${id}(?=['|"]]['|"]\\))`,
        "gm"
      ),
      (id) => `${id}-${randomStr}`
    );

    // Covers querySelectorAll("[id='myId']") single or double quotes
    fileContentScriptTagsOnly = fileContentScriptTagsOnly.replace(
      new RegExp(
        `(?<=.querySelectorAll\\(['|"]\\[id=['|"])${id}(?=['|"]]['|"]\\))`,
        "gm"
      ),
      (id) => `${id}-${randomStr}`
    );
  });

  // Turns out we don't actually want this code.
  /* names.forEach((name) => {
    // Covers when the name is first defined in the html, ie: <a name="myName">
    fileContentWithoutScriptTags = fileContentWithoutScriptTags.replace(
      new RegExp(`(?<=name=")${name}(?=")`, "gm"),
      (name) => `${name}-${randomStr}`
    );

    // Covers getElementsByName("name") single or double quotes
    fileContentScriptTagsOnly = fileContentScriptTagsOnly.replace(
      new RegExp(`(?<=.getElementsByName\\(['|"])${name}(?=['|"]\\))`, "gm"),
      (name) => `${name}-${randomStr}`
    );

    // Covers querySelector("[name='myName']") single or double quotes
    fileContentScriptTagsOnly = fileContentScriptTagsOnly.replace(
      new RegExp(
        `(?<=.querySelector\\(['|"]\\[name=['|"])${name}(?=['|"]]['|"]\\))`,
        "gm"
      ),
      (name) => `${name}-${randomStr}`
    );

    // Covers querySelectorAll("[name='myName']") single or double quotes
    fileContentScriptTagsOnly = fileContentScriptTagsOnly.replace(
      new RegExp(
        `(?<=.querySelectorAll\\(['|"]\\[name=['|"])${name}(?=['|"]]['|"]\\))`,
        "gm"
      ),
      (name) => `${name}-${randomStr}`
    );
  }); */

  /**
   * .getElementsByClassName
   **/

  // I think we are going to need a more fool-proof way of handling selectors
  // https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/Selectors
  // They come in all shapes and sizes.
  // What I'm thinking is we look for .querySelector()
  // and then anywhere our id shows up inside the query selector replace it.
  // Now here's where things go wrong, what if our id is called id
  // and our query selector is querySelector("[id='id']")
  // It would change both and break it.

  return `${fileContentWithoutScriptTags}\n${fileContentScriptTagsOnly}`;
};

/**
 * There are over 101.5 trillion possible 9-character strings
 * @param {*} length
 * @returns
 */
export const generateRandomString = (length = 9) => {
  return randomBytes(length).toString("hex").slice(0, length);
};

/**
 *
 * @example const componentList = await listComponents();
 * @returns componentList
 */
export const listComponents = async () => {
  const componentFileNames = await deepReadDirFlat(
    "./components",
    /\.(html|css)$/
  );
  const componentHtmlFileNames = componentFileNames.filter((fileName) =>
    fileName.match(/\.(html)$/)
  );
  const componentCssFileNames = BascikConfig?.scopedStylesEnabled
    ? componentFileNames.filter((fileName) => fileName.match(/\.(css)$/))
    : [];
  const components = await Promise.all(
    componentHtmlFileNames.map(async (fileName) => {
      // Name the file name without the extension.
      // Name is used in all the mappings components
      try {
        const componentName = fileName.replace(/^.*[\\/]/, "").split(".")[0];
        // this is where we process the component
        let fileContent = minifyHtml(
          (await readFile(`./${fileName}`)).toString()
        );
        if (BascikConfig.scopedStylesEnabled) {
        }
        const component = {
          name: componentName,
          fileName,
        };
        if (BascikConfig?.scopedStylesEnabled) {
          // Add cssFileContent to component object to get inject to <head> later
          const { css: cssFileContent, elementsConvertedClasses } =
            await getComponentCss(
              componentName,
              fileName,
              componentCssFileNames
            );
          if (cssFileContent) {
            component.cssFileContent = cssFileContent;
          }
          // Prefix classes in the HTML
          fileContent = prefixClassesInHtml(fileContent, componentName);
          // Add classes to elements that are styled
          if (
            Array.isArray(elementsConvertedClasses) &&
            elementsConvertedClasses.length
          ) {
            fileContent = addElementClassesInHtml(
              fileContent,
              componentName,
              elementsConvertedClasses
            );
          }
        }
        component.fileContent = fileContent;
        return component;
      } catch (e) {
        console.warn(`warning: Failed to process ${fileName}`, { cause: e });
        return {};
      }
    })
  );
  return components.reduce((acc, { name, ...rest }) => {
    acc[name] = rest;
    return acc;
  }, {});
};

/**
 *
 * @param {*} htmlString This is the starting string (<div><tag-a></tag-a></div>)
 * @param {*} tagName This is the tag to replace (<tag-a></tag->)
 * @param {*} transpiledTag This is what to replace it with (<p>I'm tag a</p>)
 * @returns
 */
export const replaceTag = (htmlString, tagName, transpiledTag) => {
  const regexp = new RegExp(
    `(?<content><${tagName}[^>]*>(?<innerContent>([\\s\\S]*?))<\/${tagName}>)`,
    "i"
  );
  return htmlString.replace(regexp, transpiledTag);
};

export const getTagContents = (htmlString, tagName) => {
  const regexp = new RegExp(
    `(?<content><${tagName}[^>]*>(?<innerContent>([\\s\\S]*?))<\/${tagName}>)`,
    "i"
  );
  const match = htmlString.match(regexp);
  if (!match) return {};
  // { content, innerContent }
  return { ...match.groups };
};

export const getFirstComponent = (htmlString, componentList) => {
  if (!htmlString) return {};
  const componentNames = Object.keys(componentList);
  const matchComponentName = new RegExp(
    `<\/?\\b(${componentNames.join("|")})\\b`,
    "i"
  );
  const match = htmlString.match(matchComponentName);
  if (!match) return {};
  const firstComponentName = match[1];
  return {
    name: firstComponentName,
    index: match.index,
    ...getTag(htmlString, firstComponentName, componentList),
  };
};

/**
 *
 * @param {*} htmlString
 * @param {*} tagName
 * @param {*} componentList
 * @returns {Object} {
 *   content - This can be the page HTML or a parent component HTML.
 *   innerContent -
 * }
 */
export const getTag = (htmlString, tagName, componentList) => {
  const pattern = new RegExp(
    //`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    `<${tagName}.*?>(.*?)<\/${tagName}>`,
    "i"
  );
  const match = htmlString.match(pattern);
  if (!match) return {};
  const returnObj = {
    content: match[0],
    innerContent: match[1],
  };
  if (!componentList) return returnObj;
  return { ...returnObj, ...componentList[tagName] };
};

export const extractScriptTags = (htmlString) => {
  const html = htmlString.replace(/<!--[\s\S]*?-->/g, "");
  const pattern = new RegExp(`<script[^>]*>([\\s\\S]*?)<\\/script>`, "gi");
  const arr = [...html.matchAll(pattern)];
  if (!arr.length) return "";
  return arr
    .map((script) => script[0])
    .join("\n")
    .trim();
};

export const minifyHtml = (htmlString) => {
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
