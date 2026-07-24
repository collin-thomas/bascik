## Attribute Inheritance

Non-`data-bascik-*` attributes on a usage tag are merged onto the component's root element. `id` is excluded.

```html
<site-nav class="sticky" aria-label="main navigation"></site-nav>
<!-- class "sticky" and aria-label are merged onto <nav> in site-nav.html -->
```
