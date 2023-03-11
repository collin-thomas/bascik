import { readFile, writeFile } from "node:fs/promises";
import {
  listComponents,
  minifyHtml,
  getTag,
  recursivelyTranspile,
} from "./lib/functions.js";

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
// Remove comments and new lines
const html = minifyHtml((await readFile("./pages/index.html")).toString());

// Gets all the text between the <body></body> tags
const { innerContent: body } = getTag(html, "body");

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
// Now we need to replace the final tag with the markup inside.
// Not just the last but all of them, because you can have markup, and slots.
// 1. Ok add the markup to the body and then handle having plaintext or native html tags inside of the grandchild.
// 2. Also need to actually put the slot code inside the slot and not just the end of the file.
// 3. Make sure any native HTML before and after first custom component on index.html is included.
// All those tasks are complete.
// 1. Now to handle more than one one custom component can be parsed per level.
// Done.

let transpiledHtml = recursivelyTranspile(body, componentList);

// Puts our processed markup back between the <body></body> tags
const distHtml = html.replace(
  /<body>([\s\S]*?)<\/body>/i,
  `<body>${transpiledHtml}</body>`
);

// Write the transpiled html
await writeFile("./dist/index.html", distHtml);
