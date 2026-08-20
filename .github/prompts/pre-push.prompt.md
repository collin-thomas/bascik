---
agent: agent
description: Pre-push checklist — check spelling/standards, update coverage, update SKILL.md, and propagate.
---

Run these steps in order before pushing.

1. Check spelling and web standards across the workspace to prevent typos and compatibility regressions:
   - Run `yarn check:spelling` to verify American English spelling with codespell.
   - Run `yarn check:standards` to check web standards with webhint.
2. Run unit tests and typechecks across all monorepo packages:
   - Run `yarn test:all` to verify unit tests and TypeScript compilation across pkg, docs, create, and extensions/vscode-bascik.
3. `yarn update-coverage:all`
3. Read `docs/src/pages/assets/SKILL.md` and review changes in `docs/content/` on this branch. Update SKILL.md to reflect any new, changed, or removed APIs and patterns based on documentation updates. Keep entries concise and practical — only change what the review reveals needs changing.
4. `yarn create:prepack`

Confirm which sections of SKILL.md were added, changed, or removed, whether coverage files were updated, and that codespell and webhint checks passed cleanly.
