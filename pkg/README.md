# Bascik

Bascik is a Web Framework, it closely resembles a Static Site Generator (SSG).

Write HTML, CSS, and JavaScript as components without any new skills.

Bascik allows you to split your HTML, CSS, and JavaScript into separate files to use as components, without any special syntax or configuration.

You don't write in a templating language, you don't write JavaScript as components, you simply write HTML, and use CSS and JavaScript as needed, just as you would in a single HTML file.

Let's say you want to build a website, you realize the navigation and footer needs shared on all pages. Instead of reaching for a JavaScript framework, templating language, etc, Bascik allows you to do what would come naturally, add the code for the navigation and footer to separate files and reference them as HTML elements.

Bascik will acts as a fancy find and replace machine and add your components code in place of the HTML tag name.

The cool trick is Bascik scopes component's CSS and JavaScript to avoid name conflicts across components or repeated use of components on a single page.

Bascik proudly does not add any JavaScript to your pages, nor does it is attempt to alter your HTML by wrapping it other elements.

## Getting Started

Install with your package manager of choice:

`yarn add @bascik/bascik`

`pnpm add @bascik/bascik`

`npm install @bascik/bascik`

## Project Setup

Add the Bascik npm scripts to your `package.json`.

```json
{
  "scripts": {
    "dev": "bascik",
    "build": "bascik --build"
  }
}
```

The `dev` command will transpile your project and start the development server.

The `build` command will transpile your project and create a dist directory that can be deployed to a static website hosting solution.

## Folder Structure

The two default directory bascik will look for are:

- `src/pages`
- `src/components`

These directories can be overridden using the `bascik.config.js` file.

## Writing Components

Components get their name from the file or folder in which they are defined.

For example, if you want to define a footer component, you would create the `src/components/footer.html` file and populate it with your HTML and JavaScript.

If you want to style your component, use a folder name with the same name as the component, and add the HTML and CSS files with the same name as the component with that directory.

For the footer example, create the directory `src/components/footer` and add the `footer.html` and `footer.css` within the directory.

## Example Page and Component

### Example Component HTML

File Path: `src/components/site-nav/site-nav.html`

File Content:

```html
<nav class="navigation header">
  <ul>
    <li><a href="/">index</a></li>
    <li><a href="/about">about</a></li>
    <li><a href="/contact">contact</a></li>
  </ul>
</nav>

<script>
  const links = navLinks.querySelectorAll('a');
  links.forEach(link => {
    link.addEventListener('mouseover', () => {
      console.log(`Hover: ${link.textContent}`);
    });
  });
</script>
```

### Example Component CSS

File Path: `src/components/site-nav/site-nav.css`

File Content:

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

.header {
  padding-top: 16px;
}
```

### Example Page

File Path: `src/pages/index.html`

File Content:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Home</title>
    <!-- There isn't anything preventing you from adding stylesheets or a <style> tag -->
    <!-- <link rel="stylesheet" href="/css/styles.css" /> -->
    <!-- <link rel="stylesheet" href="/css/print.css" media="print" /> -->
  </head>
  <body>
    <site-nav></site-nav>
    <h1>Hello World</h1>
  </body>
</html>
```

## JavaScript

You can add JavaScript to any page or component HTML file in a `<script>` tag as you normally would.

## Nested Elements aka Slots

There is a custom reserved tag within Bascik called `<slot-component>` which can be used to signal to the Bascik transpiler that HTML tags, including other Bascik components, can be nested elements.

Create a component file called `components/tag-a.html` with the following HTML:

```html
<p>tag-a</p>
<slot-component></slot-component>
<p>foo bar</p>
```

Then in a the `pages/index.html` file add the following HTML:

```html
<tag-a>
  <p>Hello World</p>
</tag-a>
```

The Bascik transpiler will output the following HTML:

```html
<p>tag-a</p>
<p>Hello World</p>
<p>foo bar</p>
```

## Bascik Config

This file is optional. You can add the `bascik.config.js` to the root of your project to override default configurations of Bascik. You can also set configuration overrides specifically for the build.

The following is an example where all the default configurations are set.

```js
export const bascikConfig = {
  scopeScriptBlocks: true,
  scopeAttribute: {
    class: true,
    id: true,
    name: true,
  },
  directory: {
    pages: 'src/pages',
    components: 'src/components'
  },
  minifyStyles: false,
  obfuscateAttributeNames: false,
  cacheHttp: false,
};

export const buildOverrideConfig = {};
```

## Development Server

The dev server that runs when calling the `bascik` command is a Node.js HTTP/2 server. It will generate a self-signed certificate.

Note:

If you're bothered by clicking to ignore the cert warning, you can launch Chrome with the `--ignore-certificate-errors` flag to ignore the cert warning. Alternatively, you can configure your system to trust the certificate.

The development server serves your pages from memory, not from disk, for a super fast development experience. The page data is also compressed for further performance improvements.

### Live Reload

The development server has smart live reloading.

If you modify a the source of a page that is currently open in the browser, that page will be reloaded in the browser.

If you modify and component that it utilized on a page the is currently open in the browser, that page will be reloaded.

This provides a great developer experience where your changes are reflected instantly.
