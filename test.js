export const replaceTag = (htmlString, tagName, transpiledTag) => {
  const regexp = new RegExp(
    `(?<content><${tagName}[^>]*>(?<innerContent>([\\s\\S]*?))<\/${tagName}>)`,
    "i"
  );
  return htmlString.match(regexp);
};

const transpiledHtml = `<h1>Heading 1</h1><div><p>tag-a</p><div><p>tag-b</p><p>hello</p><tag-c></tag-c><tag-c></tag-c><tag-d></tag-d><tag-d></tag-d><p>goodbye</p></div></div><footer><hr />      footer    </footer>'`;
console.log(replaceTag(transpiledHtml, "tag-c", "<x></x>"));

const pagePath = "pages/new.html";
const distPagePath = pagePath
  .split("/")
  .map((part, index) => (index === 0 ? "dist" : part))
  .join("/");

console.log(distPagePath);
