## Key Constraints for AI Code Generation

1. Component tag names must be hyphenated (e.g. `my-nav`, `site-header`). Single-word tags are not valid custom element names.
2. CSS scoping only applies to paired `.css` files and inline `<style>` tags inside component HTML.
3. CSS `#id {}` hash selectors are converted to component-scoped class selectors; the class is automatically injected onto the matching element. The `[id]` attribute-selector form is stripped.
4. Use `id` and `class` selectors in JS that exactly match the attributes in the component HTML. Bascik rewrites them at build time.
5. For compound DOM queries, query by a single scoped `id` first, then traverse from the returned element.
6. Use `data-` attributes for runtime state that changes via JavaScript (e.g. `data-state="open"`). Scoped class names are assigned at build time and cannot be reliably looked up by JS string manipulation.
7. Props accept text only. For rich HTML content, use slots.
8. `<script type="module">` scripts are not wrapped in an IIFE but their selectors are still rewritten.
9. Component tag text inside `<script>`, `<style>`, or `<textarea>` content (e.g. `<my-card>` in a JSON-LD string or code example) is treated as text and never resolved into a component.
