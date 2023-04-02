import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { BascikConfig } from "./config.js";

export const getClassNameHash = (className) => {
  return `b${createHash("shake256", { outputLength: 4 })
    .update(className)
    .digest("hex")}`;
};

export const obfuscateClassName = (className) => {
  return BascikConfig.obfuscateClassNames
    ? getClassNameHash(className)
    : className;
};

/**
 *
 * @param {String} css Custom componetns CSS
 * @param {String} componentName Name of custom HTML component
 * @returns {String} CSS string with prefeixed class names
 */
export const prefixClassesInCss = (css, componentName) => {
  return css.replace(/(?<=\.)[a-z0-9-_]+/gim, (className) =>
    obfuscateClassName(`bascik__${componentName}__${className}`)
  );
};

export const prefixClassesInHtml = (html, componentName) => {
  return html.replace(/(?<=class=").+?(?=")/gm, (match) => {
    return match
      .replace(/  +/g, " ")
      .split(" ")
      .map((className) =>
        obfuscateClassName(`bascik__${componentName}__${className}`)
      )
      .join(" ");
  });
};

export const convertCssElementSelectorsToClasses = (css, componentName) => {
  // Example of a p tag for componentName custom-comp
  // bascik__custom-comp__el__p
  // Match elements but not elements targeted from classes such as `.my-class ul`
  const elementsConvertedClasses = [];
  const cssStr = css.replace(/^[a-z1-6]+(?=[\s{])/gim, (elementName) => {
    elementsConvertedClasses.push(elementName);
    const bascikClassName = obfuscateClassName(
      `bascik__${componentName}__el__${elementName}`
    );
    return `.${bascikClassName}`;
  });
  return { css: cssStr, elementsConvertedClasses };
};

/**
 * If a component's css styles any element, add bascik classes to those elements
 * @param {String} componentHtml
 * @param {String} componentName
 * @param {Array} elementsConvertedClasses
 * @returns
 */
export const addElementClassesInHtml = (
  componentHtml,
  componentName,
  elementsConvertedClasses = []
) => {
  // Loop through each element that has styling
  elementsConvertedClasses.forEach((element) => {
    // Find all the instances of that element in the component
    componentHtml = componentHtml.replace(
      new RegExp(`<${element}.*?>(.*?)<\/${element}>`, "gi"),
      (elementHtml) => {
        // If the instance of the element already has classes add to it
        if (elementHtml.match('class="')) {
          elementHtml = elementHtml.replace(/class=".*?(?=")/i, (classStr) => {
            const bascikClassName = obfuscateClassName(
              `bascik__${componentName}__el__${element}`
            );
            return `${classStr} ${bascikClassName}`;
          });
        } else {
          // Otherwise set the element class as the only class
          const bascikClassName = obfuscateClassName(
            `bascik__${componentName}__el__${element}`
          );
          elementHtml = elementHtml.replace(
            new RegExp(`<${element}`, "i"),
            `<${element} class="${bascikClassName}"`
          );
        }
        return elementHtml;
      }
    );
  });
  return componentHtml;
};

/**
 * Gets all the .class definitions
 * Ignores element and id selectors
 * @param {String} css
 * @returns {Array}
 */
export const getCssClasses = (css) => {
  const classes = css.match(/\.[\.\w\s\(\)]+{[\w\s\:;#-_]+}/g);
  if (Array.isArray(classes)) return classes;
  return [];
};

export const getKeyframeNames = (css) => {
  return css.match(/(?<=@keyframes.*?)([a-z]+)(?=[\s]*{)/gim);
};

export const prefixKeyframes = (css, componentName) => {
  const keyframeNames = getKeyframeNames(css);
  if (!Array.isArray(keyframeNames)) return css;
  return css.replace(
    new RegExp(`${keyframeNames.join("|")}`, "gmi"),
    (keyframeName) => {
      return obfuscateClassName(
        `bascik__${componentName}__keyframe__${keyframeName}`
      );
    }
  );
};

export const removeIdSelectors = (css) => {
  // Match any selector inbetween square brackets,
  // and all the code that comes after it between the curly brackets
  return css.replace(/\[.*?\].*?{[\s\S]*?}/gim, "");
};

export const removeCommentsFromCss = (css) => {
  return css.replace(/\/\*[\s\S]*?\*\//gim, "");
};

/**
 *
 * @param {String} htmlFileName
 * @param {Array} cssFileNames
 * @returns {String | undefined}
 */
export const getComponentCss = async (
  componentName,
  htmlFileName,
  cssFileNames
) => {
  if (!htmlFileName || !Array.isArray(cssFileNames)) return {};
  const cssFileName = cssFileNames.find(
    (cssFileName) => cssFileName.replace(/\.css$/, ".html") === htmlFileName
  );
  if (!cssFileName) return {};
  try {
    let css = (await readFile(`./${cssFileName}`)).toString();
    // Namespace CSS Classes
    css = prefixClassesInCss(css, componentName);
    // Convert CSS elements selectors into CSS classes
    const { css: cssStr, elementsConvertedClasses } =
      convertCssElementSelectorsToClasses(css, componentName);
    css = cssStr;
    // Namespace keyframes
    css = prefixKeyframes(css, componentName);
    // Remove any id selector
    css = removeIdSelectors(css);
    // Remove comments
    css = removeCommentsFromCss(css);
    return { css, elementsConvertedClasses };
  } catch (error) {
    console.warn(`warning: Failed to read css for ${htmlFileName}`, error);
    return {};
  }
};
