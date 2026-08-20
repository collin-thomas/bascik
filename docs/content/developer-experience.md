# Developer Experience

Developer experience in Bascik is built around a single principle: removing unnecessary abstraction so you can stay in flow. You do not need to learn a custom template syntax, debug complex hydration stack traces, or configure multi-step toolchains just to build standard web applications.

## The Local Development Loop

Bascik provides an instant local feedback loop out of the box. Running the development command starts an integrated server with Server-Sent Events (SSE) live reloading.

```bash
npx bascik
```

When you edit HTML, CSS, or JavaScript files, Bascik processes changes incrementally and updates your browser immediately. Because components are auto-discovered from file paths, creating a component is as simple as creating a file.

> **Zero Configuration.** You do not need a complex build config file to start developing. Bascik discovers components, pages, and assets automatically.

## Standard Web Primitives

Instead of introducing proprietary template languages or JSX DSLs, Bascik relies on standard HTML, CSS, and JavaScript primitives.

- **Standard HTML syntax:** Write normal HTML elements, attributes, and slots without learning framework-specific directives like `v-if` or `*ngIf`.
- **Standard CSS scoping:** Write plain CSS inside component files. Bascik automatically scopes your selectors at build time so styles never leak across components.
- **Standard JavaScript:** Use standard `<script>` tags for component or page scripts without requiring framework lifecycle wrappers.

Because everything is standard web code, standard browser DevTools and linters work without special extensions or workarounds.

## Editor and AI Tooling

Bascik integrates directly into your modern development environment.

- **VS Code Extension:** The official extension provides syntax highlighting, auto-completion for component tags, and instant navigation between component files and usages.
- **Copilot Agent Skill:** Bascik includes a dedicated agent skill (`SKILL.md`) that equips AI coding assistants with deep knowledge of Bascik conventions, scoping rules, and component patterns.

> **Learn More.** Read the [VS Code Extension docs](/tools/vscode-extension) and [Agent Skill guide](/tools/agent-skill) to set up your environment.

## Predictable Debugging and Inspection

Debugging in traditional web frameworks often means inspecting deeply nested synthetic wrapper elements, stepping through minified virtual DOM diffing logic, or resolving client-server hydration mismatches.

Bascik eliminates these pain points by resolving components ahead of time:

1. **Clean DOM Tree:** The rendered HTML in your browser matches your source components directly, without synthetic container divs or framework runtime nodes.
2. **Readable Scoped Class Names:** CSS scoping attributes use clear, predictable prefixes so you can immediately trace any element in browser DevTools back to its source component file.
3. **No Hydration Stack Traces:** Because Bascik outputs vanilla HTML and standard JavaScript without a client-side framework runtime, browser stack traces point directly to your actual script execution lines.

## Next Steps

To explore how Bascik compares to traditional frameworks or to set up your first project, dive into the surrounding documentation guides:

- Learn how Bascik differs from runtime frameworks in [Bascik vs Frameworks](/vs-frameworks).
- See how Bascik achieves top performance in [Lighthouse 100s](/performance).
- Follow the quick setup guide in [Getting Started](/getting-started).
