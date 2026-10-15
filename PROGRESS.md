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

## 2026-10-15 03:40 — Phase 3 screens built; Phase 4 journeys running
**Done**
- Every screen: onboarding (resume → confirm + targets → optional forwarding → optional stars → populate), Home (filters, season strip, new-today numbers, legend once, 4 always-open lanes, New Stars ¼ column), Every Job Listing (search, filters, posted date, "add to targets" offer), Tracker (Opened tray, 5 columns, drag-and-drop incl. keyboard, move menu, notes, "moved by email" + undo), Stars (galaxy, window status, top role fits, pay, last cycle, alerts), company pages, Settings, season close (offer + no-offer), demo posting page, designed loading/error/empty/zero states.
- **Human feedback "way too messy" (on the mock) → clean pass:** lanes are plain lists (no boxes in boxes), one quiet meta line per role, fit label only where no lane says it, "Why" as a small icon, gold only for stars with news, no key-cap chips in nav. Logged in base.css header.
- Fixes found while reviewing: star trigger now also fires for unposted role groups at open companies (Halcyon consulting); Stars cards summarize news instead of listing 11 lines; settings uses the full width; settings icon redrawn (gear read as a sun); mobile filters compact; pay floor now ranks under-floor roles lower; forwarding preview limitation is stated visibly; no-offer close never shows a row of zeros.
- Tests: fit (13), intel (16), contrast tokens (62, both themes), store/email pipeline (6), classifiers (188), email/resume (191), demo data (26).

**In progress:** live ATS pull agent; Playwright persona journeys agent.

**Blockers:** none. Note: the desktop app's preview tool only reads the studio repo's launch config, so the dev server runs as a background process.

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
