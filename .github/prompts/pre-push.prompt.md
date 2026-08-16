---
agent: agent
description: Pre-push checklist — update coverage, regenerate llms.txt, update SKILL.md, and propagate.
---

Run these steps in order before pushing.

1. `pnpm --filter @bascik/bascik update-coverage`
2. `pnpm --filter @bascik/bascik update-e2e-coverage`
3. `pnpm --filter bascik-docs generate:llms`
4. Read `docs/src/pages/assets/SKILL.md` and `docs/src/pages/llms.txt`. Update SKILL.md to reflect any new, changed, or removed APIs and patterns based on what is in llms.txt. Keep entries concise and practical — only change what the review reveals needs changing.
5. `pnpm --filter create-bascik prepack`

Confirm which sections of SKILL.md were added, changed, or removed, and whether coverage files were updated.
