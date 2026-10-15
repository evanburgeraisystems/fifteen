# BUILD BRIEF — Internship Recruiting App (working name: `[APP NAME]`)

> **To Claude Code:** This file is your complete brief. Read all of it before writing any code.
> You will work autonomously, in phases, until the **Definition of Done** (section 9) passes
> **three consecutive clean runs**. You do not stop at "it compiles" or "it mostly works."
> The color reference image is at `reference/color-reference.png` — open it and study it.

---

## 0. For the human (read once, then hand this to Claude Code)

1. Put this folder (`BUILD_BRIEF.md` + `reference/`) in the root of your website repo.
2. If you have **Evan's guidance** (a doc, rules, design system), paste it into section 8 below,
   or drop it in the repo as `EVANS_GUIDANCE.md`. Claude Code will refuse to sign off without it.
3. (Optional) Pre-approve permissions so the run doesn't stall — see section 11.
4. Start Claude Code in the repo and send exactly:
   > Read BUILD_BRIEF.md end to end and execute it. Start with Phase 0. Keep PROGRESS.md updated.
5. Check `PROGRESS.md` whenever you want a status update — it's written for you.

---

## 1. The product in one breath

Internship recruiting is brutal: too much to search, too much to track, and no one tells you
*when* things open. **This app: 15 minutes a day, apply to every hit.**

- **User:** college freshmen–juniors recruiting for **summer internships**.
- **MVP scope:** **business roles** (finance, consulting, accounting, marketing, ops, strategy,
  sales, supply chain, etc.). Full version: all roles. Architect for "all roles" from day one;
  ship business first.
- **Price:** free for students. No paywalls, no weekly plans, no trial traps. Ever.
- **Brand promise:** *Every link works.* The single most valuable feature is an **accurate,
  direct link to the real posting** (the company's own ATS page, never an aggregator redirect),
  re-verified on every daily pull.

---

## 2. Information architecture — four tabs

| Tab | Purpose |
|---|---|
| **Home** | Your targets only. What's new today, ranked by fit. |
| **Every Job Listing** | Every business internship in the database, no target filters by default. |
| **Tracker** | Your applications moving through stages. |
| **Stars** | The galaxy page of companies you starred. |

Plus **Settings** (targets, resume, notifications, email forwarding).

---

## 3. Full user flow, open → close

### 3.1 Onboarding
1. **Drop your resume** (PDF or DOCX).
2. **Confirm what we read** — editable chips — and choose targets:
   - Required: **class year**, **industries** (multi), **careers** (multi), **cities** (multi).
   - Optional: pay floor.
3. **Optional: email forwarding** — one Gmail filter forwards recruiting emails to the user's
   unique inbound address. "Skip" must be a first-class, guilt-free choice.
4. **Optional: star a few companies** (suggested from targets).
5. **The populate moment** — Home builds itself. This is the magic trick; make it feel earned.

### 3.2 Home
**Layout:** lanes take **¾** of the width; **New Stars** column takes **¼** (on mobile: a row on top).

Top to bottom:
1. **Filter chips:** Industry · Career · City (defaults = onboarding targets).
2. **Season strip:** one line, scoped to the active industry, e.g.
   `Finance · Peak · week 3 of 8`. Seasons differ by industry — never show one global season.
3. **New today:** `2 Perfect · 3 Almost · 6 Weak` (within current filters).
4. **Four lanes, always open (never collapsed):** **Perfect · Almost · Weak · Non-fit**.
   - A **one-line legend** explains the tier boundaries *once* (not per card).
   - Each lane header shows its count.

**New Stars (the ¼ column):**
- Resting state: **regular gold** card per starred company.
- **Strong glow on next login** when something new happens at that company:
  new role posted · window predicted to open within ~7 days · deadline approaching on a role
  you haven't applied to · (later) recruiting event/info session.
- **Clicking that card** returns it to regular gold. One card at a time.
- Glow style: **breathing halo** (soft gold halo gently pulsing). Must respect
  `prefers-reduced-motion` (static brighter halo instead).

### 3.3 Job card (used on Home, Every Job Listing, Stars)
- Company · role title · city · posted date ("2d ago").
- **Verified direct link** with a small "verified today" mark.
- Fit label (Perfect / Almost / Weak / Non-fit; "Not eligible yet" tag if class-year mismatch).
- Status: **New → Opened → Applied**.
  - Clicking the link marks **Opened** automatically.
  - Opened → **Applied** when (a) a confirmation email arrives via forwarding, or
    (b) a single quiet **"Applied? Yes / Not yet"** prompt when the user returns to the app.
  - "New" badges clear once seen. **No forced Apply/Skip game. No end-of-day recap.**

### 3.4 Every Job Listing
- Starts **unfiltered**: every business internship, sorted by fit to the user's resume.
- Search bar + optional filters: industry, career, city, posted date.
- Same cards, same fit labels as Home.
- If a user repeatedly applies outside their targets (e.g., 4 Supply Chain roles), gently offer:
  "Add Supply Chain to your targets?"

### 3.5 Tracker
- Columns: **Applied → Assessment → Interview → Offer / Denied**.
- **"Opened" tray** across the top: roles clicked but not confirmed. ✓ to confirm.
- Email-forwarding moves cards automatically with a small **"moved by email"** tag + **undo**.
- **Drag-and-drop anytime** (for portals that never email).
- **Denied:** that role never repopulates for this user. Dedupe key =
  `company + normalized role title + recruiting cycle` (companies repost with new IDs).
- Card: company, role, date applied, stage, direct link, notes.
- Industry filter chips, matching Home.

### 3.6 Stars (galaxy page)
Every starred company as a gold card with the breathing halo. Card, top to bottom:
1. **Company + window status:** `Open now` / `Opening ~Aug 12` / `Closed`.
2. **Top Role Fits** (underlined) → that company's roles ranked by fit, each with direct link;
   if nothing is posted: "Opened ~Aug 12 last year."
3. **~Pay at Each Level** → page with rough pay by level.
4. **Last Intern Cycle** → timeline of when each role opened/closed last year.

Actions: star from any card or company search; unstar; per-company alert toggle.

### 3.7 Settings
- Edit targets; re-upload resume → everything re-ranks instantly.
- Notifications (each optional): **new hits — only sent when there are any, never "0 new"** ·
  star alerts · weekly digest instead of daily.
- Email forwarding setup / disconnect.

### 3.8 Season close (two versions — this matters)
- **Offer landed → "Congrats!"** Full celebration, shareable recap card.
- **No offer → "Keep going."** Private by default. Forward-looking, not consoling and not sad:
  what moved (applications, assessments, interviews), when starred companies open next.
  Stars and tracker carry into next season. Most underclassmen land here — design it with care.

### 3.9 Zero-roles days
Dashboard says so calmly with season context, e.g. *"No new roles today. Finance windows are
mostly closed; Consulting opens in about 3 weeks."* No push notification on zero days.

---

## 4. The fit model (get this exactly right)

**Filters decide WHICH roles you see. Fit decides WHERE they rank.**

- **Filters (targets):** industry, career, city. Chips, changeable anytime.
- **Fit (resume ↔ posting requirements):** Perfect · Almost · Weak · Non-fit.
- **Class year is part of fit, not a filter.** Ineligible roles sink to Non-fit tagged
  "Not eligible yet" — they never disappear.
- **Hard rule:** career + industry match **can never by itself produce "Perfect."**
  Perfect requires a strong **resume ↔ requirements** match **and** eligibility.
- Tier legend (shown once per screen), e.g.:
  - **Perfect** — your resume strongly matches what they ask for, and you're eligible.
  - **Almost** — strong match with one gap.
  - **Weak** — partial match.
  - **Non-fit** — little overlap, or not eligible yet.
- Tiers must be **explainable**: store the matched/missing signals so a "why" view is possible.

---

## 5. Data & intelligence

### 5.1 Listings pipeline ("the database on GitHub")
- Pull from the **public, keyless job-board APIs** companies use to power their own career pages:
  - Greenhouse: `GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`
  - Lever: `GET https://api.lever.co/v0/postings/{slug}?mode=json`
  - Ashby: `GET https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true`
- Maintain a **seed list of companies** (board tokens/slugs) in a versioned file. Start with
  business-heavy employers that use these ATSs; make adding companies trivial.
- Known gap: **Workday/Taleo don't expose comparable public boards** — many banks/big corporates
  use them. Design an adapter interface so more sources can be added; document the gap honestly.
- **Daily pull** (GitHub Actions cron or local script `pull`) writes **normalized, dated JSON
  snapshots committed to the repo**. The snapshot history *is* the "Last Intern Cycle" dataset —
  every day pulled is next year's data.
- Normalized posting fields (minimum): source, company, external id, title, normalized title,
  department, location(s), remote flag, posted/updated date, apply URL, description,
  compensation (if present), first_seen, last_seen, link_verified_at, link_status.
- **Link verification** on every pull: dead/closed postings are removed from active views;
  every visible link must be one that resolved on the latest pull.
- Detect internships (title/description: intern, summer analyst, co-op, etc.) and extract
  class-year eligibility ("rising junior", "graduating 2028", "sophomore program", etc.).
- Classify each posting into **industry** and **career** (rules first, model second).

### 5.2 Intelligence features (the "ML" — keep it real, not decorative)
| Feature | Approach |
|---|---|
| Resume parsing | Text extraction (PDF/DOCX) → structured profile (skills, experience, class year, coursework). |
| Role classification | Keyword/department rules + model fallback → industry, career, internship, eligibility. |
| Fit scoring | Resume ↔ requirements similarity + rule signals → tier. Store matched/missing signals. |
| Email stage classification | Forwarded email → {applied-confirmation, assessment, interview, offer, rejection, other} → match to the right tracker card. |
| Window prediction | From snapshot history: predicted open date per company/role; label confidence honestly. |
| Season strip | Per-industry phase derived from posting-volume history. |

- All model calls go through **one provider interface** configured by env vars, with a
  **deterministic mock provider** so the whole app runs and tests pass **offline** with no keys.
- Never ship invented data as real. Cold-start states must be labeled:
  **"Tracking since Oct 2026"**, "Not enough history yet", etc.

### 5.3 Pay at each level
- Intern pay: from posting compensation fields (Ashby often includes it) and pay ranges in
  descriptions (pay-transparency states).
- Full-time levels (later phase): U.S. Department of Labor public H-1B wage disclosure data.
- Always show as approximate (`~`) with source.

### 5.4 Email forwarding
- Each user gets a unique inbound address. Locally, implement the pipeline behind an interface
  with (a) a **dev tool to paste/upload an email** and (b) **fixture emails** for tests. Wiring a
  real inbound-email provider is a later, isolated step. The app never requests inbox access.

---

## 6. Visual direction

### 6.1 What the human cares about (and what they delegated)
- They care about **color**: the whites, the darks, that purple, the clean gradient style, the
  button coloring. **Expand on the palette thoughtfully — don't just copy it.**
- **Delegated to you (decide during Phase 1 research):** typography, motion system, navigation
  placement, and where the gradient is used. Justify each choice in `DESIGN_DIRECTION.md`.
- References they liked for color treatment: **Raycast**, and **Linear — but light-mode focused**.
- Feel references: **Apple Health / Fitness** (soft, rounded, confident numbers) and **Arc**
  (pastel personality without clutter).
- Density: **balanced** (compact but breathable cards). **No dead padding on the right side** —
  the human hates dashboards that waste the right edge. Right gutter = left gutter; content uses
  the full width.

### 6.2 Colors sampled from `reference/color-reference.png`
| Token | Light | Notes |
|---|---|---|
| bg | `#FFFFFF` | pure white, faint grid texture allowed |
| bg-haze | `#F1EBFC` → `#EBE7FA` | soft lavender radial wash |
| bg-subtle | `#F7F6FF` | near-white lavender |
| ink | `#0E0F1F` | near-black with navy |
| text | `#565360` | body |
| text-muted | `#898891` | captions |
| primary | `#5141D6` | indigo-violet; buttons, key accents |
| gradient | `#5141D6` → `~#A03C8A` | indigo → plum (the italic "ready." in the reference) |
| secondary button | white + hairline border | |

**Dark mode = the reverse of light:** `#0E0F1F`-family becomes the background, white becomes
text, the lavender haze becomes a deep violet glow, primary brightens slightly to keep contrast.
Derive the full dark scale yourself and verify contrast.

**Fit lanes — purple intensity (one family):**
Perfect `#5141D6` · Almost `#8478E3` · Weak `#B9B2EF` · Non-fit `#DCD9E6`
(derive dark-mode equivalents; Perfect must remain the most prominent in both themes).

**Stars — gold (stays gold in both themes):**
Resting `#E3B341` · New glow `#FFD872`. Gold is the complement of violet; let it pop.

Hex values above are **starting points**. You may tune them for contrast and harmony, but log
every change and why in `DESIGN_DIRECTION.md`.

---

## 7. Process — phases with gates (do not skip, do not reorder)

Keep **`PROGRESS.md`** updated at the end of every phase *and* every ~10 minutes of work:
timestamp, current phase, what's done, what's next, blockers, decisions made. Write it for a
human skimming on their phone.

**Phase 0 — Recon.** Inspect the repo: stack, scripts, existing components, test setup, any
`CLAUDE.md`, any `EVANS_GUIDANCE.md`. Use the existing stack. If the repo is empty, choose a
modern TypeScript web stack with a real component system and Playwright for E2E — justify it.
If Evan's guidance is missing, note it in PROGRESS.md and ask the human **once**, then continue
building (it's required before the final gate, not before starting).

**Phase 1 — Deep design research (before any UI code).**
- Study `reference/color-reference.png` closely: how the haze, grid, ink, indigo, gradient word,
  pill badge and two-button pairing work together.
- Research the referenced products' color and surface treatment (Raycast; Linear in light mode;
  Apple Health/Fitness; Arc). Note *specific* techniques, not adjectives.
- Write `DESIGN_DIRECTION.md`: **three genuinely different directions** built on this palette,
  each with a one-paragraph rationale and a quick static mock; pick one and explain why. Define
  tokens (color light/dark, radius scale, spacing scale, shadow/glow, type scale, motion).
- Think creatively about how the **flow** itself can feel new — e.g. how the populate moment,
  the Opened→Applied handoff, the New Stars glow and the season strip could feel distinct —
  while staying calm and fast. Write down the ideas you rejected and why.

**Phase 2 — Data spine.** Schema, adapters (Greenhouse/Lever/Ashby), seed list, normalization,
internship/eligibility detection, classification, link verification, snapshot writer, fixtures
for offline dev. Unit tests for every adapter and parser.

**Phase 3 — Build screens** in this order: tokens & primitives → job card → Home (lanes +
New Stars + season strip) → onboarding → Every Job Listing → Tracker → Stars + detail pages →
Settings → season close (both versions) → empty/zero/error/loading states.

**Phase 4 — Playtest.** Write Playwright journeys for at least these personas and run them in
**light + dark** and **desktop + mobile** widths, capturing screenshots:
1. Freshman, finance + consulting, NYC + remote, skips email forwarding.
2. Sophomore, marketing, Atlanta, with forwarding (fixture emails drive the tracker).
3. Junior who wanders outside targets (triggers "add to targets").
4. Zero-new-roles day.
5. Season close — offer and no-offer.
Then **look at every screenshot yourself** and critique it against sections 6, 8 and 10 like a
harsh senior designer. Log findings in `PROGRESS.md`.

**Phase 5 — Fix → rebuild → re-test loop.** Fix everything found. Re-run all tests and
screenshot journeys. Repeat until a full run produces **zero** findings.

**Phase 6 — Final gate.** Check against section 8 (Evan's guidance), section 10 (harsh rules)
and section 9 (Definition of Done). Must pass **three consecutive complete runs** with no
changes needed between them. Then write a final summary in `PROGRESS.md`.

### When you hit errors
1. Read the full error; reproduce it minimally.
2. Check the relevant docs; form a hypothesis; try the smallest fix.
3. If two approaches fail, step back, log it in PROGRESS.md, and try a different design.
4. **Never** silence errors, skip/disable tests, loosen types to `any`, or delete failing checks
   to get green. Fix the cause.

### When you need permissions
Batch requests, explain each in one line, and prefer actions inside the repo. Never push to a
remote, never touch files outside the repo, never read secrets you don't need.

---

## 8. Evan's guidance

> **Paste Evan's guidance here (or provide `EVANS_GUIDANCE.md`).**
> Claude Code: treat everything in this section as **mandatory**, with the same weight as
> section 10. If it is still empty at the Phase 6 gate, **stop and ask the human** — do not
> sign off without it.

---

## 9. Definition of Done (all must be true, three runs in a row)

- [ ] All four tabs + Settings + onboarding + both season-close versions are built and reachable.
- [ ] Every flow in section 3 works end to end with fixture data **offline**, and with live
      public-API data when online.
- [ ] Fit model obeys section 4, including: career+industry alone never yields Perfect; class
      year is fit not filter; ineligible roles show "Not eligible yet".
- [ ] Denied roles never repopulate (including reposts with new IDs).
- [ ] Opened → Applied works via email fixture *and* via the return prompt.
- [ ] New Stars glow appears for each trigger and clears per card on click.
- [ ] Every visible job link resolved on the latest pull (automated link-check test).
- [ ] Light and dark modes are both complete — no unthemed surfaces.
- [ ] WCAG AA contrast in both themes; full keyboard navigation; visible focus states;
      `prefers-reduced-motion` respected; screen-reader labels on controls.
- [ ] Desktop and mobile layouts both correct; no horizontal scroll; no dead right padding.
- [ ] Zero console errors/warnings in all journeys; typecheck, lint, unit and E2E tests all pass.
- [ ] Home renders in under ~1s locally with 2,000+ listings.
- [ ] All empty, loading, error and zero-roles states are designed, not default.
- [ ] Cold-start/approximate data is labeled honestly everywhere.
- [ ] Section 8 (Evan's guidance) and section 10 (harsh rules) fully satisfied.
- [ ] `PROGRESS.md` has a final summary; `DESIGN_DIRECTION.md` documents every design decision.

---

## 10. Harsh rules (fail any → not done)

**No AI slop:**
- No generic SaaS hero, no "Unlock your potential"/"Supercharge"/"Seamless" copy, no emoji as
  icons, no lorem ipsum, no stock illustrations.
- No gradient on everything. The gradient is a spice: use it where it means something, and be
  able to say why in one sentence.
- No random drop shadows, inconsistent radii, or arbitrary spacing — tokens only.
- No glassmorphism or glow without a purpose. The **only** glows are the gold star halo and
  whatever the chosen direction explicitly justifies.
- No centered-everything layouts on working screens; dashboards are for scanning.
- No fake data presented as real. Demo/fixture data is visibly labeled in dev.

**Calm by design:**
- No streaks, guilt, badges-for-badges' sake, or infinite feeds.
- Notifications only when there's something new. Never "0 new roles."
- The no-offer season close is encouraging and forward-looking, never pitying.

**Trust:**
- Free for students: no paywalls, upsells, or trial UI anywhere.
- The app never requests inbox access; forwarding is opt-in and explained in one sentence.
- Every link goes straight to the employer's own posting and was verified on the latest pull.

**Craft:**
- Copy is plain, short, student-to-student. Numbers are big and confident; labels are small.
- Every interactive element has hover, active, focus and disabled states in both themes.
- Motion is quick and meaningful; nothing animates just to animate.

---

## 11. Optional: pre-approve permissions (for the human)

To let Claude Code run long without stalling on prompts, add an allow-list in the repo's
`.claude/settings.json` — scripts, tests, Playwright, local git commits, and file edits inside
the repo — and deny anything destructive (force-push, deleting outside the repo, reading
secrets). **Check the exact rule syntax in the current Claude Code docs (Settings →
Permissions) before pasting**, since it evolves. Keep `git push` manual so you review before
anything leaves your machine.
