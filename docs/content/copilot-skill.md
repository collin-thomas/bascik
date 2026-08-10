# AI Skill

Download the Bascik skill file and attach it to GitHub Copilot, Cursor, Claude, or any AI assistant that supports instruction files — so it understands Bascik's component model, scoping rules, and conventions out of the box.

The Bascik skill file (`SKILL.md`) teaches any AI assistant — GitHub Copilot, Cursor, Claude, or others that support instruction files — the full details of how Bascik works: its component model, scoping system, config options, CLI, and conventions.

Add it once, and your AI assistant can accurately answer questions about Bascik, generate correct components, and help debug scoping issues without needing to look anything up.

## Download

The skill file is served from this site:

```text
https://bascik.dev/assets/SKILL.md
```

## Adding it to GitHub Copilot (VS Code)

Save the file somewhere in your project (e.g. `.github/bascik-skill.md`) then reference it in your `.github/copilot-instructions.md`:

```markdown
<!-- .github/copilot-instructions.md -->
See @.github/bascik-skill.md for the complete Bascik reference.
```

Or attach it directly in a Copilot Chat conversation using the **Attach Context** button and selecting the file.

## Adding it to Cursor

Place the file at `.cursor/rules/bascik.md` in your project root. Cursor picks it up automatically as a project rule.

## Adding it to Claude (claude.md)

Paste the contents into your `claude.md` file, or reference the file path in your project instructions.

## What's inside

The skill covers:

- Component authoring, slots, and props
- Scoped CSS and scoped JavaScript rules and constraints
- Build scripts (`data-bascik-build`)
- Configuration options (`bascik.config.js`)
- CLI commands and workflow
- The scoping compatibility table
- Folder structure and naming conventions

> **Keeping it current.** `SKILL.md` is regenerated from the same Markdown source files that power this docs site. When the docs update, so does the skill file.
