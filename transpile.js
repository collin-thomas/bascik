import { readFile, writeFile } from "node:fs/promises";
import {
  listComponents,
  minifyHtml,
  getTag,
  recursivelyTranspile,
} from "./lib/functions.js";

// Get custom component list
const componentList = await listComponents();

// TODO
// Instead of using node's --watch functionality we can use fs.watch and fs.watchAll
// This way we can have a single process and have more control
// https://www.geeksforgeeks.org/how-to-monitor-a-file-for-modifications-in-node-js/

// Read the file as a string
// Remove comments and new lines
const html = minifyHtml((await readFile("./pages/index.html")).toString());

// Gets all the text between the <body></body> tags
const { innerContent: body } = getTag(html, "body");

let transpiledHtml = recursivelyTranspile(body, componentList);

// Puts our processed markup back between the <body></body> tags
const distHtml = html.replace(
  /<body>([\s\S]*?)<\/body>/i,
  `<body>${transpiledHtml}</body>`
);

// Write the transpiled html
await writeFile("./dist/index.html", distHtml);
