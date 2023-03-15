import chokidar from "chokidar";
import { readFile, writeFile } from "node:fs/promises";
import {
  listComponents,
  minifyHtml,
  getTag,
  recursivelyTranspile,
  isEmptyObject,
} from "./lib/functions.js";

const pageProcessing = async (pagePath) => {
  const dir = pagePath.split("/")[0];
  if (dir !== "pages") return;

  // Get updated custom component list
  // We could be smarter about this by updating the list only when it changes listening to chokidar events
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

  // Set dist page path
  const pathParts = pagePath.split("/");
  pathParts[0] = "dist";
  const distPagePath = pathParts.join("/");

  // Write the transpiled html
  writeFile(distPagePath, distHtml);

  console.log(`transpiled: ${pagePath}`);
};

// TODO
// Instead of using node's --watch functionality we can use fs.watch and fs.watchAll
// This way we can have a single process and have more control
// https://www.geeksforgeeks.org/how-to-monitor-a-file-for-modifications-in-node-js/

// B. File Watching

// "all" is add, addDir, change, unlink, unlinkDir. (unlink means delete)

chokidar
  .watch(["./components/**/*.html", "./pages/**/*.html"])
  .on("all", async (event, path) => {
    console.log(event === "add" ? "watching:" : `${event}:`, path);
    pageProcessing(path);
  });
