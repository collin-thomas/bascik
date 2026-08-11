# Bascik Scoping Compatibility

**Legend**

- ✓ Supported and tested
- △ Partially supported (see notes)
- ✕ Intentionally unsupported (see notes)
- – Not yet supported

---

## CSS Scoping

CSS scoping applies to `.css` files paired with a component's HTML file. Place the `.css` file in the same directory as the component and give it the same base name.

### Selectors

| Pattern                                            | Example                                 | Status | Notes                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------- | --------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Class selector                                     | `.foo {}`                               | ✓     | Scoped with unique instance prefix                                                                                                                                                                                                                                                        |
| Descendant with class                              | `.foo .bar {}`                          | ✓     | All class names in selector scoped                                                                                                                                                                                                                                                        |
| Multi-class                                        | `.foo.bar {}`                           | ✓     | Both class names scoped                                                                                                                                                                                                                                                                   |
| Standalone element selector                        | `p {}`                                  | ✓     | Converted to a generated class and injected on matching elements in component HTML, including indented selectors inside at-rules such as `@media` and inline `<style>` blocks.                                                                                                             |
| Element pseudo-class                               | `p:hover {}`                            | ✓     | Element converted to class; pseudo-class preserved: `.bascik__...__el__p:hover {}`                                                                                                                                                                                                        |
| Element pseudo-element                             | `p::before {}`                          | ✓     | Element converted to class; pseudo-element preserved: `.bascik__...__el__p::before {}`                                                                                                                                                                                                    |
| `@keyframes` name                                  | `@keyframes spin {}`                    | ✓     | Name scoped; `animation:` and `animation-name:` references updated to match                                                                                                                                                                                                               |
| `@media` query                                     | `@media (max-width: 600px) {}`          | ✓     | Media condition untouched; class names inside scoped normally                                                                                                                                                                                                                             |
| `@supports`                                        | `@supports (display: grid) { .foo {} }` | ✓     | Class names inside `@supports` blocks are scoped normally.                                                                                                                                                                                                                                |
| `@layer`                                           | `@layer base { .foo {} }`               | ✓     | Layer name scoped in all forms: declaration blocks, single-name and comma-list ordering statements.                                                                                                                                                                                       |
| `@container`                                       | `@container sidebar (min-width: …) {}`  | ✓     | Container names declared via `container-name:` or the `container:` shorthand are scoped; `@container name (…)` queries updated to match. Unnamed queries untouched.                                                                                                                       |
| CSS custom properties                              | `--brand: #d3ff8d` / `var(--brand)`     | ✓     | Declarations and all `var()` references in the same file scoped together. `var(--prop, fallback)` is fully supported, the fallback value is preserved and the property name is scoped.                                                                                                   |
| Multiple `animation:` values                       | `animation: a 1s, b 2s`                 | ✓     | Both keyframe name references are scoped when an `animation:` shorthand lists more than one animation.                                                                                                                                                                                    |
| Child / sibling combinators                        | `.a > .b`, `.a + .b`, `.a ~ .b`         | ✓     | All class names on both sides of `>`, `+`, and `~` are scoped.                                                                                                                                                                                                                            |
| `:is()` / `:where()` / `:has()` with class args   | `:is(.foo, .bar) {}`                    | ✓     | Class names inside `:is()`, `:where()`, and `:has()` are scoped normally. Element names inside these functions are **not** converted (see below).                                                                                                                                          |
| Inline `<style>` in component HTML                 | `<style>.foo {}</style>`                | ✓     | Full CSS scoping pipeline applied to inline `<style>` blocks, class names, element selectors, `@keyframes`, `@layer`, `@container`, and custom properties are all scoped.                                                                                                                |
| CSS `#id` selector                                 | `#btn {}`                               | ✓     | Converted to a component-scoped class selector (`.bascik__comp__id__btn {}`) using a context-aware lookahead that correctly distinguishes selector position from hex colour values. The generated class is injected onto the HTML element. Specificity drops from (0,1,0,0) to (0,0,1,0). |
| `[id]` / `[id="…"]` attribute selector             | `[id] {}`                               | ✕     | Stripped at compile time. Attribute-selector forms cannot be scoped without DOM wrapping.                                                                                                                                                                                                 |
| Attribute selector                                 | `[data-foo="bar"] {}`                   | △     | Passed through untouched, not scoped. Will apply globally. Avoid in component CSS or use a class-based selector alongside it.                                                                                                                                                            |
| Compound / descendant element selectors            | `div p {}`, `.card p {}`, `.list > li {}` | △     | `.class element {}` and `.class > element {}` (class followed by descendant/child element) **are now scoped:** the element name is converted to a class and injected onto matching HTML elements. Patterns with two bare element types (`div p {}`, `p + p {}`) still require a class anchor on the left side of the combinator.                                                                                  |
| Comma-separated element selector list              | `h1, h2 {}`                             | ✓     | All elements in a comma list are converted, both multi-line (each at column 0) and same-line (`h1, h2 {}`). A `)` stop in the lookahead prevents false positives inside `:is()`, `:where()`, `:has()`.                                                                                   |
| `:is()` / `:where()` / `:has()` with element names | `:is(p, h2) {}`                         | ✕     | Element names inside these functions are not converted. Class equivalents work fine: `:is(.foo, .bar) {}`. See Design Decisions.                                                                                                                                                          |
| CSS nesting, class selectors                      | `& .child {}`                           | ✓     | Class selectors inside nesting are scoped normally.                                                                                                                                                                                                                                       |
| CSS nesting, element selectors                    | `& p {}`, `& > h2 {}`                   | △     | Element selectors directly after `& ` (with optional single combinator `>`, `+`, `~`) are converted. Complex patterns (`& .parent p {}`, `&p {}`) are not converted.                                                                                                                      |
| `@scope` (native)                                  | `@scope (.foo) { .bar {} }`             | ✓     | Class names in both the `@scope (.selector)` argument and the optional `to (.selector)` clause are scoped normally (handled by the global class-scoping pass). Class names inside the `@scope` block are also scoped. Element names in `@scope` arguments and indented element selectors inside the block follow the same rules as other at-rules. |
| `:nth-child(An+B of .selector)`                    | `:nth-child(2n+1 of .item) {}`          | ✓     | Class names in the `of <selector>` argument are scoped by the global class-scoping pass (the same `(?<=\.)` regex that handles `:is()`, `:where()`, and `:has()` class arguments). Works for `:nth-child` and `:nth-last-child`.                                                          |

### Other CSS Features

| Feature                   | Status | Notes                                                                                                                    |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| CSS deduplication         | ✓     | When a component is used multiple times on a page, its CSS is injected only once.                                        |
| `obfuscateAttributeNames` | ✓     | In production builds, verbose names like `bascik__site-nav__a1b2c3__logo` are hashed to short strings (e.g. `ba1b2c3d`). |
| `minifyStyles`            | ✓     | Whitespace in the compiled `<style>` block is collapsed.                                                                 |
| Comments                  | ✓     | Stripped before processing.                                                                                              |
| SVG elements in component HTML | ✓ | `class` attributes on SVG elements (`<svg>`, `<circle>`, `<path>`, `<rect>`, etc.) are scoped with the same pipeline as HTML elements. JS `classList` and `querySelector` calls targeting SVG children are rewritten. |
| `@font-face`              | △     | Passed through untouched, the `font-family` name is not scoped. Both the declaration and all usage sites remain unmodified, so the font resolves correctly within the page. Declare `@font-face` in a shared global stylesheet rather than a component `.css` file to avoid duplicate declarations when a component is used multiple times. |
| `@import`                 | ✕     | Not followed by the scoping pipeline. The imported CSS file is not processed or scoped. Include CSS directly in the component file instead.                       |
| `@property`               | ✓     | `@property --name { }` declaration names are scoped. Any matching `--name:` element declarations and `var(--name)` references in the same component file are scoped to match. |
| `@starting-style`         | ✓     | Class names and element selectors inside `@starting-style` blocks are scoped by the same passes that handle other at-rules. Both standalone `@starting-style { .foo { } }` and nested `.foo { @starting-style { } }` forms are handled. |
| `@counter-style`          | ✓     | `@counter-style name { }` declaration names are scoped. References in `list-style`, `list-style-type`, `counter(counter, name)`, and `counters(counter, sep, name)` in the same component file are updated to match. |
| `view-transition-name`    | ✓     | `view-transition-name: name` values are scoped to the component. Matching `::view-transition-old(name)`, `::view-transition-new(name)`, `::view-transition-group(name)`, and `::view-transition-image-pair(name)` pseudo-element references in the same file are updated to match. The keywords `none` and `auto` are not scoped. |
| `anchor-name` / `@position-try` | ✓  | `anchor-name: --name` declarations are scoped per component. Matching `position-anchor: --name` references and `@position-try --name { }` at-rules in the same CSS file are updated to match. Only anchors declared in the component's own CSS are scoped, external anchor references are left untouched. |

---

## JavaScript Scoping

Bascik rewrites DOM selector references inside component `<script>` tags to match scoped attribute values. All rewrites happen at build time with no runtime is added.

### IIFE Isolation

| Pattern                                                  | Status | Notes                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<script>` (no type)                                     | ✓     | Wrapped in an IIFE to prevent variable leakage between components.                                                                                                                                                                                          |
| `<script type="text/javascript">`                        | ✓     | Wrapped in an IIFE.                                                                                                                                                                                                                                         |
| `<script type="module">`                                 | ✓     | Not wrapped in an IIFE (modules are already isolated by spec). DOM selector references still rewritten.                                                                                                                                                     |
| `<script type="application/json">` (and any non-JS type) | ✓     | Left completely untouched.                                                                                                                                                                                                                                  |
| `<script data-bascik-build>`                             | ✓     | Executed at **transpile time** as a Node.js ESM module. The script's stdout is injected in place of the tag. Runs in both dev and build modes. Use `console.log()` / `process.stdout.write()` to output HTML. Top-level `import` and `await` are supported. |

### DOM Selector Rewriting

| Method                                        | Example                              | Attribute Scoped | Status | Notes                                                                                                                                                                           |
| --------------------------------------------- | ------------------------------------ | ---------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `document.getElementById`                     | `getElementById("my-id")`            | `id`             | ✓     |                                                                                                                                                                                 |
| `document.querySelector` with `#id`           | `querySelector("#my-id")`            | `id`             | ✓     |                                                                                                                                                                                 |
| `document.querySelectorAll` with `#id`        | `querySelectorAll("#my-id")`         | `id`             | ✓     |                                                                                                                                                                                 |
| `document.getElementsByClassName`             | `getElementsByClassName("my-cls")`   | `class`          | ✓     |                                                                                                                                                                                 |
| `document.querySelector` with `.class`        | `querySelector(".my-cls")`           | `class`          | ✓     | Single-token class selector only.                                                                                                                                               |
| `document.querySelectorAll` with `.class`     | `querySelectorAll(".my-cls")`        | `class`          | ✓     | Single-token class selector only.                                                                                                                                               |
| `document.getElementsByName`                  | `getElementsByName("my-name")`       | `name`           | ✓     |                                                                                                                                                                                 |
| `element.closest` with `#id`                  | `el.closest("#my-id")`               | `id`             | ✓     |                                                                                                                                                                                 |
| `element.closest` with `.class`               | `el.closest(".my-cls")`              | `class`          | ✓     | Single-token class selector only.                                                                                                                                               |
| `element.matches` with `#id`                  | `el.matches("#my-id")`               | `id`             | ✓     |                                                                                                                                                                                 |
| `element.matches` with `.class`               | `el.matches(".my-cls")`              | `class`          | ✓     | Single-token class selector only. Works for event delegation: `e.target.matches(".my-cls")`.                                                                                    |
| `element.classList.add`                       | `el.classList.add("my-cls")`         | `class`          | ✓     | Single and multi-argument forms: `classList.add("a", "b")` rewrites all class names.       |
| `element.classList.remove`                    | `el.classList.remove("my-cls")`      | `class`          | ✓     | Single and multi-argument forms.                                                              |
| `element.classList.toggle`                    | `el.classList.toggle("my-cls")`      | `class`          | ✓     | The optional boolean second argument is passed through unchanged.                             |
| `element.classList.contains`                  | `el.classList.contains("my-cls")`    | `class`          | ✓     |                                                                                                |
| `element.classList.replace`                   | `el.classList.replace("old", "new")` | `class`          | ✓     | Both the old-token and new-token arguments are rewritten if they match a scoped class name.  |
| Compound `querySelector` / `querySelectorAll` | `querySelector(".foo .bar")`         | `class` / `id`   | ✓     | Space-separated and combinator-separated (`>`, `+`, `~`) tokens are each rewritten. Adjacent-class compound `.foo.bar` only rewrites the leading token.                         |
| `element.className` setter                    | `el.className = "my-cls"`            | `class`          | ✓     | Single-class and space-separated multi-class assignments (`= "…"` and `+= "…"`) are rewritten. Template literals (e.g. `` `box ${state}` ``) are **not** rewritten, see limitations below. Reading `el.className` is unchanged. |
| `element.setAttribute("class", …)`            | `el.setAttribute("class", "my-cls")` | `class`          | ✓     | String literal values are rewritten.                                                                                                                                            |
| `element.setAttribute("id", …)`               | `el.setAttribute("id", "my-id")`     | `id`             | ✓     | String literal values are rewritten.                                                                                                                                            |
| `element.setAttribute("name", …)`             | `el.setAttribute("name", "my-name")` | `name`           | ✓     | String literal values for known `name` attributes are rewritten to the per-instance scoped name.                                                                                |
| `innerHTML` / `insertAdjacentHTML` strings    | `el.innerHTML = '<div class="box">'` | `class`          | ✓     | Known class names in HTML string literals are rewritten. Only class names that appear as static `class="…"` attributes in the component template are eligible.                  |
| `element.removeAttribute`                     | `el.removeAttribute("class")`        |                  | ✕     | Attribute names (not values) are passed with no rewriting needed or applied.                                                                                                       |
| `element.hasAttribute`                        | `el.hasAttribute("id")`              |                  | ✕     | Same as `removeAttribute`: attribute name, not value.                                                                                                                          |
| `element.toggleAttribute`                     | `el.toggleAttribute("hidden")`       |                  | ✕     | Boolean attribute name only with no value to rewrite.                                                                                                                              |
| `element.style.setProperty` for CSS vars      | `el.style.setProperty("--accent", v)` |                  | ✕     | Runtime CSS custom property names are not rewritten. The statically-declared name in the `.css` file is scoped (e.g. `--bascik__comp__accent`), but a runtime `setProperty("--accent", …)` call uses the original name and will not match the scoped declaration. Use the element's computed style or pass the scoped name explicitly as a prop. |
| Template literal in `className` / selectors   | `` el.className = `box ${state}` ``  |                  | ✕     | Template literals containing runtime expressions are not rewritten, bascik cannot safely scope dynamic string interpolation at build time. Use `classList.add`/`remove` instead. |
| `element.id` setter                           | `el.id = "my-id"`                    | `id`             | ✕     | Not rewritten, `.id =` also matches `el.dataset.id =` and other object properties named `id`. Use `getElementById` to retrieve elements and operate on the returned reference. |
| `querySelector` attribute selector            | `querySelector("[id='my-id']")` | `id`             | ✕     | Use `getElementById` instead.                                                                                                                                                   |

### Notes on Gaps

The unsupported JS patterns above all involve **dynamic attribute manipulation** where static analysis cannot safely identify which component's attribute is being referenced from a string literal.

The recommended pattern is to query scoped elements by a single `id` or single-class selector first, store the reference, then use the reference for all further DOM operations:

```html
<!-- source — works correctly -->
<div id="panel" class="card"></div>
<script>
  const panel = document.getElementById("panel"); // ← rewritten by Bascik
  panel.style.display = "none"; // ← operate on the reference
  panel.dataset.state = "closed"; // ← data attributes for state
</script>
```

### Class queries are document-wide (not per-instance)

Class names are scoped to the **component type**, not to individual instances. This means `querySelectorAll(".my-class")` inside a component script, which Bascik rewrites to `querySelectorAll(".bascik__comp__my-class")`: will find matching elements across **all instances** of that component on the page, not just the current instance.

To operate only on the current instance's elements, query by **id** (which includes a per-instance hash) and traverse from the returned element:

```javascript
// In component — gets only THIS instance's panel:
const panel = document.getElementById("panel"); // rewritten with instance hash
```

### FormData with scoped `name` attributes

When a component uses `<input name="username">`, Bascik scopes the `name` attribute to a per-instance value like `bascik__comp__a1b2c3__username`. As a result, `new FormData(form)` entries use the **scoped** name as the key. If your server-side code expects the unscoped field name, you will need to adapt it, or extract values using `formData.get` with the scoped name, or via `form.elements` iteration.

---

## Design Decisions & Known Non-Starters

Things that looked implementable but were deliberately left out, and why. Record these so we don't revisit the same dead ends.

### CSS `#id {}` selector: first attempt rejected, now implemented

**First attempt (failed):** Used a simple lookahead `/#([a-zA-Z][a-zA-Z0-9-_]*)(?=[\s{:,])/g`. This incorrectly matched hex colour values in property position:

```css
background: linear-gradient(#abc, #def)   /* ← comma triggered the match */
background: #abc url('./img.png')         /* ← space triggered the match */
color: #abc\n                             /* ← newline triggered the match */
```

**Second attempt (current implementation, ✓):** Changed to a context-aware lookahead:

```
/#([a-zA-Z][a-zA-Z0-9-_]*)(?=[^{};]*\{)/g
```

The key insight: in **selector position** the next `{` always appears before any `;` or `}`. In **value position** (property declarations, gradient functions, etc.) a `;` or `}` always appears before the next `{`. This reliably distinguishes the two contexts:

```css
#btn { }                          → matches  (selector: { before ;/})
.parent #btn { }                  → matches  (compound selector)
@media (...) { #btn { } }         → matches  (nested selector)
color: #abc;                      → skipped  (value: ; before {)
linear-gradient(#abc, #def)        → skipped  (value: } closes rule before next {)
color: #abc\n}                    → skipped  (} terminates before {)
```

**Remaining known edge case:** A bare property declaration at the CSS file's top level (which is itself invalid CSS) could theoretically yield a false positive. This cannot occur in valid component CSS.

**Implementation:** `convertCssIdSelectorsToClasses` in `styles.ts`. The hash `#id {}` is converted to `.bascik__comp__id__id {}` and the generated class is injected onto the HTML element. Specificity drops from (0,1,0,0) to (0,0,1,0), which is acceptable and consistent with how element selectors are handled.

### CSS comma-separated element selectors: now implemented

Same context-aware lookahead technique used for `#id` conversion. Adding `)` to the lookahead stop set (`[^{};)]*\{`) prevents false positives inside `:is()`, `:where()`, `:has()` pseudo-functions, because the closing `)` terminates the lookahead before `{` is reached:

```
div:is(p, h2) { }    →  h2 is after , but ) stops lookahead before { → skipped ✓
h1, h2 { }           →  h2 is after , ; then { before ;/}/} → MATCHES ✓
transition: color 0.2s, opacity 0.3s;  →  ; before { → skipped ✓
```

**Pass 2 regex:** `/(?<=,[ \t]*)[a-z1-6]+(?=[^{};)]*\{)/g`

### Compound / descendant element selectors: partially implemented

**Previously:** `.card p {}` was ✕, `p` after a class was not converted, so the rule applied globally.

**Now:** A new Pass 4 in `convertCssElementSelectorsToClasses` handles element selectors that follow a **scoped class name** (with optional combinator):

```css
/* Source: */
.card p { color: blue; }
.list > li { padding: 0; }
.article > h2 { font-size: 1.2rem; }

/* After bascik: */
.bascik__card .bascik__card__el__p { color: blue; }
.bascik__list > .bascik__list__el__li { padding: 0; }
.bascik__article > .bascik__article__el__h2 { font-size: 1.2rem; }
```

This works because the class-scoping pass runs first, writing the `bascik__` prefix, which Pass 4 uses as a safe anchor. The `bascik__` prefix never appears in CSS property value position.

**Still not handled:** bare element–element combinators (`div p {}`, `p + p {}`) with no class anchor on the left side. These still need a class to anchor against.

### CSS nesting element selectors: partially implemented

**Approach:** The `&` character is exclusively a CSS nesting selector and never appears in property value position. This makes `& ` (ampersand + whitespace) a safe anchor:

```
/(?<=&\s+(?:[>+~]\s+)?)[a-z1-6]+(?=[^{};)]*\{)/g
```

Handles: `& p {}`, `& > h2 {}`, `& + li {}`, `& ~ span {}`.

**Not handled:** `& .parent p {}` (element after class in nesting), `&p {}` (element directly appended to `&`). These require the combinator/whitespace anchor to precede the element.

### CSS `element.id` property setter: not implemented

**What was considered:** Rewriting `el.id = "my-id"` to use the scoped ID name.

**Why it was not implemented:** The pattern `\.id\s*=\s*["']` matches any property chain ending in `.id`, including `el.dataset.id = "foo"` (which sets a `data-id` attribute, not the DOM `id`). There is no reliable way to distinguish these cases with a regex.

**The correct workaround:** Use `getElementById("my-id")` to retrieve the element reference first, then work with the reference. Bascik rewrites `getElementById` correctly. Avoid assigning `el.id` from a scoped ID value in component scripts.

---

## What "Scoped" Means

Class attributes are scoped to the **component type** (name only). All instances of the same component on a page share the same scoped class names, which allows CSS to be deduplicated to a single `<style>` block.

ID and name attributes are scoped per **component instance** (name + unique instance ID) so that multiple instances on the same page have distinct DOM identifiers.

```
class  →  bascik__<componentName>__<originalName>
id     →  bascik__<componentName>__<instanceId>__<originalName>
name   →  bascik__<componentName>__<instanceId>__<originalName>
```

With `obfuscateAttributeNames: true` (the default in production builds), these verbose names are hashed to short hex strings (e.g. `ba1b2c3d`). The HTML, CSS, and JavaScript are all updated with the same scoped names so they stay in sync.

This is a **build-time transformation:** no JavaScript is loaded at runtime to manage scoping. The output is plain HTML.
