## Scoped JavaScript

DOM selectors in component scripts are rewritten to match scoped names:

```html
<!-- source -->
<button id="my-btn">Click</button>
<script>
  document
    .getElementById("my-btn")
    .addEventListener("click", () => alert("hi"));
</script>
```

```html
<!-- compiled -->
<button id="bascik__my-btn__a1b2__my-btn">Click</button>
<script>
  (function () {
    document
      .getElementById("bascik__my-btn__a1b2__my-btn")
      .addEventListener("click", () => alert("hi"));
  })();
</script>
```

### Supported DOM Methods (auto-rewritten)

- `document.getElementById("id")`
- `document.querySelector("#id")` / `document.querySelectorAll("#id")`
- `document.querySelector(".cls")` / `document.querySelectorAll(".cls")` — single OR compound selectors
- `document.querySelector(".foo .bar")` / `querySelector("#id .child")` — compound selectors supported
- `document.getElementsByClassName("cls")`
- `document.getElementsByName("name")`
- `element.closest("#id")` / `element.closest(".cls")` — compound-aware
- `element.matches("#id")` / `element.matches(".cls")` — works for event delegation too
- `element.classList.add/remove/toggle/contains("cls")`
- `element.setAttribute("class", "cls")` / `setAttribute("id", "id-value")` — string literal values
- `element.className = "cls"` or `"cls1 cls2"` or `+= " cls"` — setter forms

### Scoping Model

Class attributes use **component-name-only** scope — all instances on the same page share the same scoped class names, which allows CSS deduplication. ID and name attributes include an instance ID for DOM uniqueness.

```
class  →  bascik__<componentName>__<originalName>
id     →  bascik__<componentName>__<instanceId>__<originalName>
name   →  bascik__<componentName>__<instanceId>__<originalName>
```

### Dynamic Runtime Class Scoping (CRITICAL)

If you have a class or ID name that is **only toggled or added dynamically at runtime** by JavaScript (for example, with `.classList.toggle("is-open")` or `.classList.add("is-active")`) but **does not exist on any HTML tag inside the template at compile time**, Bascik's HTML compiler will not discover or register it.

This causes a compile mismatch:
* The **CSS parser** *will* obfuscate the class name inside your stylesheet.
* The **JS parser** *will not* obfuscate the class name inside your scripts because it was never registered in the HTML pass.
* At runtime, your script will toggle `"is-open"`, but the CSS will be listening for the obfuscated `.bf5a887ac3134` class, causing interactive elements like menus or modals to fail silently.

#### The Solution: Scoping Helpers
Always declare any dynamic classes or IDs inside a hidden scoping helper element inside your HTML template. This forces Bascik's HTML parser to register the names during compilation:

```html
<!-- Scoping helper for dynamic runtime classes -->
<div class="is-open is-active" style="display: none;"></div>
```

### Not Rewritten

- `element.className`, `element.setAttribute("class", ...)`, `element.id`, `element.setAttribute("id", ...)`
- Compound selectors: `querySelector(".foo .bar")`, `querySelector("#id .child")`
- `querySelector("[id='myId']")`
