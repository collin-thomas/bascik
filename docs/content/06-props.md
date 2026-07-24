## Props

Inject text values into a component at usage time.

```html
<!-- alert-box.html -->
<div class="alert">
  <strong data-bascik-prop-title></strong>
  <p data-bascik-prop-message></p>
</div>
```

```html
<alert-box
  data-bascik-prop-title="Success"
  data-bascik-prop-message="Your changes were saved."
></alert-box>
```
