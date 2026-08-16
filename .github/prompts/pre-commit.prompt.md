---
mode: agent
description: Pre-commit checklist — update test coverage, regenerate llms.txt, update SKILL.md to reflect current docs content, and propagate everything.
---

Run this before committing. It handles all the housekeeping tasks that should accompany any meaningful change to docs content, package source, or tests.

## Step 1 — Update test coverage (if tests changed)

If any unit tests in `pkg/src/` were added, removed, or significantly changed, regenerate the coverage JSON files:

```sh
pnpm --filter @bascik/bascik update-coverage
pnpm --filter @bascik/bascik update-e2e-coverage
```

Skip this step if no tests were touched.

## Step 2 — Regenerate llms.txt

```sh
pnpm --filter bascik-docs generate:llms
```

## Step 3 — Understand the current SKILL.md structure

Read `docs/src/pages/assets/SKILL.md` in full. Note every section and the patterns it documents.

## Step 4 — Read the current docs content

Read all files under `docs/content/` (including subdirectories). For each file, note:
- New features, APIs, or patterns not yet reflected in SKILL.md
- Changed behavior that contradicts existing SKILL.md guidance
- Removed or renamed things that SKILL.md still references

## Step 5 — Update SKILL.md

Edit `docs/src/pages/assets/SKILL.md` to:
- Add new sections or bullets for anything in the docs that is missing from the skill
- Correct any guidance that no longer matches the docs
- Remove references to features or APIs that no longer exist
- Preserve the existing structure and tone — keep entries concise and practical

Do not rewrite sections that are already accurate. Only change what the docs review revealed needs changing.

## Step 6 — Propagate to the create package

```sh
pnpm --filter bascik-docs generate:llms
pnpm --filter create-bascik prepack
```

This regenerates `llms.txt` once more (picking up any doc changes since Step 2) and runs `create-bascik`'s `prepack` to copy the updated SKILL.md into `create/assets/SKILL.md`.

## Done

Confirm which sections of SKILL.md were added, changed, or removed, and whether coverage files were updated.
