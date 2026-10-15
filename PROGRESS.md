# PROGRESS — Fifteen (internship recruiting app)

Written for a quick skim on a phone. Newest entry on top.

## Decisions log
- **Repo:** new repo at `C:\intern-app` (the evan-studio repo is a video studio with no website; the brief says "your website repo" and none existed). Local git only; nothing is pushed.
- **Stack:** Vite 8 + React 19 + TypeScript 6.0 (newest TS that typescript-eslint supports) + react-router 7, Vitest 5, Playwright 1.64 (Chromium already installed). Plain CSS with custom-property tokens. Pure-TS core shared by the Node pull pipeline and the browser app (Node 24 runs `.ts` directly).
- **Evan's guidance (section 8):** the human said on 2026-10-15 "evan's guidance.md will not be coming" and gave full permission to complete the build. Section 8 is therefore treated as intentionally empty by the human's decision; sections 9 and 10 are the gate.
- **App name:** "Fifteen" (working name, from "15 minutes a day").
- **Model provider:** one interface (`src/core/provider`), env `FIFTEEN_MODEL_PROVIDER=mock|http`; the deterministic mock is the default, so everything runs offline with no keys.
- **Demo data:** fictional companies only, `dataset: "demo"`, links go to an in-app demo page, and a visible "Demo data" label shows whenever it's loaded.

---

## 2026-10-15 02:15 — Phase 0 done, Phase 1 + 2 in progress
**Done**
- Recon: brief + color reference extracted from `intern-app-brief.zip`; Node 24, Chromium for Playwright already installed; 89 GB free.
- Scaffold, shared types, taxonomy (industries, careers incl. non-business families, cities), signal lexicon, cycle math (summer cycles, grad years, title normalization, dedupe key).
- Fit model + 12 tests (incl. a 2,000-case property test that career+industry alone never yields Perfect).
- Window prediction, season phases, star triggers, pay, notifications + 15 tests.
- `DESIGN_DIRECTION.md`: reference study, research notes, 3 directions, pick (Lavender Paper), tokens with AA-checked contrast.

**In progress (parallel Sonnet subagents)**
- ATS adapters (Greenhouse, Lever, Ashby), normalization, link verification, snapshots, seed list, live pull.
- Classification rules (internship, eligibility, industry/career, requirements, pay, deadlines, cities).
- Email stage classifier + fixtures; resume parsing (PDF/DOCX) + persona resume files.
- Demo dataset (2,400+ listings, fictional, labeled).
- Static mocks for the three design directions.

**Next:** app shell, tokens/primitives, job card, Home.

**Blockers:** none.
