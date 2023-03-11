import fs from "fs";
import path from "path";

const customTagsDirectory = "./components";

// Read all files in the custom tags directory
fs.readdir(customTagsDirectory, (err, files) => {
  if (err) {
    console.error(err);
    return;
  }

  // Generate the HTML for each custom tag
  const customTagHTML = files.reduce((acc, file) => {
    // Read the file contents
    const filePath = path.join(customTagsDirectory, file);
    const fileContents = fs.readFileSync(filePath, "utf8");

    // Extract the tag name from the file name
    const tagName = file.replace(".html", "");

    // Generate the HTML for the custom tag
    return {
      ...acc,
      [tagName]: `${fileContents}`,
    };
  }, {});

  // Read the index.html file
  const indexHTML = fs.readFileSync("./pages/index.html", "utf8");

  // Replace the custom tag elements with the corresponding HTML
  const modifiedHTML = Object.keys(customTagHTML).reduce((html, tagName) => {
    return html.replace(
      new RegExp(`<${tagName}[^>]*>`, "g"),
      customTagHTML[tagName]
    );
  }, indexHTML);

  // Write the modified HTML to the index.html file
  fs.writeFileSync("./dist/index.html", modifiedHTML);
  console.log("Custom tags written to index.html");
});
