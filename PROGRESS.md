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

## FINAL SUMMARY — 2026-10-15 07:36

**Status: done.** Three consecutive complete gate runs passed on commit 270851f with no changes between them (log: docs/GATE_RUNS.md). Each run: typecheck, lint (0 warnings), 636 unit tests, production build, 168 Playwright tests (desktop + mobile × light + dark).

**What's built**
- Four tabs (Home, Every Job Listing, Tracker, Stars) + Settings + onboarding + company pages (Top Role Fits, ~Pay at Each Level, Last Intern Cycle) + both season-close versions.
- Live data: 247 company boards on Greenhouse, Lever and Ashby; 864 internships, every link verified on the latest pull; 230 US business internships visible today. Daily pull script + GitHub Action; dated snapshots committed; history builds the "Last Intern Cycle" dataset.
- Demo data: 2,520 fictional postings with a year of history, labeled "Demo data" everywhere; Home renders it in ~100–160 ms.
- Fit model: Perfect requires a resume ↔ requirements match and eligibility; career + industry never produce Perfect (2,000-case property test); class year is fit, with "Not eligible yet" in Non-fit; every tier explains itself (Why).
- Opened → Applied by return prompt or forwarded email; tracker moves by email with "moved by email" + undo; drag-and-drop with mouse and keyboard; denied roles never repopulate, including reposts.
- New Stars glow (breathing gold halo; static under reduced motion) for new roles, windows opening within 7 days (company or role group), and deadlines on unapplied roles; clears per card on click.
- Model calls go through one provider interface; the deterministic mock is the default, so everything runs offline.

**Definition of Done (section 9)**
| Item | Result | Evidence |
|---|---|---|
| All tabs, Settings, onboarding, both season closes reachable | Pass | e2e personas + app specs |
| Section 3 flows end to end, offline (demo) and online (live) | Pass | personas spec (demo); live spec + live pull |
| Fit model rules | Pass | fit.test.ts (property test), personas spec |
| Denied never repopulates, incl. reposts | Pass | store.test.ts, personas repost test |
| Opened → Applied via email fixture and via return prompt | Pass | personas (Jordan, Maya), store.test.ts |
| New Stars glow per trigger, clears per card | Pass | intel.test.ts, personas (Maya stars) |
| Every visible link resolved on the latest pull | Pass | quality link test (demo), live spec (real data) |
| Light + dark complete | Pass | 4 projects, screenshot review |
| WCAG AA, keyboard, focus, reduced motion, SR labels | Pass | tokens.test.ts (62 pairs), axe on every screen × 4, keyboard + motion tests |
| Desktop + mobile, no horizontal scroll, no dead right padding | Pass | layout tests on every screen |
| Zero console errors/warnings; typecheck, lint, unit, e2e | Pass | gate runs |
| Home < 1 s with 2,000+ listings | Pass (~0.1 s) | perf test |
| Empty, loading, error, zero-roles states designed | Pass | screenshot review |
| Cold-start/approximate data labeled | Pass | "tracking since", "Not enough history yet", "~" pay with source |
| Section 8 + section 10 | Pass (section 8 waived by the human) | see decisions log |
| PROGRESS.md summary; DESIGN_DIRECTION.md decisions | Pass | this file; DESIGN_DIRECTION.md §1–8 |

**Honest limits (by design or outside this build)**
- **Evan's guidance:** never provided; the human said it won't come. Section 8 is treated as waived by that decision.
- **Inbound email:** each user has a forwarding address, but no mail service receives it yet. The full pipeline runs behind an interface and is exercised by the paste tool and fixture emails. The UI says so.
- **Notification delivery:** the composer (never sends "0 new"), preferences and a live preview exist. Sending push or email needs a backend, which isn't part of this build.
- **Workday/Taleo/iCIMS:** most banks, Big 4 and big corporates use these and expose no public board, so they aren't covered. Documented in docs/DATA_PIPELINE.md; the adapter interface is ready for them.
- **Link checks:** about 300 employer sites block scripted requests (403). Those links are confirmed live through the company's own ATS board listing instead of loading the page.
- **History:** live tracking started 2026-10-15, so live seasons and windows show cold-start labels until history accumulates. The demo shows the full experience.
- **Full-time pay:** pay by level is labeled "later" (U.S. DOL H-1B data).
- **Not pushed:** the repo has no remote, and the GitHub Action is ready for one. Snapshots are about 4 MB a day.

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
| 15 | Last Intern Cycle was a 70-row wall at big companies | Grouped by role type, one bar each, roles behind a disclosure |
| 16 | E2E fixture had an off-by-default warning-ignore switch | Removed: any warning fails the suite |

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
