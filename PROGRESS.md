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

## 2026-10-15 06:30 — Phase 4 playtest done, Phase 5 fix loop
**Playwright suite** (e2e/): 42 tests × 4 projects (desktop/mobile × light/dark) = 168. Personas 1–5 from the brief, plus quality (link check, axe WCAG 2 A/AA on every screen, keyboard, focus outlines, no horizontal scroll, right gutter = left gutter, reduced motion, perf), tracker drag (mouse + keyboard), resume files, app screens, and a live-data link check. Every test fails on any console error/warning, page error or failed request.
**Perf:** Home with 2,400 demo listings renders in ~120–160 ms (median of 3, every project). Budget is 1 s.

**Findings from the harsh screenshot review + the suite, all fixed:**
| # | Finding | Fix |
|---|---|---|
| 1 | Freshman whose new roles were all Non-fit saw "No new roles today" | New-today counts Non-fit; zero-day sentence only when nothing is new |
| 2 | Every PDF upload logged a pdf.js font warning | Ship pdf.js standard fonts via a Vite plugin; extractor points at them |
| 3 | Demo links opened "posting not found" in a fresh tab | Demo posting pages always load demo data |
| 4 | First Tab skipped the skip link (focus jumped to main on load) | Focus moves to main only on later navigations |
| 5 | "/" from another screen didn't focus search | Navigation focus skips URLs that ask a field to focus |
| 6 | Keyboard drag couldn't reach an empty column from a low card | Arrows move a card a whole column |
| 7 | Two tabs could overwrite each other's state | Store reloads on the storage event |
| 8 | Congrats page wasted the right half; share card showed "0 interviews" | Two-column season close; share card hides zero stats |
| 9 | "Show 16 more of 16", "2400" without separators | Copy + number formatting |
| 10 | Toast followed you to the next screen | Toasts clear on navigation |
| 11 | Mobile no-offer stats stacked with huge gaps | Three-across compact stats |
| 12 | Live data: non-US roles (Tokyo, m/w/d) | App shows US-or-remote only; data keeps all |
| 13 | Live data: "early career" new-grad roles counted as internships; hardware interns in People & HR | Classifier fixes + regression tests |
| 14 | First live pull marked every role "New today" | First tracked day uses the employer's posted date |

**Live data now:** 247 seed boards (Greenhouse 179, Lever 29, Ashby 39), 864 internships, every link verified, 230 US business internships from 59 companies.

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
