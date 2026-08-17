---
agent: agent
description: Pre-push checklist — update coverage, build docs (llms.txt + search index), update SKILL.md, and propagate.
---

Run these steps in order before pushing.

1. `yarn docs:update-coverage`
2. `yarn docs:update-e2e-coverage`
3. `yarn docs:build`
4. Read `docs/src/pages/assets/SKILL.md` and review changes in `docs/content/`. Update SKILL.md to reflect any new, changed, or removed APIs and patterns based on documentation updates. Keep entries concise and practical — only change what the review reveals needs changing.
5. `yarn create:prepack`

Confirm which sections of SKILL.md were added, changed, or removed, and whether coverage files were updated.
