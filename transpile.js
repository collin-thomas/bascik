import { readFile, writeFile } from "node:fs/promises";
import {
  minifyHtml,
  unminifyHtml,
  getTag,
  recursivelyTranspile,
} from "./lib/functions.js";
import { listComponents } from "./lib/files.js";

// Starting over
// Starting with the example of 3 tags, each a child of each other. Parent, child, grandchild.
// We will want to start reading each line after the <body> tag
// We cannot go line by line, because what if it is not formatted.
// I suppose we should format first. But that's slow.
// Regardless, starting after <body> we should look for the first custom tag.
// Remove comments and unnecessary whitespace characters
// We need a way to generate a list of the custom components
// After we do that, we should also have a way to get custom components from NPM packages.

// Get custom component list
const componentList = await listComponents();

// Read the file as a string
const html = (await readFile("./pages/index.html")).toString();

// Remove comments and new lines
const minified = minifyHtml(html);

// Gets all the text between the <body></body> tags
const { innerContent: body } = getTag(minified, "body");
//const body = "<tag-a><tag-b><tag-c> I want space </tag-c></tag-b></tag-a>";

// START - Process markup

// Sure this finds the first component and we won't select nested ones because those will get removed during recurssion
// But what about the next non-nested component? Shouldn't we instead be looking for all non-nested components?
// Maybe we don't have to over complicate it. We will replace the text and move on to the next one.
// We will need to check to see if the component implements the <component-slot>
// we are blinding processing nesting, have to think about this more
// We should be getting the content for each component too
// Lets first make this recursive
// Ok we made it recursive,
// now get the contents of each component and only use the recursion if the component implements the <component-slot>

//console.log(componentList["my-header"].content);
console.log(recursivelyTranspile(body, componentList));

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
