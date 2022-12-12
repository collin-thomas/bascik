/**
 * Goal: Bundleless HTML with components & no JS until JS is used.
 * 1. Find all folders in /components, "register" them as a Set
 * 2. Find all .html files from ./* and find matches for component names
 * 3. As each component is found, read the file and inject it's contents,
 * 3a. this is done recursively for components in components
 */
import { readdir, open, writeFile, readFile } from "node:fs/promises";
import fs from "node:fs";
import readline from "node:readline";
import { Readable } from "node:stream";

/* const read = async ({ componentName, componentNames, componentTags }) => {
  const file = await open(`./components/${componentName}.html`)
  for await (const line of file.readLines()) {
    const nestedComponentTag = line
      .trim()
      .replace(/(<!--.*?-->)|(<!--[\S\s]+?-->)|(<!--[\S\s]*?$)/g, '')
    const foundNestedComponent = componentTags.has(nestedComponentTag)
    if (foundNestedComponent) {
      const nestedComponentName = nestedComponentTag.substring(
        1,
        nestedComponentTag.indexOf(' ')
      )
      await read({
        componentName: nestedComponentName,
        componentNames,
        componentTags,
      })
    } else {
      // write to buffer
      
    }
  }
} */

/* const componentNames = new Set(
  (await readdir('./components')).map((file) =>
    file.substring(0, file.indexOf('.'))
  )
)
const componentTags = new Set(
  Array.from(componentNames).map((name) => `<${name} />`)
) */

/**
 * 
 * @param {*} filePath 
 * @returns 
 * @example const rl = createReadInterface('./components/my-footer.html')
console.log(rl)
rl.on('line', (line) => console.log(line))

 */
const createReadInterface = (filePath) => {
  //const fileHandle = await open(filePath)
  return readline.createInterface({
    //input: fileHandle.createReadStream(),
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
};

const createListofComponents = async () => {
  const componentFileNames = await readdir("./components");
  const components = await Promise.all(
    componentFileNames.map(async (fileName) => {
      const name = fileName.substring(0, fileName.indexOf("."));
      const tag = `<${name} />`;
      const readInterface = createReadInterface(`./components/${fileName}`);
      return {
        fileName,
        name,
        tag,
        readInterface,
      };
    })
  );
  return { components };
};
const { components } = await createListofComponents();

// make component dependancy graph, this way we can inline components once.
// a -> b -> c
//      b -> d -> e
// and check for circular dependancies

// consider not processing all the components up front
// rather than a case by case bases as seen from the usage in the pages
// because even a simple concept of slots would change the inlining process

// why reinvent slots and reactivity when vue, svelte, react have that handled
// how can we use a vue component if we want?
// maybe petite-vue or vue as web components?

// if we use petite-vue we can use
// https://github.com/vuejs/petite-vue#explicit-mount-target
// then we can say yeah use it only on these inline div(s)
// but maybe that's overkill and just enable for the whole page.

// For hot rebuild, you'll want to watch all file for changes
// it would be nice to not have to rebuild the whole page, but to do so,
// that would require tokenizing (i think thats the correct term)
// each line, so we know exactly where to jump to and only update part of the dist
// instead of rewriting the entire dist
// This can be an enhancement, don't need to do it right away.

/* 
var s = new Readable()
s.push('beep') // the string you want
s.push('beep') // the string you want
s.push('beep') // the string you want
s.push(null)

const createReadStream = (readableStream) => {
  //const fileHandle = await open(filePath)
  return readline.createInterface({
    //input: fileHandle.createReadStream(),
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  })
}
 */
//console.log(components)
// now that you have all the components and their files read into memory
// look through each one and see if they are nested and inline those.

for (let index = 0; index < components.length; index++) {
  const component = components[index];
  component.readInterface.on("line", (line) => console.log(line));
}

//buf.write('qq', 2)

//console.log(components[0].buffer.toString())
/* 
var bufferStream = new stream.PassThrough()
bufferStream.end(components[0].buffer)

var rl = readline.createInterface({
  input: bufferStream,
})

var count = 0
rl.on('line', function (line) {
  console.log('this is ' + ++count + ' line, content = ' + line)
})
 */

/* 

await Promise.all(
  Array.from(componentNames).map((componentName) =>
    read({ componentName, componentNames, componentTags })
  )
)
 */
