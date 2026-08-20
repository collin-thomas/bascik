# Agent Skill

Download the Bascik skill file and attach it to GitHub Copilot, Cursor, Claude, or any AI assistant that supports instruction files, so it understands Bascik's component model, scoping rules, and conventions out of the box.

The Bascik skill file (`SKILL.md`) teaches any AI assistant, GitHub Copilot, Cursor, Claude, or others that support instruction files, the full details of how Bascik works: its component model, scoping system, config options, CLI, and conventions.

Add it once, and your AI assistant can accurately answer questions about Bascik, generate correct components, and help debug scoping issues without needing to look anything up.

## Download and Install

Run the following from the root of your repo in your terminal. This will create the `skills/bascik` directory and download and install the Bascik `SKILL.md` file.

### Add the Skill to VSCode

```sh
mkdir -p .github/skills/bascik && curl -L -o .github/skills/bascik/SKILL.md https://bascik.dev/assets/SKILL.md

```

### Add the Skill to Cursor

```sh
mkdir -p .cursor/skills/bascik && curl -L -o .cursor/skills/bascik/SKILL.md https://bascik.dev/assets/SKILL.md
```

### Add the Skill to Claude

```sh
mkdir -p .claude/skills/bascik && curl -L -o .claude/skills/bascik/SKILL.md https://bascik.dev/assets/SKILL.md
```

### Download Only

Download the Bascik [SKILL.md](https://bascik.dev/assets/SKILL.md) directly.

## Keeping Updated via Git Submodules

If you want to ensure your workspace's skill file is always up to date with the latest Bascik specifications, you can use a Git submodule. Because Git does not support tracking an individual file as a submodule, you must add the Bascik repository itself and then symlink the skill file.

### 1. Add the Submodule

Add the Bascik repository as a Git submodule inside your project (for example, under `vendor/bascik`):

```sh
git submodule add https://github.com/bascikdev/bascik.git vendor/bascik
```

### 2. Symlink the Skill File

Create a symbolic link (symlink) pointing from the appropriate agent skills directory in your project to the `SKILL.md` file inside the submodule. 

For **VS Code**:

```sh
mkdir -p .github/skills/bascik
ln -s ../../../vendor/bascik/docs/src/pages/assets/SKILL.md .github/skills/bascik/SKILL.md
```

For **Cursor**:

```sh
mkdir -p .cursor/skills/bascik
ln -s ../../../vendor/bascik/docs/src/pages/assets/SKILL.md .cursor/skills/bascik/SKILL.md
```

For **Claude**:

```sh
mkdir -p .claude/skills/bascik
ln -s ../../../vendor/bascik/docs/src/pages/assets/SKILL.md .claude/skills/bascik/SKILL.md
```

Using relative symbolic links ensures that they work seamlessly for any developer on your team who clones your repository.

### 3. Keep the Skill Updated

To fetch the latest updates from the upstream Bascik repository and keep your local skill file synchronized, run:

```sh
git submodule update --remote --merge
```

This updates the submodule to the latest commit on its tracking branch, automatically syncing your local `SKILL.md` to the current version.

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

## Recommended Models

Using the Bascik skill in VS Code Copilot, the following models have been shown to perform exceptionally well with Bascik:

- **Gemini 3.6 Flash**: Fast and accurate for component generation and general editing tasks.
- **Claude Sonnet 4.6**: Excellent for complex reasoning, debugging scoping constraints, and refactoring.

*As of August 19, 2026.*
