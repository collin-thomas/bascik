import { readdir, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { BascikConfig } from "./config.js";

export const recursivelyTranspile = (
  transpiledHtmlBody,
  componentList,
  usedComponents = []
) => {
  const component = getFirstComponent(transpiledHtmlBody, componentList);
  if (!component.name) {
    return { transpiledHtmlBody, usedComponents };
  }
  const transpiledTag = replaceTag(
    component.fileContent,
    "slot-component",
    component.innerContent
  );
  transpiledHtmlBody = replaceTag(
    transpiledHtmlBody,
    component.name,
    transpiledTag
  );
  usedComponents.push(component);
  return recursivelyTranspile(
    transpiledHtmlBody,
    componentList,
    usedComponents
  );
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
  // { content, innerContent }
  return { ...match.groups };
};

export const getFirstComponent = (htmlString, componentList) => {
  if (!htmlString) return {};
  const match = htmlString.match(
    new RegExp(`<\/?(${Object.keys(componentList).join("|")})`)
  );
  if (!match) return {};
  const firstComponentName = match[1];
  return {
    name: firstComponentName,
    index: match.index,
    ...getTag(htmlString, firstComponentName, componentList),
  };
};

export const getTag = (htmlString, tagName, componentList) => {
  const pattern = new RegExp(
    `<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
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

const extractScriptTags = (htmlString) => {
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
  html = html.replace(/\n/g, "").replace(/>\s+</g, "><");
  if (scriptTags) {
    html += `\n${scriptTags}`;
  }
  return html;
};

// The unminifyHtml in imperfect and I'm only using it to debug.
export const unminifyHtml = (minifiedHtml) => {
  // Insert line breaks after opening tags and before closing tags
  const htmlWithLineBreaks = minifiedHtml
    .replace(/<([^\/][^>]*?)>/g, "\n$&")
    .replace(/(<\/[^>]+?>)/g, "$1\n");

  // Add indentation for nested tags
  const lines = htmlWithLineBreaks.split("\n");
  let indentationLevel = 0;
  let indentedHtml = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isOpeningTag = line.match(/^<[^/]/);
    const isClosingTag = line.match(/^<\/[^>]+>/);

    if (isClosingTag) indentationLevel--;

    for (let j = 0; j < indentationLevel; j++) {
      indentedHtml += "  ";
    }

    indentedHtml += line + "\n";

    if (isOpeningTag && !line.match(/\/>$/)) indentationLevel++;
  }

  return indentedHtml;
};

const prefixClassesInCss = (css, componentName) => {
  return css.replace(/\.([\w-]+)/g, (_, className) => {
    return `.bascik__${componentName}__${className}`;
  });
};

const prefixClassesInHtml = (html, componentName) => {
  return html.replace(/(?<=class=").+?(?=")/gm, (match) => {
    return match
      .replace(/  +/g, " ")
      .split(" ")
      .map((className) => `bascik__${componentName}__${className}`)
      .join(" ");
  });
};

/**
 *
 * @param {String} htmlFileName
 * @param {Array} cssFileNames
 * @returns {String | undefined}
 */
const getComponentCss = async (componentName, htmlFileName, cssFileNames) => {
  if (!htmlFileName || !Array.isArray(cssFileNames)) return;
  const cssFileName = cssFileNames.find(
    (cssFileName) => cssFileName.replace(/\.css$/, ".html") === htmlFileName
  );
  if (!cssFileName) return;
  // TODO minify the css
  try {
    const css = (await readFile(`./${cssFileName}`))
      .toString()
      .replace("\n", "");
    // TODO remove unused CSS, harder than first glance.
    //Lots of patterns to match, such as ".class-a .class-b"
    // Namespace
    return prefixClassesInCss(css, componentName);
  } catch (error) {
    console.warn(`warning: Failed to read css for ${htmlFileName}`, error);
    return;
  }
};

/**
 *
 * @example const { components } = await createListofComponents();
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
        const name = fileName.replace(/^.*[\\/]/, "").split(".")[0];
        // this is where we process the component
        let fileContent = minifyHtml(
          (await readFile(`./${fileName}`)).toString()
        );
        if (BascikConfig.scopedStylesEnabled) {
          fileContent = prefixClassesInHtml(fileContent, name);
        }
        const component = {
          name,
          fileName,
          fileContent,
        };
        if (BascikConfig?.scopedStylesEnabled) {
          const cssFileContent = await getComponentCss(
            name,
            fileName,
            componentCssFileNames
          );
          if (cssFileContent) {
            component.cssFileContent = cssFileContent;
          }
        }
        return component;
      } catch {
        console.warn(`warning: Failed to process ${fileName}`);
        return {};
      }
    })
  );
  return components.reduce((acc, { name, ...rest }) => {
    acc[name] = rest;
    return acc;
  }, {});
};

export const listPages = async () => {
  return deepReadDirFlat("./pages", /\.html$/);
};

export const processAllPages = async () => {
  // Parellel processing of pages
  const pages = await listPages();
  return Promise.all(
    pages.map((path) => {
      return pageProcessing(path);
    })
  );
};

// Taken from https://stackoverflow.com/a/71166133/1469690
export const deepReadDir = async (dirPath) => {
  try {
    // withFileTypes is what makes it return dirent
    const dir = await readdir(dirPath, { withFileTypes: true });
    return Promise.all(
      dir.map(async (dirent) => {
        const path = join(dirPath, dirent.name);
        return dirent.isDirectory() ? await deepReadDir(path) : path;
      })
    );
  } catch (error) {
    //console.error(error);
    return [];
  }
};

/**
 *
 * @param {String} dirPath
 * @param {RegExp} filter
 * @returns
 */
export const deepReadDirFlat = async (dirPath, filter) => {
  const files = (await deepReadDir(dirPath)).flat(Number.POSITIVE_INFINITY);
  if (!filter) return files;
  return files.filter((filePath) => `${filePath}`.match(filter));
};

export const isEmptyObject = (obj) => {
  return Object.keys(obj).length === 0;
};

export const pageProcessing = async (pagePath) => {
  const dir = pagePath.split("/")[0];
  if (dir !== "pages") return;

  // Get updated custom component list
  // We could be smarter about this by updating the list
  // only when it changes listening to chokidar events
  const componentList = await listComponents();

  // Read the file as a string
  // Remove comments and new lines
  const html = minifyHtml((await readFile(pagePath)).toString());

  if (!html) return;

  // Gets all the text between the <body></body> tags
  const { innerContent: body } = getTag(html, "body");

  if (!body) {
    return console.warn(
      `warning: ${pagePath} does not contain <body></body> or body does not have content`
    );
  }

  let { transpiledHtmlBody, usedComponents } = recursivelyTranspile(
    body,
    componentList
  );

  const { innerContent: head } = getTag(html, "head");

  const transpiledHead = `${head}
    <style>
    ${usedComponents.map((component) => component.cssFileContent).join(" ")}
    </style>`;

  // Puts our processed markup back between the <body></body> tags
  const distHtml = html
    .replace(/<body>([\s\S]*?)<\/body>/i, `<body>${transpiledHtmlBody}</body>`)
    .replace(/<head>([\s\S]*?)<\/head>/i, `<head>${transpiledHead}</head>`);

  // Create directory
  // Doesn't hurt to run it if it exists, and it creates dist if it doesn't exist
  const directoryPath = getDirectoryPath(pagePath);
  await mkdir(`dist/${directoryPath}`, { recursive: true });

  // Write the transpiled html
  const distPagePath = getDistPagePath(pagePath);
  await writeFile(distPagePath, distHtml);

  console.log(`transpiled: ${pagePath}`);

  // The return is only for debugging
  return pagePath;
};

const getDirectoryPath = (pagePath) => {
  return pagePath.split("/").slice(1, -1).join("/");
};

const getDistPagePath = (pagePath) => {
  const pathParts = pagePath.split("/");
  pathParts[0] = "dist";
  return pathParts.join("/");
};

export const deleteDistFile = async (pagePath) => {
  try {
    const distPagePath = getDistPagePath(pagePath);
    await rm(distPagePath);
    console.log(`deleted: ${pagePath}`);
  } catch (error) {
    console.warn(error);
  }
};

export const deleteDistDir = async (dirPath) => {
  try {
    const distDirPath = dirPath.replace("pages", "dist");
    // recursive means delete directory
    // force means delete the file inside
    await rm(distDirPath, { recursive: true, force: true });
    console.log(`deleted: ${dirPath}`);
  } catch (error) {
    console.warn(error);
  }
};

export const createDir = async (path) => {
  try {
    await mkdir(path, { recursive: true });
  } catch (error) {
    console.warn(error);
  }
};
