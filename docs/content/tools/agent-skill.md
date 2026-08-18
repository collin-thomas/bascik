# Agent Skill

Download the Bascik skill file and attach it to GitHub Copilot, Cursor, Claude, or any AI assistant that supports instruction files, so it understands Bascik's component model, scoping rules, and conventions out of the box.

The Bascik skill file (`SKILL.md`) teaches any AI assistant, GitHub Copilot, Cursor, Claude, or others that support instruction files, the full details of how Bascik works: its component model, scoping system, config options, CLI, and conventions.

Add it once, and your AI assistant can accurately answer questions about Bascik, generate correct components, and help debug scoping issues without needing to look anything up.

## Download

Download [SKILL.md](https://bascik.dev/assets/SKILL.md) directly.

## Download and Install

Run the following from the root of your repo in your terminal.

### Adding it to VSCode

```sh
mkdir -p .github/skills/bascik && curl -L -o .github/skills/bascik/SKILL.md https://bascik.dev/assets/SKILL.md

```

### Adding it to Cursor

```sh
mkdir -p .cursor/skills/bascik && curl -L -o .cursor/skills/bascik/SKILL.md https://bascik.dev/assets/SKILL.md
```

### Adding it to Claude

```sh
mkdir -p .claude/skills/bascik && curl -L -o .claude/skills/bascik/SKILL.md https://bascik.dev/assets/SKILL.md
```

## What's inside

The skill covers:

- Component authoring, slots, and props
- Scoped CSS and scoped JavaScript rules and constraints
- Build scripts (`data-bascik-build`)
- Configuration options (`bascik.config.ts`)
- CLI commands and workflow
- The scoping compatibility table
- Folder structure and naming conventions

> **Keeping it current.** `SKILL.md` is regenerated from the same Markdown source files that power this docs site. When the docs update, so does the skill file.
