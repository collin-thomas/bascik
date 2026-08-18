# Getting Started

Bascik requires Node.js v22.18+. Get up and running in under five minutes.

## Quick Start

The fastest way to start a new Bascik project with no prompts, just a running site:

```sh
npm create bascik@latest my-site -y
```

That scaffolds the project, installs dependencies, and starts the dev server in one shot. Open **http://localhost:8080** in your browser to see your live site.

Pass a different name to use it as both the directory name and the site title. If you omit `-y`, the CLI steps through the setup prompts interactively.

`npm create bascik@latest` scaffolds a complete starter site: pages, components, global CSS, `bascik.config.ts`, and a `.gitignore`.

### Manual Setup

To add Bascik to an existing project:

```sh
npm install @bascik/bascik
```

Run `bascik init` to create the starter directory structure, or add `"dev": "bascik"` and `"build": "bascik --build"` to your `package.json` scripts.

<!-- demo:component-html -->
```html
<nav class="nav">
  <a href="/">Home</a>
  <a href="/about">About</a>
</nav>
```

<!-- demo:page-html -->
```html
<!DOCTYPE html>
<html>
<head><title>Home</title></head>
<body>
  <site-nav></site-nav>
  <h1>Hello world</h1>
</body>
</html>
```
