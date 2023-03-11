export const transpileComponents = () => {};

export const getTag = (htmlString, tagName) => {
  const pattern = new RegExp(
    `<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    "i"
  );
  const match = htmlString.match(pattern);
  return {
    content: match[0],
    innerContent: match[1],
  };
};

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
