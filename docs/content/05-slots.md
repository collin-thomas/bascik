## Slots

### Default Slot

Add `data-bascik-slot` (no value) to any element in your component template to mark where inner content should be inserted. The element itself is replaced by the slot content.

```html
<!-- my-card.html -->
<div class="card">
  <div data-bascik-slot></div>
</div>
```

Usage:

```html
<my-card>
  <h2>Card Title</h2>
  <p>Card body text.</p>
</my-card>
```

Output:

```html
<div class="card">
  <h2>Card Title</h2>
  <p>Card body text.</p>
</div>
```

### Slot Fallback Content

Place default content inside the slot marker. It renders when the usage site passes no inner content.

```html
<!-- my-card.html -->
<div class="card">
  <div data-bascik-slot><p>No content provided.</p></div>
</div>
```

```html
<!-- No inner content — fallback renders -->
<my-card></my-card>

<!-- Inner content provided — overrides fallback -->
<my-card><p>Custom content.</p></my-card>
```

### Named Slots

Use `data-bascik-slot="name"` in the component template to define named slot zones. At the usage site, wrap content for each zone with the same attribute.

In the component template:

```html
<!-- page-layout.html -->
<div class="layout">
  <header>
    <div data-bascik-slot="header"></div>
  </header>
  <main>
    <div data-bascik-slot></div>
  </main>
  <aside>
    <div data-bascik-slot="sidebar"></div>
  </aside>
</div>
```

At the usage site:

```html
<!-- index.html -->
<page-layout>
  <!-- default slot content -->
  <p>Main body content.</p>

  <!-- named slot: header -->
  <div data-bascik-slot="header">
    <h1>Page Title</h1>
  </div>

  <!-- named slot: sidebar -->
  <div data-bascik-slot="sidebar">
    <nav>Sidebar nav</nav>
  </div>
</page-layout>
```

> **How it works:** Named slot wrappers in the usage inner HTML are extracted by name and injected into the matching `data-bascik-slot="name"` placeholder in the template. Everything left over goes into the default slot.

### Live Demo

The interactive slot demo passes a button into the `feature-card` component's default slot.

**Usage (the code you write):**

<!-- demo:code -->
```html
<feature-card
  data-bascik-prop-label="Example"
  data-bascik-prop-title="Named Slots"
  data-bascik-prop-desc="...">
  <!-- content for default slot -->
  <div style="padding-top:12px;...">
    <button class="btn btn-primary">Read More</button>
  </div>
</feature-card>
```

**Compiled output** (slot content injected into the `fcard-slot` div):

<!-- demo:output -->
```html
<div class="bascik__feature-card__fcard">
  <p class="bascik__feature-card__fcard-label">Example</p>
  <h3 class="bascik__feature-card__fcard-title">Named Slots</h3>
  <p class="bascik__feature-card__fcard-desc">...</p>
  <div class="bascik__feature-card__fcard-slot">
    <div style="...">
      <button class="...">Read More</button>
    </div>
  </div>
</div>
```
