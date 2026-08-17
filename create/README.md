# create-bascik

Interactive project initializer for [Bascik](https://bascik.dev).

## Quick Start

Scaffold a new Bascik project in one command:

```sh
npm create bascik@latest my-site -y
```

Pass a project name as an argument or run without arguments to be prompted:

```sh
npm create bascik@latest
```

## What it scaffolds

`create-bascik` creates a complete, ready-to-run starter site:

```text
my-site/
├── .github/skills/bascik/SKILL.md  ← AI Copilot skill file
├── .claude/skills/bascik/SKILL.md  ← Claude skill file
├── src/
│   ├── components/                 ← site-meta, site-header, site-footer, feat-card, my-counter
│   └── pages/                      ← index.html, about.html, contact.html, 404.html, css/styles.css
├── bascik.config.ts
├── package.json
└── .gitignore
```

After scaffolding:

```sh
cd my-site
npm run dev
```

Your site will be live at `http://localhost:8080`.
