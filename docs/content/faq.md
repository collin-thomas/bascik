# FAQ

Answers to common questions about Bascik.

## How do you pronounce Bascik? Where does the name come from?

Just like "basic." The idea is basic, the implementation is basic in theory, and the usage is basic. It felt like the right word.

The spelling comes from my maternal grandmother's maiden name. So the name is unique and means something personal.

## Isn't BASIC already a programming language?

Yes. In fact some of my earliest exposure to programming was to TI-Basic on my friend's calculator. BASIC is an old programming language and enough time has passed. It can take on new meaning.

## What is Bascik?

Bascik is a build tool for HTML components. You write reusable components in vanilla HTML, CSS, and JavaScript. At build time, Bascik resolves your custom tags to their component source, scopes CSS and JavaScript so they never collide across instances, and outputs a directory of vanilla HTML files. Zero JavaScript is added to your pages, every script in the output was written by you.

By default the output is fully static and can be hosted anywhere. If you need per-request dynamic content, the [production server](/server) lets you run server-side scripts that inject into specific sections of a page at request time, while everything else stays static.

For a deeper look: [Getting Started](/getting-started), [Scoped CSS](/scoped-styles), [Scoped JavaScript](/scoped-javascript), [Switch to Bascik](/switch).

## Who made Bascik?

Bascik was created by [Collin Thomas](https://github.com/collin-thomas).

## Why did you build Bascik?

I started building Bascik in late 2022. I wanted the fastest websites and dashboards but I needed components. I wanted to use the foundational languages without any abstraction layer, using the HTML, CSS, and JS I already knew, and avoiding JavaScript at runtime as a bottleneck.

Components have always been a JavaScript thing. Web Components tried to make it native but it's still JavaScript, and there's always Shadow DOM or virtual DOM involved. We don't need any of that. You can write HTML, CSS, and JavaScript and use it in multiple places on a site, you just need to copy it and scope it. That's really all it is, just a bunch of regex to make it happen.

It seems like a big undertaking but the web standards are so well defined that you have an obtainable target. It'll just take some effort. So that's what I did.

Then I saw the rise of AI-assisted coding and thought, this tool I've been building is going to be perfect for that. Our tooling primarily exists for humans to use, to make tasks easier. But when the tools start to get in the way, giving an LLM a tool that doesn't impose its own rules and just lets you write the fundamental web languages is going to be great for both developers and AI-assisted coding.

## What happens if I name a component after a native HTML element?

If you create a file like `nav.html` or `div.html`, Bascik will print a warning in the terminal when starting the dev server or running a build, and still load it:

```text
warning: Component "nav" has the same name as a native HTML element.
This may cause unexpected behaviour, consider a hyphenated name like "my-nav".
```

The component will conflict with every occurrence of that element in your pages. All your `<nav>` tags would be replaced by the component content, most likely breaking your site entirely.

Always use a hyphenated name for components, for example `site-nav.html` instead of `nav.html`. This follows the HTML custom element convention: a hyphen in the tag name is how browsers (and Bascik) distinguish a component from a built-in element.

## What happens if I use uppercase letters in a component filename?

Component names are normalized to lowercase when loaded. `My-Card.html` registers as `my-card` and is used as `<my-card>` in pages.

If you have two files that differ only in case (for example `my-card.html` and `My-Card.html`), they both map to the same `my-card` component key and the last one loaded wins. Avoid this situation by using consistent lowercase filenames.

> **Convention.** Use lowercase, hyphenated filenames for all components: `site-nav.html`, `feature-card.html`, `alert-box.html`. This matches the HTML custom element convention and avoids any case-collision surprises.

## Can I use Bascik with JavaScript libraries like Alpine.js or HTMX?

Yes. Bascik's output is vanilla HTML. Any library that works with HTML works with Bascik. Drop a `<script>` tag in and it loads like it always has. See the [JavaScript Libraries](/libraries) page for examples.

## Does Bascik add any JavaScript to my pages?

No. Bascik is a build-time tool. The output is vanilla HTML, CSS, and exactly the JavaScript you wrote. No runtime script is injected into your pages.

## Do I need to restart the dev server when I add a new component?

No. The dev server watches the components directory. Drop a new `.html` (or paired `.css`) file in and all pages that use that tag are automatically re-transpiled and reloaded. No restart required.

## Can Bascik components be nested?

Yes. Components can use other components inside their markup. Bascik resolves nested components recursively at build time.

## What does Bascik output?

A directory of plain `.html` files (and your assets). No client-side JavaScript framework, no special server required. Any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages, S3, or a plain Nginx server) can serve it.

## How does Bascik handle bad markup or invalid code? Does it crash?

No, Bascik is designed to be highly resilient and hard to crash. Because it uses robust, regular-expression-based scoping and depth-counter checks rather than rigid AST parses, invalid markup or buggy script code will not crash the build or the dev server. Here is how different scenarios are handled:

- **Unclosed Component Tags:** If a component tag is unclosed, for example `<my-component>` with no closing `</my-component>` tag, Bascik safely falls back to treating it as a self-closing tag, compiles it with empty inner content, and proceeds. The VS Code extension also issues a warning so you can fix it easily.
- **Unclosed or Invalid Standard HTML:** Bascik does not use a rigid HTML/XML AST parser for standard elements. If you have unclosed or invalid native HTML tags (such as `<div>` or `<p>`), they are passed directly to the output files untouched. This allows the browser's native parser to handle the layout, ensuring that standard markup errors never crash your build processes.
- **Component Transpilation Failures:** Each component transpilation step is wrapped in a `try-catch` block. If a component fails to compile, Bascik logs a detailed error with line and column numbers to `console.error`, removes the failed component tag, and continues compiling the rest of the page.
- **Build-time & Server-side Scripts (`data-bascik-build` / `data-bascik-server`):** If a script block fails to execute due to syntax errors or runtime exceptions, Bascik replaces the tag with an empty string and logs the detailed error to `console.error` (by default). You can customize this behavior using the `onScriptError` option in `bascik.config.ts` to log a warning instead or halt compile entirely.
- **Client-side / Browser-side JavaScript:** Standard scripts are wrapped in an IIFE for scoping, but they are not parsed or executed during the build. If there is a syntax error or a logical bug in your browser-side JavaScript, it is compiled as-is and sent to the client browser, where the error will be printed in the browser's developer console without affecting your server or build processes.
- **CSS Syntax and File-Read Errors:** If a companion `.css` file or style block contains invalid syntax, Bascik's scoping engines skip the invalid patterns, scope the valid rules, and continue compiling. If a companion `.css` file cannot be read from the disk due to permissions or reference issues, Bascik handles the exception gracefully, logs a warning, and continues compilation.
