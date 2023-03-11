import { readFile, writeFile } from "node:fs/promises";

// We have code elsewhere to get this list dynmically, just hardcoded for now
const tags = [
  "my-header",
  "my-footer",
  "my-nested",
  "my-tag",
  "my-self-closing",
  "tag-c",
  "tag-b",
  "tag-a",
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

// Should we only process what's in the body?

// Should we process script tags?
// Probably not but we might be able to use special types of script tags that we will want to process.

// Should we allow tags to be used self closing and not?
// For now we won't. We will implement later.
// The exist such as input, hr, br, and img.
// The only reason we are not support them right now is to keep things simple.
const selfClosingTags = tags.filter((tag) => {
  return html.match(new RegExp(`<${tag}[^<]+\/>`, "gi"));
});

// This doesn't take into consideration unused components.
// When I say unused I mean not used within the page we are transpiling.
// As the components get processes recursively this will be interesting
// because you won't know if a component is unused until the entire tree is processed.
// On second thought, I'm not so sure this doesn't take into consideration unused components.
// It is based on selfClosingTags and that is based on the page that is being transpiled.
const regularTags = tags.filter((tag) => !selfClosingTags.includes(tag));

// Does not take into consideration attrs yet
// may have to revist the exlusion syntax, might wrong, might need a negative lookahead
const selfClosingTagRegExp = (tag) => {
  return new RegExp(`<${tag}[^<]+\/>`, "gi");
};

const tagRegExp = (tag) => {
  return new RegExp(`<${tag}>(?<innerHtml>.*?)<\/${tag}>`, "gmis");
};

// Yes doing this in parellel and keeping track of how many lines we will insert will be faster
// Next how to deal with non-self closing tags.
// Done - 1. regex for them
// 2. how to deal with custom tags inside of custom tags on index
// - As part of this, instead of first replacing tags, we will need to scan for nesting of tags,
// and we will need to handle N nests.
// When a nest occurs does the child effect the parent? does the parent effect the child?
// To answer the question above, no I don't think it has to. which simplifies things.
// The parent does not effect the child either. The component is self container.
// Sure a prop/attr can be passed to child, but that is all self contained with the child.
// There is nothing about what is happening in a specific component that is going to incluence another
// unless there is explicit data connections such as props/attrs or indirect methods such as a Proxy.
// Then seperate from taht custom tags in custom tag files, which is more a recurssion thing
/* for (let index = 0; index < selfClosingTags.length; index++) {
  const tag = selfClosingTags[index];
  const tagHtml = await readFile(`./components/${tag}.html`);
  html = html.replace(selfClosingTagRegExp(tag), (grp, pos) => tagHtml);
} */

// This first loop goes through all the regular (non-self closing) that are present on the page (not recursive)
// Once it finds a
/* for (let index = 0; index < regularTags.length; index++) {
  const tag = regularTags[index];
  const matches = html.matchAll(tagRegExp(tag));
  for (const match of matches) {
    console.log(match[0].replace(match[1], ""), "\n");
  }
  const tagHtml = await readFile(`./components/${tag}.html`);
  html = html.replace(tagRegExp(tag), (grp, pos) => tagHtml);
} */

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
