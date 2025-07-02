import { readFile } from "node:fs/promises";
import { BascikConfig } from "./config.js";
import {
  prefixClassesInHtml,
  addElementClassesInHtml,
  getComponentCss,
} from "./styles.js";
import { deepReadDirFlat } from "./file-system.js";

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
  // Super important here, reverse, makes it so we're matching on the most specific tag first
  // Meaning, it will find test-comp-clone before test-comp, 
  // because reverse, the longer tag will be first in the regexp, and therefore match first.
  // It's like how an ingress controller works.
  const componentNames = Object.keys(componentList).reverse();
  const matchComponentName = new RegExp(
    `<\/?\\b(${componentNames.join("|")})\\b.*?>`,
    "i"
  );
  const match = htmlString.match(matchComponentName);
  if (!match) {
    return {};
  }
  const firstComponentName = match[1];
  return {
    name: firstComponentName,
    index: match.index,
    ...getTag(htmlString, firstComponentName, componentList),
  };
};

export const getTag = (htmlString, tagName, componentList) => {
  const pattern = new RegExp(
    //`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    `<${tagName}.*?>(.*?)<\/${tagName}>`,
    "i"
  );
  const match = htmlString.match(pattern);
  if (!match) {
    return {};
  }
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
