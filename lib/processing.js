import { readFile, writeFile, mkdir } from "node:fs/promises";
import { listPages, getDirectoryPath, getDistPagePath } from "./file-system.js";
import {
  listComponents,
  replaceTag,
  getFirstComponent,
  getTag,
  minifyHtml,
  scopeTag,
} from "./components.js";
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
  // Before adding the tag to the html we need to
  // "scope" aka "randomize" the id & name attribute values.
  // I don't think we have to worry about the default slot code
  // because that can only by HTML not JS.
  // And even if the code in the slot is another component
  // we don't care about the recursion there because the component
  // inside of a slot should still be scoped to itself not its parent.
  // So scoping the tag, before or after really doesn't matter.
  // It might make sense to do it before so we aren't confusing ourselves.
  // Here's another reason to do it before, if you have a component on page
  // and you add code in the default slot, and that code uses and id attribute,
  // and there is JavaScript on the page that references that id, you don't want
  // it getting scoped as part of the parent component.
  const componentFileContent = BascikConfig.scopedJavaScript
    ? scopeTag({ component })
    : component.fileContent;
  // For every component, we check if it has a default slot.
  // If it does we replace "<slot-component></slot-component>" with the innerContent,
  // meaning the content that was in between the component,
  // for example <tag-a>this is inner content</tag-a>.
  // We have to manually specify "slot-component"
  // because it's not a developer created component.
  // <slot-component> is built into Bascik.
  const transpiledTag = replaceTag(
    componentFileContent,
    "slot-component",
    component.innerContent
  );
  // Now we replace the tag (<tag-a></tag-a>) with its contents in the HTML.
  transpiledHtmlBody = replaceTag(
    transpiledHtmlBody,
    component.name,
    transpiledTag
  );
  //console.log({ transpiledHtmlBody, component, transpiledTag });
  // Keep track of the used components
  usedComponents.push(component);
  return recursivelyTranspile(
    transpiledHtmlBody,
    componentList,
    usedComponents
  );
};

export const processAllPages = async () => {
  // Parallel processing of pages
  const pages = await listPages();
  return Promise.all(
    pages.map((path) => {
      return pageProcessing(path);
    })
  );
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
    .replace(/<head>([\s\S]*?)<\/head>/i, `<head>${transpiledHead}</head>`)
    // Remove new lines and multiple spaces become single spaces
    .replace(/\n/g, " ")
    .replace(/\s\s+/g, " ");

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
