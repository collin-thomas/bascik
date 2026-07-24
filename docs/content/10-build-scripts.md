## Build-time Scripts

`<script data-bascik-build>` blocks are executed at transpile time as Node.js ESM modules. The script's stdout is injected in place of the tag. Runs in both dev and build modes.

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import { marked } from 'marked';
  const md = await readFile('./content/intro.md', 'utf8');
  console.log(marked(md));
</script>
```

- Top-level `import` and top-level `await` are supported.
- CWD is the project root. Relative paths resolve from there.
- Use `console.log()` or `process.stdout.write()` to output HTML.
- Build scripts run before component resolution, so their output can contain component tags.
- On error, the script tag is replaced with an empty string and a warning is logged.
