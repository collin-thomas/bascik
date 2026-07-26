## Props

### Defining Props in a Template

Add a `data-bascik-prop-{name}` attribute (no value) to any element in the component template. The element's inner content will be replaced with the prop value at build time.

```html
<!-- alert-box.html -->
<div class="alert">
  <strong data-bascik-prop-title></strong>
  <p data-bascik-prop-message></p>
</div>
```

### Passing Props at Usage

Set `data-bascik-prop-{name}="value"` on the component tag. The value is injected into the matching template element.

```html
<!-- src/pages/index.html -->
<alert-box
  data-bascik-prop-title="Success"
  data-bascik-prop-message="Your changes have been saved.">
</alert-box>
```

Output:

```html
<div class="alert">
  <strong>Success</strong>
  <p>Your changes have been saved.</p>
</div>
```

### Props with Existing Attributes

Other attributes on the target element are preserved. The prop marker attribute itself is removed from the output.

```html
<!-- template -->
<p class="lead" data-bascik-prop-body></p>

<!-- compiled -->
<p class="bascik__comp__x1__lead">Your prop value here.</p>
```

### Naming Conventions

Prop names use the portion of the attribute after `data-bascik-prop-`. You can use any lowercase alphanumeric name with hyphens:

```html
data-bascik-prop-title
data-bascik-prop-href
data-bascik-prop-alt-text
data-bascik-prop-icon-url
```

> **Use slots for HTML content.** Props inject plain text values. If you need to inject rich HTML (tags, nested elements), use [slots](/slots) instead.

### Example: Feature Card

A good real-world use of props is a card component with a configurable label, title, and description:

```html
<!-- src/components/feature-card.html -->
<div class="card">
  <span class="card-label" data-bascik-prop-label></span>
  <h3 data-bascik-prop-title></h3>
  <p data-bascik-prop-desc></p>
</div>
```

```html
<feature-card
  data-bascik-prop-label="New"
  data-bascik-prop-title="Live Reload"
  data-bascik-prop-desc="Automatic browser reload on every change.">
</feature-card>
```

### Live Demo

The interactive props demo passes values directly to the `feature-card` component via `data-bascik-prop-*` attributes.

**Usage (the code you write):**

<!-- demo:code -->
```html
<feature-card
  data-bascik-prop-label="Interactive"
  data-bascik-prop-title="Component Props"
  data-bascik-prop-desc="These values are injected into the component template at build time.">
</feature-card>
```

**Compiled output** (prop placeholders replaced, component HTML inlined):

<!-- demo:output -->
```html
<div class="bascik__feature-card__fcard">
  <p class="bascik__feature-card__fcard-label">Interactive</p>
  <h3 class="bascik__feature-card__fcard-title">Component Props</h3>
  <p class="bascik__feature-card__fcard-desc">
    These values are injected into the component template at build time.
  </p>
</div>
```
