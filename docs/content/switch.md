# Switch to Bascik

Moving an existing site to Bascik is mostly a mechanical transformation: extract repeated markup into component files, replace runtime framework logic with build-time equivalents, and let Bascik handle scoping. LLMs can do most of this automatically given the right context.

## How to Switch

The process is the same regardless of source framework:

1. **Identify components:** find repeated markup patterns (navigation, footer, cards, buttons).
2. **Extract to component files:** create a `.html` file per component in `src/components/`.
3. **Replace framework slots with Bascik slots:** `children` in React, `<slot>` in Vue/Svelte → `data-bascik-slot`.
4. **Replace framework props with Bascik props:** text-only values → `data-bascik-prop-*`; rich HTML content → named slots.
5. **Move component CSS to paired `.css` files:** CSS Modules, styled-components, Tailwind → plain CSS in `component-name.css`.
6. **Replace client-side routing with static pages:** one `.html` file per route in `src/pages/`.
7. **Keep genuinely interactive JS:** event listeners, fetch calls, animations stay as plain `<script>` tags. Remove React-specific hooks and state management.

> **Using AI to switch:** Give the LLM the source files plus the `llms.txt` at the root of this repo. The file contains a complete reference of Bascik's component format, scoping rules, and constraints, enough for most LLMs to perform the transformation without needing to look up anything else.

## What Maps to What

| Framework Concept | Bascik Equivalent |
| --- | --- |
| JSX component file | `.html` component file |
| `children` prop / default slot | `data-bascik-slot` |
| Named slots | `data-bascik-slot="name"` |
| String/number props | `data-bascik-prop-name="value"` |
| CSS Modules / scoped CSS | Paired `.css` file (auto-scoped) |
| Client-side routing / pages | One `.html` file per route in `src/pages/` |
| Static props / getStaticProps | Inline content in the page HTML |
| Conditional rendering | No direct equivalent, choose the correct HTML at build time or toggle visibility with CSS/JS at runtime |
| Component state / hooks | Vanilla JS in a `<script>` tag (auto-scoped per instance) |
| Data fetching at build time | Not built-in, pre-generate the HTML in a build script and include it in the page |

> Choose where you are coming from: [React](/switch/from-react) · [Next.js](/switch/from-next) · [Eleventy](/switch/from-eleventy) · [Astro](/switch/from-astro) · [Hugo](/switch/from-hugo)
