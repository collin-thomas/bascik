## Scoped JavaScript

### Scoping Model

`id` and `name` attributes are scoped **per-instance** — each use of a component generates a different `instanceId`, so element IDs are guaranteed unique across the entire page. `class` attributes are scoped to the component **name** only, so all instances share the same class names and CSS deduplication can emit a single `<style>` block no matter how many times the component is used.

```text
class  →  bascik__<componentName>__<originalName>
id     →  bascik__<componentName>__<instanceId>__<originalName>
name   →  bascik__<componentName>__<instanceId>__<originalName>
```

### Multiple Instances

Using a component more than once on the same page works automatically. Each use generates a different `instanceId`, so element IDs never collide and the scripts inside each instance stay independent:

```html
<!-- Two uses of <like-btn> on the same page -->
<like-btn></like-btn>
<like-btn></like-btn>
```

```html
<!-- Compiled — first instance -->
<button id="bascik__like-btn__a1b2__btn">Like</button>
<script>(function() {
  document.getElementById("bascik__like-btn__a1b2__btn")
    .addEventListener("click", …);
})();</script>

<!-- Compiled — second instance -->
<button id="bascik__like-btn__c3d4__btn">Like</button>
<script>(function() {
  document.getElementById("bascik__like-btn__c3d4__btn")
    .addEventListener("click", …);
})();</script>
```

Both buttons are fully independent. The first instance's click handler only fires for the first button, and vice versa.

### IIFE Isolation

Every component script is wrapped in an immediately-invoked function expression (IIFE) to prevent variable leaks between components:

```html
<!-- source -->
<script>
  const count = 0;
  console.log(count);
</script>
```

```html
<!-- compiled -->
<script>
  (function() {
    const count = 0;
    console.log(count);
  })();
</script>
```

### ID Scoping

The `id` attribute value in the HTML and all references to it in scripts are rewritten with the same unique prefix:

```html
<!-- source -->
<button id="my-btn">Click</button>
<script>
  document.getElementById("my-btn")
    .addEventListener("click", () => alert("hi"));
</script>
```

```html
<!-- compiled -->
<button id="bascik__my-btn__a1b2__my-btn">Click</button>
<script>
  (function() {
    document.getElementById("bascik__my-btn__a1b2__my-btn")
      .addEventListener("click", () => alert("hi"));
  })();
</script>
```

### Supported Selectors

All of the following DOM methods are updated when they reference a scoped attribute:

```js
// id attribute
document.getElementById("my-id")
document.querySelector("#my-id")
document.querySelectorAll("#my-id")

// class attribute
document.getElementsByClassName("my-class")
document.querySelector(".my-class")
document.querySelectorAll(".my-class")

// name attribute
document.getElementsByName("my-name")
```

Additional rewritten forms include `element.closest()`, `element.matches()`, `element.classList.add/remove/toggle/contains()`, `element.setAttribute("class", ...)` and `element.setAttribute("id", ...)` with string literal values, and `element.className` setter forms.

### Dynamic Runtime Class Scoping (CRITICAL)

If you have a class or ID name that is **only toggled or added dynamically at runtime** by JavaScript (for example, with `.classList.toggle("is-open")` or `.classList.add("is-active")`) but **does not exist on any HTML tag inside the template at compile time**, Bascik's HTML compiler will not discover or register it.

This causes a compile mismatch:
- The **CSS parser** *will* obfuscate the class name inside your stylesheet.
- The **JS parser** *will not* obfuscate the class name inside your scripts because it was never registered in the HTML pass.
- At runtime, your script will toggle `"is-open"`, but the CSS will be listening for the obfuscated `.bf5a887ac3134` class, causing interactive elements like menus or modals to fail silently.

#### The Solution: Scoping Helpers

Always declare any dynamic classes or IDs inside a hidden scoping helper element inside your HTML template. This forces Bascik's HTML parser to register the names during compilation:

```html
<!-- Scoping helper for dynamic runtime classes -->
<div class="is-open is-active" style="display: none;"></div>
```

### Build-time Scripts

`<script data-bascik-build>` blocks are executed at transpile time as Node.js ESM modules. Whatever the script writes to stdout is injected into the page in place of the tag. Top-level `import` and top-level `await` are supported. Scripts run with the project root as their working directory.

Use this to pull in external data sources — markdown files, JSON, API responses, generated content — and inline the result directly into your HTML at build time.

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import { marked } from 'marked';
  const md = await readFile('./content/posts/intro.md', 'utf8');
  console.log(marked(md));
</script>
```

The entire script tag (including opening and closing tags) is replaced by the stdout output. If the script produces no output, the tag is replaced with an empty string. On error, a warning is logged and the tag is removed.

> **Component tags work too:** Build scripts run before component resolution, so their output can contain Bascik component tags that will be transpiled in the next step.

### Non-JavaScript Script Types

Script tags with a `type` other than `text/javascript` (e.g. `type="application/json"`) are left completely untouched — they are not wrapped in an IIFE and their attributes are not scoped.

```html
<!-- This passes through unchanged -->
<script type="application/json" id="config-data">
  { "theme": "dark" }
</script>
```

> **Tip:** Disable JS scoping entirely with `scopeScriptBlocks: false` in [bascik.config.js](/configuration).
