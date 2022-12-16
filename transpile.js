import { readFile, writeFile } from "node:fs/promises";

// We have code elsewhere to get this list dynmically, just hardcoded for now
const tags = [
  "my-header",
  "my-footer",
  "my-nested",
  "my-tag",
  "my-self-closing",
];

// Really looked into streams but it doesn't seems to make sense,
// you still need buffers and execution time seemed to be same
let html = (await readFile("./pages/index.html"))
  .toString()
  // Enable these if we want to minify
  //.replace(/\n/gims, "")
  // this line might be a little sloppy
  //.replace(/>\s*</gims, "><")
  // Remove comments
  .replace(/<!--(.*?)-->/gims, "");

// Should we allow tags to be used self closing and not? For now we won't.
const selfClosingTags = tags.filter((tag) => {
  return html.match(new RegExp(`<${tag}[^<]+\/>`, "gi"));
});

// This doesn't take into consideration unused components.
const regularTags = tags.filter((tag) => !selfClosingTags.includes(tag));

// Does not take into consideration attrs yet
// may have to revist the exlusion syntax, might wrong, might need a negative lookahead
const selfClosingTagRegExp = (tag) => {
  return new RegExp(`<${tag}[^<]+\/>`, "gi");
};

const tagRegExp = (tag) => {
  return new RegExp(`<${tag}>(.*?)<\/${tag}>`, "gmis");
};

// Yes doing this in parellel and keeping track of how many lines we will insert will be faster
// Next how to deal with non-self closing tags.
// Done - 1. regex for them
// 2. how to deal with custom tags inside of custom tags on index
// Then seperate from taht custom tags in custom tag files, which is more a recurssion thing
/* for (let index = 0; index < selfClosingTags.length; index++) {
  const tag = selfClosingTags[index];
  const tagHtml = await readFile(`./components/${tag}.html`);
  html = html.replace(selfClosingTagRegExp(tag), (grp, pos) => tagHtml);
} */
for (let index = 0; index < regularTags.length; index++) {
  const tag = regularTags[index];
  console.log(tag, html.match(tagRegExp(tag)));
  const tagHtml = await readFile(`./components/${tag}.html`);
  html = html.replace(tagRegExp(tag), (grp, pos) => tagHtml);
}

//console.log(html);
await writeFile("./dist/index.html", html);
// Only need this if i'm going to parse document with linkedom
// since dom doesn't like custom self closing tags
// Replace self closing
/* selfClosingTags.forEach((tag) => {
  html = html.replace(
    new RegExp(`<${tag}[^<]+\/>`, "gi"),
    (grp, pos) =>
      `${grp.replace(" />", ">")}${grp.replace(" />", ">").replace("<", "</")}`
  );
}); */
