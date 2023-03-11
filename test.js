const str = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <tag-a>
      <tag-b>
        <tag-c></tag-c>
      </tag-b>
    </tag-a>
  </body>
</html>
`;
/*
In this modified regular expression, (?<=<body>[^]*?) is a positive lookahead assertion that matches the position right after the opening <body> tag, followed by any characters that are not line terminators (represented by [^]*?), but only as few characters as possible.

Then, /<tag-a\b[^>]*>/i matches the literal string "<tag-a", followed by a word boundary \b, any characters that are not a closing angle bracket > using the negated character class [^>]*, and finally, the i flag at the end makes the regular expression case-insensitive.

The regular expression will only match the first occurrence of <tag-a> after the opening <body> tag. The match() function will return an array containing the first match, or null if no match is found.
*/
console.log(str.match(/(?<=<body>[^]*?)<tag-a\b[^>]*>/i)[0]); // "apples"

console.log(str.match(/<body>([\s\S]*?)<\/body>/i)[1]);
