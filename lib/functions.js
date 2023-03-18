import { readdir, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const recursivelyTranspile = (transpiledHtml, componentList) => {
  const { name, fileContent, innerContent } = getFirstComponent(
    transpiledHtml,
    componentList
  );
  if (!name) {
    return transpiledHtml;
  }
  const transpiledTag = replaceTag(fileContent, "slot-component", innerContent);
  transpiledHtml = replaceTag(transpiledHtml, name, transpiledTag);
  return recursivelyTranspile(transpiledHtml, componentList);
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

/**
 *
 * @example const { components } = await createListofComponents();
 */
export const listComponents = async () => {
  const componentFileNames = await readdir("./components");
  const components = await Promise.all(
    componentFileNames.map(async (fileName) => {
      const name = fileName.substring(0, fileName.indexOf("."));
      const fileContent = minifyHtml(
        (await readFile(`./components/${fileName}`)).toString()
      );
      return {
        name,
        fileName,
        fileContent,
      };
    })
  );
  return components.reduce((acc, { name, ...rest }) => {
    acc[name] = rest;
    return acc;
  }, {});
};

export const listPages = async () => {
  return deepReadDirFlat("./pages");
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

export const deepReadDir = async (dirPath) => {
  return Promise.all(
    (await readdir(dirPath, { withFileTypes: true })).map(async (dirent) => {
      const path = join(dirPath, dirent.name);
      return dirent.isDirectory() ? await deepReadDir(path) : path;
    })
  );
};

export const deepReadDirFlat = async (dirPath) => {
  return (await deepReadDir(dirPath)).flat(Number.POSITIVE_INFINITY);
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

  let transpiledHtml = recursivelyTranspile(body, componentList);

  // Puts our processed markup back between the <body></body> tags
  const distHtml = html.replace(
    /<body>([\s\S]*?)<\/body>/i,
    `<body>${transpiledHtml}</body>`
  );

  // Create directory
  const directoryPath = getDirectoryPath(pagePath);
  if (directoryPath) await mkdir(`dist/${directoryPath}`, { recursive: true });

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
