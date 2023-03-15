import { readdir, readFile } from "node:fs/promises";

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

export const isEmptyObject = (obj) => {
  return Object.keys(obj).length === 0;
};
