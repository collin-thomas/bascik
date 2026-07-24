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

### Not Rewritten

- `element.className`, `element.setAttribute("class", ...)`, `element.id`, `element.setAttribute("id", ...)`
- Compound selectors: `querySelector(".foo .bar")`, `querySelector("#id .child")`
- `querySelector("[id='myId']")`
