## What to Read Next

Once your first page is running, the next docs pages map cleanly to the next questions people usually have:

- **[CLI / Command Line](/cli):** command output, watch behavior, `--check`, and production preview commands
- **[Configuration](/configuration):** every `bascik.config.ts` option in one place
- **[Scoped Styles](/scoped-styles):** how paired `.css` files and inline `<style>` tags are isolated per component

### A Small First Habit

Open the compiled file in `dist/` after your first build. It is the fastest way to verify what Bascik actually emitted:

- component tags should be replaced with plain HTML
- scoped class names should be present where component CSS applies
- build-script output should already be inlined into the page

When you need the detailed terminal output for dev mode, build mode, static checks, or file watching, use the [CLI page](/cli). Keeping that output reference in one place makes the Getting Started guide easier to skim.
