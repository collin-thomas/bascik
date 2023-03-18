# bascik

## Goals

- Create reasuble custom HTML tags aka components
- Ship zero Javascript by default
- Work within HTML spec

## Development

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
- [ ] Add scoped styles
- [ ] Add support for directories in /components
- [x] Add support for directories in /pages
- [ ] Add support for custom attributes/props, think custom image component
- [x] Add optional server to serve static files. Remove .html.
- [ ] Serve non html files such as images with the HTTP2 server. <https://stackoverflow.com/a/40899767/1469690>
- [ ] When using integrated HTTP server, automatically reload web page on transpile.
- [ ] SSG & SSR
- [ ] Add Dockerfile
- [ ] Script tags that only run at build
- [ ] Add config js file to opt-in to features
- [ ] Add scoped JS script tags
- [ ] Add units tests
- [ ] Test adding vue-petite to a page <https://github.com/vuejs/petite-vue#usage>

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

## Notes

Scoped css styles

<https://github.com/PM5544/scoped-polyfill/blob/master/readme.md>

Scoped script tag (half baked)

<https://gist.github.com/dy/2124c2dfcbdd071f38e866b85436c6c5>

Any way to serve static html files from express without the extension?
<https://stackoverflow.com/questions/16895047/any-way-to-serve-static-html-files-from-express-without-the-extension>

I don't want to couple this to express or any server. nginx or just S3 buckets should be enough. This should just be an option.
