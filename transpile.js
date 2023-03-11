import { readFile, writeFile } from "node:fs/promises";
import { unminifyHtml, getTag } from "./lib/functions.js";
// Starting over
// Starting with the example of 3 tags, each a child of each other. Parent, child, grandchild.
// We will want to start reading each line after the <body> tag
// We cannot go line by line, because what if it is not formatted.
// I suppose we should format first. But that's slow.
// Regardless, starting after <body> we should look for the first custom tag.
// Remove comments and unnecessary whitespace characters

// Read the file as a string
const html = (await readFile("./pages/index.html")).toString();

// Remove comments and new lines
const minified = html
  .replace(/\n/g, "")
  .replace(/>\s+</g, "><")
  .replace(/<!--[\s\S]*?-->/g, "");

// Gets all the text between the <body></body> tags
//const body = minified.match(/<body>([\s\S]*?)<\/body>/i)[1];
const { content: body } = getTag(minified, "body");

// START - Process markup

console.log(getTag(minified, "tag-a"));

// END - Process markup

// Puts our processed markup back between the <body></body> tags
let processedMarkup = "<p>processed markup</p>";
const distHtml = minified.replace(
  /<body>([\s\S]*?)<\/body>/i,
  `<body>${body}</body>`
);

// The unminifyHtml in imperfect and I'm only using it to debug.
const unminifiedHtml = unminifyHtml(distHtml);
//console.log(unminifiedHtml);

// Write the transpiled html
await writeFile("./dist/index.html", unminifiedHtml);
//await writeFile("./dist/index.html", distHtml);
