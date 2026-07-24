## Slots

### Default Slot

```html
<!-- my-card.html -->
<div class="card">
  <slot-component>Fallback text</slot-component>
</div>
```

```html
<my-card><p>Card content</p></my-card>
```

The `data-bascik-slot` attribute (no value) on any element also marks the default slot, and the element is replaced (not wrapped):

```html
<section><div data-bascik-slot></div></section>
```

### Named Slots

```html
<!-- layout.html -->
<div>
  <header><div data-bascik-slot="header"></div></header>
  <main><div data-bascik-slot></div></main>
</div>
```

```html
<layout>
  <p>Main content</p>
  <div data-bascik-slot="header"><h1>Title</h1></div>
</layout>
```
