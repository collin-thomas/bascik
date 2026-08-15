# Scoped JavaScript

Write `<script>` tags directly in your component HTML. Bascik automatically rewrites selector strings to match each instance's unique identifiers. Multiple instances of the same component on the same page stay completely independent.

## See it in action

These two counters are independent. Change either count and the other stays put.

## Writing Component Scripts

> **Key rule.** Use `id` attributes to identify elements you need to control in JS, and `getElementById` to find them. Bascik scopes each instance's `id` values uniquely, so every call returns exactly the right element.

A component script looks like ordinary JavaScript. Declare `id` on any element you need to reference, then use `getElementById`. Bascik rewrites the strings at build time:

Open Source → JS in the counter demo to see ordinary event listeners and `getElementById` calls. Output → JS shows the rewritten selectors and instance wrapper that Bascik generates.

## Multiple Instances

Place the same component on a page more than once and each instance runs independently with no extra work needed:

The two counters at the top of this page are the same component. Change either count, then inspect Output → HTML and Output → JS to compare their unique instance IDs.

## Pitfall: Class-Based DOM Lookups

Because class names are shared across all instances of the same component (for CSS deduplication), `document.querySelector('.my-class')` always returns the **first** matching element in the document. When the same component appears more than once, every instance's script ends up targeting the first instance's elements.

**Use `id` + `getElementById` instead:**

```html
<!-- ❌ Broken for multiple instances - querySelector returns first instance's button -->
<button class="my-btn">Click</button>
<script>
  document.querySelector('.my-btn').addEventListener('click', () => { … });
</script>
```

```html
<!-- ✅ Correct - id is scoped per instance -->
<button id="my-btn" class="my-btn">Click</button>
<script>
  document.getElementById('my-btn').addEventListener('click', () => { … });
</script>
```

The `class` attribute can still coexist on the same element for styling, just add an `id` for the JS lookup.

> **Rule of thumb.** Use `getElementById` (or `getElementsByName`) for elements you need to control per-instance. Reserve `querySelector`/`querySelectorAll` for cases where you intentionally want to sweep across all instances.

## Dynamic Runtime Classes

If a class is only toggled at runtime (`classList.toggle("is-open")`) but doesn't appear on any element in the template HTML, Bascik's compiler won't register it. The CSS side obfuscates the name but the JS side doesn't, causing a silent mismatch at runtime.

The toggle below registers `is-open` on a hidden element, then safely applies that scoped class at runtime.

<!-- demo:runtime-class-usage -->
```html
<state-toggle></state-toggle>
```

<!-- demo:runtime-class-html -->
```html
<section class="state-toggle">
  <div class="is-open" hidden></div>
  <p id="status">Panel closed</p>
  <button id="toggle" type="button">Toggle panel</button>
  <div class="state-toggle-panel" id="panel">Only this component instance changes.</div>
</section>
```

<!-- demo:runtime-class-css -->
```css
.state-toggle-panel { opacity: 0.55; }
.state-toggle-panel.is-open {
  border-color: #d3ff8d;
  opacity: 1;
}
```

<!-- demo:runtime-class-js -->
```js
const status = document.getElementById('status');
const toggle = document.getElementById('toggle');
const panel = document.getElementById('panel');

toggle.addEventListener('click', () => {
  const isOpen = panel.classList.toggle('is-open');
  status.textContent = isOpen ? 'Panel open' : 'Panel closed';
});
```

<!-- demo:runtime-class-output-html -->
```html
<section class="bascik__state-toggle__state-toggle">
  <div class="bascik__state-toggle__is-open" hidden></div>
  <p id="bascik__state-toggle__a1b2__status">Panel closed</p>
  <button id="bascik__state-toggle__a1b2__toggle" type="button">Toggle panel</button>
  <div class="bascik__state-toggle__state-toggle-panel"
       id="bascik__state-toggle__a1b2__panel">Only this component instance changes.</div>
</section>
```

<!-- demo:runtime-class-output-js -->
```js
const status = document.getElementById('bascik__state-toggle__a1b2__status');
const toggle = document.getElementById('bascik__state-toggle__a1b2__toggle');
const panel = document.getElementById('bascik__state-toggle__a1b2__panel');

toggle.addEventListener('click', () => {
  const isOpen = panel.classList.toggle('bascik__state-toggle__is-open');
  status.textContent = isOpen ? 'Panel open' : 'Panel closed';
});
```

## Supported Selectors

All of the following DOM methods are rewritten when they reference a scoped attribute:

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

Additional rewritten forms include `element.closest()`, `element.matches()`, `element.classList.add/remove/toggle/contains()`, `element.setAttribute("class", …)` and `element.setAttribute("id", …)` with string literal values, and `element.className` setter forms.

## Build-time Scripts

`<script data-bascik-build>` blocks run at transpile time as Node.js ESM modules. Their stdout replaces the tag in the page, useful for pulling in Markdown, JSON, or other external content at build time:

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import { marked } from 'marked';
  const md = await readFile('./content/posts/intro.md', 'utf8');
  console.log(marked(md));
</script>
```

> **Component tags work too.** Build script output is processed in the component resolution step, so its output can contain Bascik component tags.

## Non-JavaScript Script Types

Script tags with a `type` other than `text/javascript` are left completely untouched, no IIFE, no scoping:

```html
<script type="application/json" id="config-data">
  { "theme": "dark" }
</script>
```

> **Tip:** Disable JS scoping entirely with `scopeScriptBlocks: false` in [bascik.config.js](/configuration).

## How Scoping Works

Every component `<script>` is wrapped in an IIFE to prevent variable leaks, and every selector string that references a scoped attribute is rewritten to match:

The counter demo's Output tabs show the complete compiled HTML, CSS, and JavaScript together. The runtime-class demo adds a focused view of `classList.toggle()` rewriting.

The scoping format:

- `class` → `bascik__<componentName>__<originalName>` (shared across all instances)
- `id` / `name` → `bascik__<componentName>__<instanceId>__<originalName>` (unique per instance)

> **Under the hood.** Read the [Scoping System internals](/internals/scoping-system) for the compiler passes, attribute maps, selector rewriting, and CSS deduplication that produce this output.

<!-- demo:source-usage -->
```html
<demo-counter data-bascik-prop-label="Counter A"></demo-counter>
<demo-counter data-bascik-prop-label="Counter B"></demo-counter>
```

<!-- demo:source-html -->
```html
<div class="ctr">
  <span class="ctr-label" data-bascik-prop-label>Counter</span>
  <span class="ctr-count" id="count">0</span>
  <div class="ctr-btns">
    <button class="ctr-dec" id="dec">−</button>
    <button class="ctr-inc" id="inc">+</button>
  </div>
</div>
```

<!-- demo:source-css -->
```css
.ctr {
  background: #242628;
  border: 1px solid #3a3d40;
  border-radius: 10px;
  padding: 24px 20px;
  transition: border-color .2s;
}
.ctr:hover { border-color: rgba(211,255,141,0.35); }
.ctr-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .1em;
  color: #8d929e;
}
.ctr-count {
  font-family: monospace;
  font-size: 2.4rem;
  font-weight: 700;
  color: #d3ff8d;
  line-height: 1;
}
.ctr-dec, .ctr-inc {
  width: 40px; height: 40px;
  border-radius: 6px;
  font-size: 1.1rem;
  cursor: pointer;
  border: 1px solid #3a3d40;
  background: #1e2022;
  color: #f0f1f2;
}
.ctr-inc {
  background: rgba(211,255,141,0.12);
  border-color: rgba(211,255,141,0.3);
  color: #d3ff8d;
  font-weight: 700;
}
```

<!-- demo:source-js -->
```js
const count = document.getElementById('count');
const dec   = document.getElementById('dec');
const inc   = document.getElementById('inc');
let n = 0;
dec.addEventListener('click', () => { n--; count.textContent = n; });
inc.addEventListener('click', () => { n++; count.textContent = n; });
```

<!-- demo:output-html -->
```html
<div class="bascik__demo-counter__ctr">
  <span class="bascik__demo-counter__ctr-label">Counter A</span>
  <span class="bascik__demo-counter__ctr-count"
        id="bascik__demo-counter__a1b2__count">0</span>
  <div class="bascik__demo-counter__ctr-btns">
    <button class="bascik__demo-counter__ctr-dec"
            id="bascik__demo-counter__a1b2__dec">−</button>
    <button class="bascik__demo-counter__ctr-inc"
            id="bascik__demo-counter__a1b2__inc">+</button>
  </div>
</div>
```

<!-- demo:output-css -->
```css
.bascik__demo-counter__ctr {
  background: #242628;
  border: 1px solid #3a3d40;
  border-radius: 10px;
  padding: 24px 20px;
  transition: border-color .2s;
}
.bascik__demo-counter__ctr-count {
  font-family: monospace;
  font-size: 2.4rem;
  font-weight: 700;
  color: #d3ff8d;
}
/* class names are shared across all instances of demo-counter */
```

<!-- demo:output-js -->
```js
(function() {
  const count = document.getElementById("bascik__demo-counter__a1b2__count");
  const dec   = document.getElementById("bascik__demo-counter__a1b2__dec");
  const inc   = document.getElementById("bascik__demo-counter__a1b2__inc");
  let n = 0;
  dec.addEventListener("click", () => { n--; count.textContent = n; });
  inc.addEventListener("click", () => { n++; count.textContent = n; });
})();
```
