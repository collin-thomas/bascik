# TypeScript

Bascik is written in TypeScript, and projects built with Bascik can be written in TypeScript too. Add `data-bascik-ts` to any `<script>` tag — client, build-time, or server — and Bascik handles the rest. No bundler, no compile step, no configuration.

## How It Works

Bascik requires Node.js 24+, which runs TypeScript natively by stripping type annotations. That splits TypeScript support into two halves:

- **Scripts that run in Node.js** (`data-bascik-build` and `data-bascik-server`) need no compilation at all. Bascik strips the type annotations from the script body just before handing it to Node — the same erasure-only semantics as Node running a `.ts` file directly.
- **Scripts that run in the browser** (plain `<script>` tags in components and pages) are transformed at build time. Bascik strips the types using Node's built-in `stripTypeScriptTypes` API, then the resulting JavaScript flows through the normal scoping pipeline — `id`/`name`/`class` rewriting, IIFE wrapping — exactly like a hand-written JS block. The browser only ever receives plain JavaScript.

Type stripping is erasure-only: annotations are replaced in place, so line numbers never shift and there is zero runtime cost. Nothing TypeScript-related ships to the browser.

## Client Scripts

Add `data-bascik-ts` to a component or page `<script>` tag:

```html
<!-- src/components/ts-counter.html -->
<div class="counter">
  <p id="count">0</p>
  <button id="inc" type="button">+1</button>
</div>
<script data-bascik-ts>
  const count = document.getElementById('count') as HTMLParagraphElement;
  const inc = document.getElementById('inc') as HTMLButtonElement;
  let n: number = 0;
  inc.addEventListener('click', (): void => {
    n += 1;
    count.textContent = String(n);
  });
</script>
```

The compiled output is plain, scoped JavaScript — the `data-bascik-ts` attribute is removed, the types are gone, and every `getElementById` string is rewritten to the instance's unique id:

```html
<script>(function() {
  const count = document.getElementById('bascik__ts-counter__a1b2__count') ;
  const inc = document.getElementById('bascik__ts-counter__a1b2__inc') ;
  let n = 0;
  inc.addEventListener('click', () => {
    n += 1;
    count.textContent = String(n);
  });
})();</script>
```

All the scoping rules from [Scoped JavaScript](/scoped-javascript) apply unchanged: use `id` + `getElementById` for per-instance elements, register runtime-only classes in the template HTML, and so on.

> **Erasable syntax only.** Client scripts support the same TypeScript subset as Node's native type stripping: annotations, interfaces, type aliases, generics, `as` casts, `satisfies`. Constructs that require code generation — `enum`, `namespace` with runtime code, parameter properties, legacy decorators — are not supported. If a script uses one, Bascik logs a warning naming the file and removes the block from the output rather than shipping raw TypeScript to the browser.

## Build Scripts

Add `data-bascik-ts` to a [build-time script](/build-scripts) and write TypeScript directly:

```html
<script data-bascik-build data-bascik-ts>
  interface Post { title: string; excerpt: string }
  const res = await fetch('https://api.example.com/posts/latest');
  const { title, excerpt } = (await res.json()) as Post;
  console.log(`<h2>${title}</h2><p>${excerpt}</p>`);
</script>
```

Everything else works exactly like a JavaScript build script: top-level `import` and `await`, paths relative to the project root, `console.log()` for output, and the build-script disk cache.

## Server Scripts

The same `data-bascik-ts` attribute works on [server scripts](/server), which run in Node.js on every request:

```html
<script data-bascik-server data-bascik-ts>
  interface BascikRequest {
    path: string;
    method: string;
    headers: Record<string, string>;
    searchParams: Record<string, string>;
  }
  const req: BascikRequest = JSON.parse(process.env.BASCIK_REQUEST!);
  const name = req.headers['x-display-name'] ?? 'Guest';
  console.log(`<p>Welcome, ${name}</p>`);
</script>
```

## bascik.config.ts

The project config file can be TypeScript too. Bascik looks for `bascik.config.js` first, then falls back to `bascik.config.ts` — Node imports it natively:

```ts
// bascik.config.ts
interface BascikUserConfig {
  siteUrl?: string;
  minifyStyles?: boolean;
  minifyScripts?: boolean;
}

export const bascikConfig: BascikUserConfig = {
  siteUrl: 'https://example.com',
};

export const buildOverrideConfig: BascikUserConfig = {
  minifyStyles: true,
  minifyScripts: true,
};
```

## Recipe: Shared TypeScript Helpers

Build scripts can import project-local `.ts` files directly — Node strips their types on import. Keep shared logic in `scripts/` and import it with the standard `pathToFileURL` pattern:

```ts
// scripts/greet.ts
export interface Greeting { name: string }
export const greet = (g: Greeting): string => `<p>Hello, ${g.name}</p>`;
```

```html
<script data-bascik-build data-bascik-ts>
  import { join } from 'node:path';
  import { pathToFileURL } from 'node:url';
  const { greet } = await import(
    pathToFileURL(join(process.cwd(), 'scripts/greet.ts')).href
  );
  console.log(greet({ name: 'Bascik' }));
</script>
```

Files under `scripts/` and `content/` referenced by string literal are tracked by the build-script cache, so editing `greet.ts` invalidates the cached output automatically.

## Recipe: Typed Build-time Data

Parse a JSON data file at build time and let TypeScript check the render code:

```html
<script data-bascik-build data-bascik-ts>
  import { readFile } from 'node:fs/promises';

  interface NavItem { href: string; label: string }
  const items: NavItem[] = JSON.parse(
    await readFile('./content/nav.json', 'utf8'),
  );
  const links = items
    .map((item) => `<li><a href="${item.href}">${item.label}</a></li>`)
    .join('\n');
  console.log(`<ul>\n${links}\n</ul>`);
</script>
```

## Recipe: Typed DOM Access in Components

`as` casts and narrow types keep component scripts honest without any runtime cost:

```html
<form>
  <input id="email" name="email" type="email" required />
  <button id="submit" type="submit">Subscribe</button>
  <p id="feedback" hidden></p>
</form>
<script data-bascik-ts>
  const form = document.getElementById('email')!.closest('form') as HTMLFormElement;
  const email = document.getElementById('email') as HTMLInputElement;
  const feedback = document.getElementById('feedback') as HTMLParagraphElement;

  form.addEventListener('submit', (event: SubmitEvent): void => {
    event.preventDefault();
    feedback.textContent = `Subscribed ${email.value}`;
    feedback.hidden = false;
  });
</script>
```

## Editor Type Checking

Bascik strips types — it does not type-check. For red squiggles and `tsc --noEmit` verification of your `scripts/` helpers, add a minimal `tsconfig.json` to your project:

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "noEmit": true,
    "strict": true
  },
  "include": ["scripts", "bascik.config.ts"]
}
```

The `erasableSyntaxOnly` flag makes `tsc` reject the constructs that Node's type stripping cannot run (enums, namespaces, parameter properties), so anything that type-checks is guaranteed to execute.

> **Inline scripts and editors.** TypeScript inside HTML `<script data-bascik-ts>` blocks isn't type-checked by `tsc` (it only sees `.ts` files). Keep complex logic in `scripts/*.ts` helpers where the compiler can verify it, and keep inline blocks thin.
