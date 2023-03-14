# bascik

## Goals

- Create reasuble custom HTML tags aka components
- Ship zero Javascript by default
- Work within HTML spec

## Development

1. Terminal 1: `node --watch ./transpile.js`
2. Terminal 2: `npx watch-http-server dist/`

## Debug

All you have to do is run it with the `--inspect` flag and the debugger will run automatically.

`node --inspect --watch ./transpile.js`

## Todo

- [x] Recursively transpile custom components
- [ ] Watch HTML files for change to rerun transpile
- [ ] Support transpiling multiple pages
- [ ] Add scoped styles
- [ ] SSG & SSR
- [ ] Script tags that only run at build
- [ ] Add config js file to opt-in to features
- [ ] Add scoped JS script tags

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

## Notes

Scoped css styles

<https://github.com/PM5544/scoped-polyfill/blob/master/readme.md>

Scoped script tag (half baked)

<https://gist.github.com/dy/2124c2dfcbdd071f38e866b85436c6c5>
