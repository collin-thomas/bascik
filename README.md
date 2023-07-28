# Bascik: A Web Framework

Bascik is basic not BASIC.

Bascik removes the need for a JavaScript Framework or Web Components to use components.

You write components as HTML files.

You can add CSS and JavaScript to your components.

To create an app, create each HTML page and use your components.

Bascik transpiles each page and it's components into a single `.html` file per page.

The only JavaScript that is on the page is the JavaScript you add.

## Goals

- Create reusable custom HTML tags aka components
- Ship zero Javascript by default
- Work within HTML spec

## Key Features

- Components do not require importing or registering
- Slots aka Component Children
- Scoped Styles
- Scoped JavaScript

## Development

Install deps `yarn`

Requires Node.js 18+

1. Terminal 1: `yarn dev`
2. Terminal 2: `yarn watch`

### Using builtin HTTP/2 Server

Currently does not trigger web page reload.

```sh
yarn serve
```

## Debug

1. Terminal 1: `yarn debug`
2. Terminal 2: `yarn watch`

## Todo

- [x] Recursively transpile custom components
- [x] Watch HTML files for change to rerun transpile
- [x] Support transpiling multiple pages & directories of files
- [x] Add scoped styles via classes
- [x] Add scoped styles for elements
- [x] Add scoped style support for `@media`
- [x] Add scoped style support for `@keyframes`
- [x] Strip scoped id styling from components
- [x] Remove comments from scoped styles
- [x] Add support for pseudo-elements
- [x] Opt-in or "prod build" feature to obfuscate & minify class names
- [x] Minify CSS
- [x] Default slots
- [x] Scope JavaScript `id` attribute values in HTML and `<script>`
- [ ] Scope all functions and variable defined at root of `<script>` tags using namespace.
- [ ] Scoped CSS will break JavaScript selecting by class name, `.querySelectorAll('.my-class')` therefore we need to refactor so that does not break.
      We can keep the scoping of css where it is, but the obfuscation will have to happen post JavaScript scoping. To keep the scoping of css where it is, means we would have to replicate the syntax which is pretty simple though, for example `my-class` for tag `scoped-js-a` becomes `bascik__scoped-js-a__my-class`. So we update JavaScript selectors to use that which is easy and we have the class name and component name available to us, and if it isn't already we can make the class scoping syntax a function so we don't duplicate logic. Then we just business as usual append the randomized string for that component instance.
- [ ] Consider requiring scoped JavaScript `<script>` tags to require `data-bascik-scoped`. Once thought to be redundant, it may be required to enable `<script>` tags that run at build or run server-side. See next two todo items.
- [ ] Script tags that only run at build
- [ ] Script tags that only run when a page is requested
- [ ] We may want to move all script tags to the bottom of the page. I'm not sure what impact it has if any. If it's purely a style guide type thing then we can ignore it or make it low priority.
- [ ] Slots fallback content <https://vuejs.org/guide/components/slots.html#fallback-content>
- [ ] Consider using an attribute to define slots `<div data-basic-slot></div>`
- [ ] Named slots <https://vuejs.org/guide/components/slots.html#named-slots>
- [x] Test adding vue-petite to a page <https://github.com/vuejs/petite-vue#usage>
- [ ] Add support for custom attributes/props, think custom image component. Testing with `<my-prop-test>` and `<my-prop>`. Need to write the code to make it work.
- [ ] Config option for verbose logging. Toggles `{cause}` in `console.warn|error`.
- [ ] Serve non html files such as images with the HTTP2 server. <https://stackoverflow.com/a/40899767/1469690>
- [ ] When using integrated HTTP server, automatically reload web page on transpile.
- [x] Validate no errors when /pages or /components dir does not exist
- [x] Add support for directories in /components
- [x] Add support for directories in /pages
- [x] Add optional server to serve static files. Remove .html.
- [x] 404 handling for custom HTTP2 server
- [ ] Convert to npm package and existing files as example projects
- [ ] Dockerize
- [x] Add config js file to opt-in to features
- [ ] Plugin type system to run the opt-in features
- [x] Add units tests
- [ ] Consider being able to use npm packages
- [ ] Filter unused styles
- [ ] Add test coverage badge <https://github.com/vitest-dev/vitest/pull/2578#issuecomment-1368082900>

### Abandoned todos

- Add scoped styles via IDs. This may be more complicated because of all the conditionals. <https://www.w3schools.com/cssref/trysel.php>

## Usage

### Slots

Definition `tag-a.html`:

```html
<p>tag-a</p>
<slot-component></slot-component>
<p>more text</p>
```

Usage:

```html
<tag-a>
  <p>Hello World</p>
</tag-a>
```

Rendered:

```html
<p>tag-a</p>
<p>Hello World</p>
<p>more text</p>
```

## Developer Docs

The file and npm script `create-key` are written they way they are to be OS and shell agnostic. It does require `openssl` to be part of the user's PATH.

## Scoped Styles

Works with files of the same name with `.css` extension.

The `<style>` tag is not valid defined outside of the `<head>` so scoped styles cannot be defined within one.

Scoped styles for elements can be toggled via bascik configuration file.

Scoped Styles are injected into each page where their component is used.

### @media and @keyframes

With scoped styles enabled, `@media` and `@keyframes` are also scoped.

### How Scoped Styles work

### How Scoped Styles for Classes work

Classes are automatically named spaced for the element.

Take for example the following components and styles.

`components/custom-nav.html`

```html
<nav class="navigation">
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>
```

`components/custom-nav/custom-nav.css`

```css
.navigation ul {
  list-style-type: none;
  margin: unset;
  padding: unset;
}
.navigation ul li {
  display: inline-block;
}
.navigation ul li a {
  padding: 8px;
}
```

`pages/index.html`

```html
<html>
  <body>
    <custom-nav></custom-nav>
  </body>
</html>
```

Results in the following rendered html.

```html
<html>
  <style>
    .bascik__custom-nav__navigation ul {
      list-style-type: none;
      margin: unset;
      padding: unset;
    }
    .bascik__custom-nav__navigation ul li {
      display: inline-block;
    }
    .bascik__custom-nav__navigation ul li a {
      padding: 8px;
    }
  </style>
  <body>
    <nav class="bascik__custom-nav__navigation">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
  </body>
</html>
```

### How Scoped Styles for Elements work

Auto inject class per instance of element.

The intention is not to inject any extra elements into the transpiled html.

For example, all `<p>` tags would have the class `bascik-p` added.

Then the css would be as you would expect.

Defining an element's style.

```css
p {
  text-decoration: #d3ff8d wavy underline;
}
```

Writing a component using native HTML elements.

```html
<p>hello</p>
<p>world</p>
```

`pages/index.html`

```html
<html>
  <body>
    <custom-comp></custom-comp>
  </body>
</html>
```

Results in the following html being rendered.

```html
<html>
  <style>
    .bascik__custom-comp__el__p {
      text-decoration: #d3ff8d wavy underline;
    }
  </style>
  <body>
    <p class="bascik__custom-comp__el__p">hello</p>
    <p class="bascik__custom-comp__el__p">world</p>
  </body>
</html>
```

## Scoped JavaScript

I have to make the choice of should I make all JavaScript scoped or only `data-bascik-scoped` scoped.

What makes it scoped? The scope would be the `name` and `id` attributes. I suppose `class` attributes as well.

If I choose to only scope that is within `data-bascik-scoped`, I first have to look at the JavaScript selectors.

Only the `id` or `name` attributes that are being selected by the scoped JavaScript would get updated.

However the problem with that is what if non-scoped JavaScript is also selecting it.

At that point it makes sense that JavaScript is scoped my default.

What if I want global JavaScript?

When would you want global JavaScript?

I could see wanting to share state between components via a global store.

But that doesn't involve `id` or `name` attributes. That's just pure JavaScript.

The JavaScript itself isn't scoped, it's just the `id` and `name` are randomized.

I think this thought exercise results in me saying that specifying `data-bascik-scoped` is unnecessary.

---

If we are scoping via `id` and `name`, we will have to be aware that will break CSS selectors such as `input[name="my-name"]`. Or does it? If I can have it work conjunction.

The scoping of `id` and `name` for Scoped JavaScript will have to work in harmony with Scoped CSS.

I should rethink the code and just scope and randomize all `id`, `name`, `class` attribute values in the HTML, CSS, and JavaScript. That would take care of everything.

---

Each instance of component will need unique `ids` and `names` generated.

- [x] Scope JavaScript `name` attribute values in HTML and `<script>` tags

Turns out though we don't actually want to scope name attributes.

Maybe we could come up with an option to do it on a per component basis. But in all the use cases for name attributes, you are not commonly selecting them via JavaScript and in most cases the names cannot be randomized because they are either values that have specific meaning (meta and param tags) or they are being used by a server on from a form input.

---

It will look at a component and find all ids and give them a hash
Then it will look if any script tags have the attribute `data-bascik-scoped`
If so, it will then find and replace the id with the hash.

This is all fine and good for ids, but if you use something like `document.getElementsByTagName('p')`,
then it becomes a problem. The script will be done at runtime and select all the `<p>` tags,
even if there were not any `<p>` tags in the component itself.

To effectively scope the JS, it would have to be evaluated at runtime.
But in most cased that probably defeats the purpose of the script.

That's why I continue to believe injecting petite-vue into the page will be the best option.

```html
<button id="my-btn" type="button">Click</button>

<script data-bascik-scoped>
  document.getElementById("my-btn").addEventListener("click", () => {
    alert("hello");
  });
  console.log(document.getElementsByTagName("p"));
</script>
```

## Example

Source

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <style>
      body {
        background-color: #18191b;
        color: #fff;
        font-size: larger;
      }
    </style>
  </head>
  <body>
    <h1>Heading 1</h1>
    <tag-a data-bascik-test="hello">
      <tag-b>
        <p>hello</p>
        <tag-c></tag-c>
        <tag-c></tag-c>
        <tag-d></tag-d>
        <tag-d></tag-d>
        <p>goodbye</p>
      </tag-b>
    </tag-a>
    <tag-a>
      <tag-b>
        <p>hello</p>
        <tag-c></tag-c>
        <tag-d></tag-d>
        <p>goodbye</p>
      </tag-b>
    </tag-a>
    <footer>
      <hr />
      footer
    </footer>
  </body>
</html>
```

Rendered

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <style>
      body {
        background-color: #18191b;
        color: #fff;
        font-size: larger;
      }
    </style>
  </head>
  <body>
    <h1>Heading 1</h1>
    <div>
      <p>tag-a</p>
      <div>
        <p>tag-b</p>
        <p>hello</p>
        <div><p>tag-c</p></div>
        <div><p>tag-c</p></div>
        <div><p>tag-d</p></div>
        <div><p>tag-d</p></div>
        <p>goodbye</p>
      </div>
    </div>
    <div>
      <p>tag-a</p>
      <div>
        <p>tag-b</p>
        <p>hello</p>
        <div><p>tag-c</p></div>
        <div><p>tag-d</p></div>
        <p>goodbye</p>
      </div>
    </div>
    <footer>
      <hr />
      footer
    </footer>
  </body>
</html>
```

## Under the Hood

- `transpile.js` - Finds pages to render based on page or component changes. Runs `processAllPages()`
- `transpile.js` - `pageProcessing()` calls `listComponents()` and a lot happens there. Right now the Scoped Styles get processed here.
  The way Scoped Styles are is implemented is kinda dumb though.
  If you specify a component multiple times the styles get added multiple times.
  Really those should be deduplicated.
  However that duplication might work to our advantage.
  Because each instance should be treated separately.
  [ ] We can attach a sufficiently random string to the end of each class.
  This will be compatible with our `bascik.config.js` option of `obfuscateClassNames`.
  It's important to remember `obfuscateClassNames` only obfuscates, it does not randomize.
  [ ] Now that each class is scoped and randomized, we need to do the same for all `id` and `name` attribute values.
  Just remember you won't be able to do the randomization the same place the scoping is done because the randomization has to be done on a per page basis, whereas the scoping is done at a global list of all components level before any page processing begins.
  This means that the obfuscation would be "broken" by resulting in the obfuscated version of the string appended by the randomized string. So maybe we accept that or rethink it.
- `processing.js` - `processAllPages()` calls `recursivelyTranspile()`
- `recursivelyTranspile()` calls `getFirstComponent()` which uses `getTag()`
- `recursivelyTranspile()` checks if it got a component, if not returns the HTML. If it did get a component back, it first calls `replaceTag()` with the tag specified as `slot-component` to replace the default slot (`<slot-component></slot-component>`), if there is one for the component. Then it calls `replaceTag()` again. This time to

## Notes

Scoped css styles

<https://github.com/PM5544/scoped-polyfill/blob/master/readme.md>

Scoped script tag (half baked)

<https://gist.github.com/dy/2124c2dfcbdd071f38e866b85436c6c5>

Any way to serve static html files from express without the extension?
<https://stackoverflow.com/questions/16895047/any-way-to-serve-static-html-files-from-express-without-the-extension>

I don't want to couple this to express or any server. nginx or just S3 buckets should be enough. This should just be an option.

Inlining CSS for performance

<https://blog.logrocket.com/improve-site-performance-inlining-css/>

Load optimized npm packages with no install and no build tools.

<https://www.skypack.dev/>

### Pipeline

To create a JavaScript pipeline that passes a string to each function further modifying it without reassigning a variable each time, you can use the Array.prototype.reduce() method in combination with arrow functions.

Here is an example of how you can implement such a pipeline:

```js
const str = "Hello, World!";

const modifyStr = (...functions) =>
  functions.reduce((result, func) => func(result), str);

const upperCase = (str) => str.toUpperCase();
const addExclamation = (str) => `${str}!`;
const reverse = (str) => str.split("").reverse().join("");

const finalStr = modifyStr(upperCase, addExclamation, reverse);
console.log(finalStr); // Output: "!DLROW ,OLLEH"
```

In this example, the modifyStr() function takes a string and an array of functions as arguments. The reduce() method is used to apply each function to the string, with the result of each function being passed as input to the next function. The final result is returned as the output of the modifyStr() function.

To use this pipeline, you can define any number of functions that take a string as input and return a modified string, and then pass these functions as arguments to the modifyStr() function. The pipeline will then apply each function in turn to the input string, without requiring the use of intermediate variables.
