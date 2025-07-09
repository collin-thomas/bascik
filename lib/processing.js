import { readFile, writeFile, mkdir } from "node:fs/promises";
import { listPages, getDirectoryPath, getDistPagePath, deleteDistFile } from "./file-system.js";
import {
  listComponents,
  replaceTag,
  getFirstComponent,
  getTag,
  minifyHtml,
} from "./components.js";
import { namespaceScriptTags, prefixElementAttribute } from './javascript.js'
import { BascikConfig } from "./config.js";
import { mem } from "./mem.js";

export const recursivelyTranspile = (
  transpiledHtmlBody,
  componentList,
  usedComponents = []
) => {
  let component = getFirstComponent(transpiledHtmlBody, componentList);
  if (!component.name) {
    return { transpiledHtmlBody, usedComponents };
  }
  try {
    component = prefixElementAttribute(component, 'id')
    component = prefixElementAttribute(component, 'name')
    component = prefixElementAttribute(component, 'class')
    component = namespaceScriptTags(component)
  } catch (error) {
    console.error('Component Not Defined', { component })
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

export const processAllPages = async () => {
  // Parallel processing of pages
  const [pages, componentList] = await Promise.all([listPages(), listComponents()])
  return Promise.all(
    pages.map((path) => {
      return pageProcessing(path, componentList);
    })
  );
};

export const pageProcessing = async (pagePath, componentList) => {
  const dir = pagePath.split("/")[0];
  if (dir !== "pages") return;

  // Get updated custom component list
  // We could be smarter about this by updating the list
  // only when it changes listening to chokidar events
  if (!componentList) {
    componentList = await listComponents();
  }
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

  const { transpiledHtmlBody, usedComponents } = recursivelyTranspile(
    body,
    componentList
  );

  const { innerContent: head } = getTag(html, "head");

  let transpiledHead = `${head}
    <style>
    ${usedComponents.map((component) => component.cssFileContent).join(" ")}
    </style>`
  // Compress styles
  // Remove new lines and multiple spaces become single spaces

  if (BascikConfig.minifyStyles) {
    transpiledHead = transpiledHead.replace(/\n/g, " ").replace(/\s\s+/g, " ");
  }

  // Puts our processed markup back between the <body></body> tags
  const distHtml = html
    .replace(/<body>([\s\S]*?)<\/body>/i, `<body>${transpiledHtmlBody}</body>`)
    .replace(/<head>([\s\S]*?)<\/head>/i, `<head>${transpiledHead}</head>`)


  // Memory
  mem.addPage(pagePath, distHtml);

  // File system is done async. 
  // Wrapped in try catch in IIFE so we know where the exception came from.
  (async () => {
    // Create directory
    // Doesn't hurt to run it if it exists, and it creates dist if it doesn't exist
    const directoryPath = getDirectoryPath(pagePath);
    try {
      await mkdir(`dist/${directoryPath}`, { recursive: true });
    } catch (error) {
      console.error('Make directory error', error)
    }


    // Write the transpiled html
    const distPagePath = getDistPagePath(pagePath);
    try {
      await writeFile(distPagePath, distHtml);
    } catch (error) {
      // Ignore file doesn't exist, race condition
      if (error.code !== 'ENOENT') {
        console.error('Write file error', error)
      }
    }
  })();

  console.log(`transpiled: ${pagePath}`);

  // The return is only for debugging
  return pagePath;
};

export const removePage = (pagePath) => {
  // Memory
  mem.removePage(pagePath)
  // File system is async, do not await
  deleteDistFile(pagePath)
}