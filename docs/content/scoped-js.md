# Scoped JavaScript

Write `<script>` tags directly in your component HTML. Bascik automatically rewrites selector strings to match each instance's unique identifiers. Multiple instances of the same component on the same page stay completely independent.

> **Key rule.** Use `id` attributes to identify elements you need to control in JS, and `getElementById` to find them. Bascik scopes each instance's `id` values uniquely, so every call returns exactly the right element.

## Writing Component Scripts

A component script looks like ordinary JavaScript. Declare `id` on any element you need to reference, then use `getElementById`. Bascik rewrites the strings at build time:

```html
<span id="status">Ready</span>
<button id="toggle-btn">Toggle</button>

<script>
  const status = document.getElementById('status');
  const btn    = document.getElementById('toggle-btn');
  let on = false;

  btn.addEventListener('click', () => {
    on = !on;
    status.textContent = on ? 'On' : 'Off';
    status.style.color = on ? 'var(--accent)' : '';
  });
</script>
```

You don't write or deal with the generated names. Bascik handles the rewriting at build time and each use of the component gets its own independent copy.

## Multiple Instances

Place the same component on a page more than once and each instance runs independently with no extra work needed:

```html
<my-toggle></my-toggle>
<my-toggle></my-toggle>
```

Bascik gives each instance a unique ID prefix so the two script copies never interfere with each other.

<!-- compiled-output -->
```html
<!-- first instance -->
<span id="bascik__my-toggle__a1b2__status">Ready</span>
<button id="bascik__my-toggle__a1b2__toggle-btn">Toggle</button>
<script>(function() {
  const status = document.getElementById("bascik__my-toggle__a1b2__status");
  const btn    = document.getElementById("bascik__my-toggle__a1b2__toggle-btn");
  let on = false;
  btn.addEventListener("click", () => { ... });
})();</script>

<!-- second instance — different instanceId, fully independent -->
<span id="bascik__my-toggle__c3d4__status">Ready</span>
<button id="bascik__my-toggle__c3d4__toggle-btn">Toggle</button>
<script>(function() {
  const status = document.getElementById("bascik__my-toggle__c3d4__status");
  const btn    = document.getElementById("bascik__my-toggle__c3d4__toggle-btn");
  let on = false;
  btn.addEventListener("click", () => { ... });
})();</script>
```

## Pitfall: Class-Based DOM Lookups

Because class names are shared across all instances of the same component (for CSS deduplication), `document.querySelector('.my-class')` always returns the **first** matching element in the document. When the same component appears more than once, every instance's script ends up targeting the first instance's elements.

**Use `id` + `getElementById` instead:**

```html
<!-- ❌ Broken for multiple instances — querySelector returns first instance's button -->
<button class="my-btn">Click</button>
<script>
  document.querySelector('.my-btn').addEventListener('click', () => { … });
</script>
```

```html
<!-- ✅ Correct — id is scoped per instance -->
<button id="my-btn" class="my-btn">Click</button>
<script>
  document.getElementById('my-btn').addEventListener('click', () => { … });
</script>
```

The `class` attribute can still coexist on the same element for styling, just add an `id` for the JS lookup.

> **Rule of thumb.** Use `getElementById` (or `getElementsByName`) for elements you need to control per-instance. Reserve `querySelector`/`querySelectorAll` for cases where you intentionally want to sweep across all instances.

## Dynamic Runtime Classes

If a class is only toggled at runtime (`classList.toggle("is-open")`) but doesn't appear on any element in the template HTML, Bascik's compiler won't register it. The CSS side obfuscates the name but the JS side doesn't, causing a silent mismatch at runtime.

**Fix: declare the class on a hidden element in the template so the compiler sees it:**

```html
<!-- scoping helper — keeps runtime classes registered at compile time -->
<div class="is-open is-active" style="display:none"></div>
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

<!-- compiled-output -->
```html
<!-- source -->
<button id="my-btn">Click</button>
<script>
  document.getElementById('my-btn').addEventListener('click', () => alert('hi'));
</script>

<!-- compiled -->
<button id="bascik__my-comp__a1b2__my-btn">Click</button>
<script>
(function() {
  document.getElementById("bascik__my-comp__a1b2__my-btn")
    .addEventListener("click", () => alert("hi"));
})();
</script>
```

The scoping format:
- `class` → `bascik__<componentName>__<originalName>` (shared across all instances)
- `id` / `name` → `bascik__<componentName>__<instanceId>__<originalName>` (unique per instance)

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
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 24px 20px;
  transition: border-color .2s;
}
.ctr:hover { border-color: var(--border-hover); }
.ctr-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .1em;
  color: var(--text-muted);
}
.ctr-count {
  font-family: var(--mono);
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
}
.ctr-dec, .ctr-inc {
  width: 40px; height: 40px;
  border-radius: var(--r-sm);
  font-size: 1.1rem;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
.ctr-inc {
  background: var(--accent-dim);
  border-color: rgba(211,255,141,0.3);
  color: var(--accent);
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
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 24px 20px;
  transition: border-color .2s;
}
.bascik__demo-counter__ctr-count {
  font-family: var(--mono);
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--accent);
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
