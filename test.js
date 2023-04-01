export const replaceTag = (htmlString, tagName, transpiledTag) => {
  const regexp = new RegExp(
    `(?<content><${tagName}[^>]*>(?<innerContent>([\\s\\S]*?))<\/${tagName}>)`,
    "i"
  );
  return htmlString.match(regexp);
};

const transpiledHtml = `<h1>Heading 1</h1><div><p>tag-a</p><div><p>tag-b</p><p>hello</p><tag-c></tag-c><tag-c></tag-c><tag-d></tag-d><tag-d></tag-d><p>goodbye</p></div></div><footer><hr />      footer    </footer>'`;
//console.log(replaceTag(transpiledHtml, "tag-c", "<x></x>"));

const pagePath = "pages/new.html";
const distPagePath = pagePath
  .split("/")
  .map((part, index) => (index === 0 ? "dist" : part))
  .join("/");

//console.log(distPagePath);

const x = false;
const y = false;
const optProp = {
  a: 1,
  b: 2,
  ...{ ...((x || y) && { c: 3 }) },
};
console.log(optProp);

const config = {
  scopedStyles: {
    classes: true,
    elements: true,
  },
};

const initBascikConfig = (config) => {
  const BascikConfig = { ...config };

  BascikConfig.scopedStylesEnabled =
    BascikConfig?.scopedStyles?.classes || BascikConfig?.scopedStyles?.elements;

  const frozenConfig = Object.freeze(BascikConfig);
  return { BascikConfig: frozenConfig };
};
const { BascikConfig } = initBascikConfig(config);

console.log(BascikConfig);

console.log([1, null, 3].filter((n) => `${n}`.match(/\d/)));

console.log(true && [4, 5, 6]);
console.log("" && [4, 5, 6]);

let html = `<nav class="navigation   header"  >
<ul>
  <li><a href="/">index</a></li>
  <li><a href="/about">about</a></li>
  <li><a href="/new">new</a></li>
  <li><a href="/sub/">sub page</a></li>
  <li><a href="/x/">not found</a></li>
</ul>
</nav>`;

const prefixClassesInHtml = (html, componentName) => {
  return html.replace(/(?<=class=").+?(?=")/gm, (match) => {
    return match
      .replace(/  +/g, " ")
      .split(" ")
      .map((className) => `bascik__${componentName}__${className}`)
      .join(" ");
  });
};

console.log(prefixClassesInHtml(html, "nav"));

let css = `
p {
  text-decoration: #d3ff8d wavy underline;
}
h1 {
  text-decoration: #d3ff8d wavy underline;
}
ul {
  text-decoration: #d3ff8d wavy underline;
}
`;

css.replace(/^[a-z1-6]+(?=[\s{])/gim, (match) => {
  console.log(match);
});
