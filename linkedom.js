import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";

const x = await readFile("./pages/index.html");
const { document } = parseHTML(x.toString());

const tags = ['"my-header", "my-footer", "my-nested"'];

for (let index = 0; index < tags.length; index++) {
  const tag = tags[index];
  const collection = document.getElementsByTagName(tag);
  console.log(collection.length);
}
