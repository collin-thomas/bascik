export const recursivelyTranspile = (body, componentList, markup = "") => {
  const { innerContent, component } = getFirstComponent(body, componentList);
  // Sloppy to replace slot-component as string an not a more advanced regexp, placeholder for now.
  // But honestly it shouldn't show up anywhere except like that,
  // but I'm using my more advanced getTag regexp and it should use the same one.
  markup +=
    component.content.replace("<slot-component></slot-component>", "") + "\n";
  // Don't continue to recurse if there isn't anymore markup, or if the component doesn't specify the slot-component
  // But if tehre is nested markup, and the parent component doesn't specify the slot-component,
  // instead of just stopping there, and printing out untranspiled html, we should throw an error.
  // BUT what if the nested data doesn't contain custom components, then that's perfectly valid.
  // Let's keep it the way it is for now.
  if (!innerContent || !getTag(component.content, "slot-component")) {
    return markup.trim();
  }
  return recursivelyTranspile(innerContent, componentList, markup);
};

export const getFirstComponent = (htmlString, componentList) => {
  const match = htmlString.match(
    new RegExp(`<\/?(${Object.keys(componentList).join("|")})`)
  );
  if (!match) return {};
  const firstComponentName = match[1];
  return {
    name: firstComponentName,
    ...getTag(htmlString, firstComponentName, componentList),
  };
};

export const getTag = (htmlString, tagName, componentList) => {
  const pattern = new RegExp(
    `<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    "i"
  );
  const match = htmlString.match(pattern);
  if (!match) return;
  const returnObj = {
    content: match[0],
    innerContent: match[1],
  };
  if (!componentList) return returnObj;
  return { ...returnObj, component: componentList[tagName] };
};

const extractScriptTags = (htmlString) => {
  const html = htmlString.replace(/<!--[\s\S]*?-->/g, "");
  const pattern = new RegExp(`<script[^>]*>([\\s\\S]*?)<\\/script>`, "gi");
  const arr = [...html.matchAll(pattern)];
  if (!arr.length) return "";
  return arr
    .map((script) => script[0])
    .join("\n")
    .trim();
};

export const minifyHtml = (htmlString) => {
  let html = htmlString.replace(/<!--[\s\S]*?-->/g, "");
  const scriptTags = extractScriptTags(html);
  if (scriptTags) {
    const pattern = new RegExp(`<script[^>]*>([\\s\\S]*?)<\\/script>`, "gi");
    html = html.replace(pattern, "").trim();
  }
  html = html.replace(/\n/g, "").replace(/>\s+</g, "><");
  if (scriptTags) {
    html += `\n${scriptTags}`;
  }
  return html;
};

// The unminifyHtml in imperfect and I'm only using it to debug.
export const unminifyHtml = (minifiedHtml) => {
  // Insert line breaks after opening tags and before closing tags
  const htmlWithLineBreaks = minifiedHtml
    .replace(/<([^\/][^>]*?)>/g, "\n$&")
    .replace(/(<\/[^>]+?>)/g, "$1\n");

  // Add indentation for nested tags
  const lines = htmlWithLineBreaks.split("\n");
  let indentationLevel = 0;
  let indentedHtml = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isOpeningTag = line.match(/^<[^/]/);
    const isClosingTag = line.match(/^<\/[^>]+>/);

    if (isClosingTag) indentationLevel--;

    for (let j = 0; j < indentationLevel; j++) {
      indentedHtml += "  ";
    }

    indentedHtml += line + "\n";

    if (isOpeningTag && !line.match(/\/>$/)) indentationLevel++;
  }

  return indentedHtml;
};
