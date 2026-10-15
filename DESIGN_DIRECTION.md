# Design direction — Fifteen

Fifteen is a daily tool a student opens for fifteen minutes. It has to be scannable in
two seconds, calm enough to open every day, and confident about the one thing that matters:
the link works. Every decision below serves those three.

Working name: **Fifteen** ("15 minutes a day, apply to every hit"). Wordmark is set in Inter
with the numeral "15" in a small indigo→plum tile (the favicon).

---

## 1. Study of `reference/color-reference.png`

What the reference actually does, element by element:

| Element | Technique | What we keep |
|---|---|---|
| Ground | Pure white, with a faint square grid (~48px cells, lines barely above white) visible mostly at the edges | The grid as texture on *chrome-free* moments only (onboarding, populate, season close). Working screens stay plain white: a grid behind dense cards reads as noise. |
| Haze | A soft lavender radial wash (#F1EBFC → #EBE7FA) bleeding in from the top-right, fading to white before it reaches the text | A single haze in the page header region of each tab, never behind cards. It marks "top of page" the way a skylight does. |
| Ink | Near-black with navy (#0E0F1F), heavy weight, tight tracking on the headline | Ink for headings and the big numbers. Body text is a softer grey-violet (#565360). |
| Gradient word | One italic serif word ("ready.") in indigo → plum. Everything else is sans | The gradient appears **only on one word or one number per screen** that carries meaning (see §5). Serif italic is reserved for those same moments. |
| Pill badge | White pill, hairline border, a solid indigo "NEW" chip inside, chevron after | Our "New" badge and the season strip borrow this pill: white, hairline, tiny solid chip. |
| Button pair | Primary = solid indigo fill, white text, ~10px radius, arrow glyph. Secondary = white fill, hairline border, ink text, icon left | Exactly this pairing for every primary/secondary choice ("Applied? Yes / Not yet", "Continue / Skip"). |
| Fine print | Small muted grey line under the buttons | Small muted labels under big numbers ("new today", "verified today"). |

## 2. Research notes (specific techniques, not adjectives)

**Raycast** (raycast.com; checked live in the browser pane on 2026-10-15)
- Surfaces are separated by 1px hairlines and a faint *inner top highlight*, not by shadows. Cards
  read as stacked layers because each is ~4% lighter than the one beneath.
- Color is used as a light source, not paint: a saturated radial glow sits *behind* a product shot;
  the UI chrome itself stays neutral.
- Keyboard-first: every action has a visible shortcut hint in a small key-cap chip.
- → We take: hairline-first separation; color as a meaningful light (only the gold star halo glows);
  key-cap hints on desktop for the four tabs (1–4) and search (/).

**Linear, light mode** (linear.app product UI; the marketing site renders dark by default)
- Light mode is near-white (#FFFFFF content on #F7F8F8-style chrome) with grey-violet secondary text
  and a single brand accent used sparingly for selection and primary actions.
- Density comes from 13–14px UI text, 28–32px rows, and tight but consistent 4px-grid spacing.
- Issue rows are not cards: a list with hairline dividers and hover fills. Status is a small colored
  glyph, not a colored row.
- Headings use tight negative tracking at display sizes; UI text is untracked.
- → We take: 14px base UI type; hairline borders (#E8E6F0) over shadows; status as a small glyph or
  dot; selection = soft indigo fill (#EEEBFC), not a bold border.

**Apple Health / Fitness**
- Big rounded, bold numerals with a tiny uppercase or muted unit label beside or under them.
- Each metric owns one color, consistently, across rings, charts and labels.
- Cards are generously rounded (~16–20px) on a slightly tinted ground; one idea per card.
- → We take: big confident numbers with small labels ("2 Perfect · 3 Almost · 6 Weak" is set as
  numbers first); one color per meaning (purple intensity = fit, gold = stars, green = applied).
  We do **not** take rings: rings imply a daily goal to close, which becomes a streak. Calm rule.

**Arc**
- Personality from pastel color and a few playful details (wavy edges, a sticker-like logo), while
  the working surface stays empty and quiet.
- Spaces each get a pastel; the color tells you *where* you are without labels.
- → We take: pastel personality only where the student is not working (onboarding, the populate
  moment, season close). The lavender haze per tab header is our version of "the color tells you
  where you are", kept to one hue family.

## 3. Three directions

Each has a static mock in `docs/mocks/` (HTML; screenshots in `docs/mocks/*.png`).

### A. Lavender Paper — **chosen**
White paper, hairline structure, one lavender haze per page header, indigo for action, a purple
intensity ramp for fit, and gold as the only light source (stars). Big ink numerals for counts.
Gradient and serif italic appear once per screen at most, on the word or number that matters.
It's the reference's language applied to a dense working tool: the marketing page's restraint,
Linear's density, Apple's numbers. It scales to 2,000 listings because the cards are quiet; the
only loud things are the things that should be (a Perfect count, a glowing star).
Mock: `docs/mocks/a-lavender-paper.html`.

### B. Ink Console
Raycast-inspired: an ink sidebar and command bar even in light mode, content on white, glows behind
key areas, keyboard everything (⌘K to search companies, J/K to move through lanes).
Strong for power users and fast triage. Rejected because (1) most students open this on a phone
between classes, where a command palette is a hidden feature; (2) an ink sidebar fights the brief's
"Linear, light-mode focused" reference and makes the app feel like a developer tool; (3) multiple
glows would break the rule that the gold halo is the only glow.
Mock: `docs/mocks/b-ink-console.html`.

### C. Soft Rings
Apple Fitness-inspired: each lane is a pastel-tinted card with a progress ring ("4 of 9 applied"),
stats as big rounded tiles, Arc-like pastel per tab. Friendly and very legible.
Rejected because rings and "x of y" progress turn applying into a goal to close, which drifts into
streak/guilt territory (§10 Calm by design); and four tinted lanes plus gold stars put five hues on
one screen, diluting the purple-intensity = fit signal.
Mock: `docs/mocks/c-soft-rings.html`.

**What A borrows from B and C:** key-cap hints and `/` to search (B, desktop only); big numerals with
small labels (C).

## 4. Flow ideas — kept and rejected

| Moment | Kept | Rejected (and why) |
|---|---|---|
| Populate moment | After the last onboarding step, Home builds in place: the four lane counts count up from 0 over ~600ms while cards rise in, lane by lane, Perfect first. One line in serif italic: "*Your* fifteen minutes start here." The count-up is the earned part: it shows work was done on *their* resume. | Confetti (celebrates nothing yet); a fake progress bar with "Analyzing…" steps (theatre; the ranking takes milliseconds and we shouldn't pretend otherwise). |
| Opened → Applied | A quiet bottom toast-sized prompt (not a modal) on return: "Applied to *Summer Analyst* at Northwind? **Yes** / Not yet". One at a time, never stacked. Yes slides the card's status pip from Opened (outline) to Applied (filled green) and drops it into the Tracker. | A modal that blocks the page; a swipe-to-apply game (brief bans forced Apply/Skip games). |
| New Stars glow | A gold card with a breathing halo (box-shadow opacity cycling over 3.2s). Clicking a glowing card sets it to resting gold immediately and reveals *what* was new, inline. Reduced motion: a static, brighter halo. | A red notification dot (urgency, not news); glowing every star at once (one card at a time keeps it meaningful). |
| Season strip | A single pill line under the filter chips, scoped to the active industry chip: `Finance · Peak · week 3 of 8`, with a hairline progress tick showing where in the season you are. Cold start says so: `Finance · 38 open · tracking since Oct 2026`. | A global calendar of all industries (too much); a countdown clock (anxiety). |
| Zero-roles day | Calm sentence in the "New today" slot with season context, lanes still show existing roles. | Hiding the lanes; "Check back tomorrow!" copy. |
| Season close | Offer: full celebration card with the gradient on the company name and a shareable recap (PNG). No offer: "Keep going." Private, numbers of what moved, and when starred companies open next. | Sad-face illustrations; "Don't give up!" copy; sharing prompts on the no-offer version. |

## 5. Where the gradient is used (and why, in one sentence each)

1. **The Perfect count in "New today"** — it's the single number a student opens the app to see.
2. **The serif accent word in onboarding/populate** ("*Your* fifteen minutes…") — it marks the one moment the app introduces itself, like the reference's "ready.".
3. **The company name on the Offer card** — the outcome the whole season was for.
4. **The favicon tile** — brand mark.

Nowhere else: buttons are solid indigo (as in the reference), lanes use flat purple steps.

## 6. Decisions on the delegated areas

**Typography.** Inter Variable for everything (UI clarity at 13–14px, tabular numerals for counts,
`cv11` single-storey a is off to keep it neutral). Display sizes use −0.02em tracking and weight 700,
like the reference headline. Instrument Serif Italic only for the gradient accent word (it matches the
reference's italic "ready."). Both are self-hosted via @fontsource so the app works offline.

**Navigation.** Desktop/tablet: a top bar with the wordmark left, the four tabs as a segmented pill
group, Settings as an icon button right. Four peer tabs fit one row and leave the full width to
content (a sidebar would cost 200–240px of the width the student needs for lanes). Mobile: a bottom
tab bar (thumb reach, iOS/Android convention) and Settings in the top bar.

**Motion.** Three durations (120/200/320ms), one ease-out curve. Motion only to explain a change of
state: card status changes, a card leaving a column, lanes populating, the halo breathing. No
parallax, no hover lifts. `prefers-reduced-motion`: all transitions drop to 0ms, the populate
stagger is skipped, the halo is static and brighter.

**Density.** Balanced: cards are 2 lines + a meta line (~92px tall), 12px gap. Lanes are columns on
desktop (4 across in the ¾ area), stacked sections on mobile. The content area spans the full
viewport width minus equal gutters (24px desktop, 16px mobile): **no max-width container**, so the
right edge is never dead space.

## 7. Tokens

Source of truth: `src/app/styles/tokens.css`. `src/app/styles/tokens.test.ts` parses it and checks
WCAG AA for every text/surface pair in both themes.

### Color (light / dark)

| Token | Light | Dark | Use |
|---|---|---|---|
| bg | #FFFFFF | #0E0F1F | page |
| bg-subtle | #F7F6FF | #12132A | inset areas |
| haze-1 / haze-2 | #F1EBFC / #EBE7FA | violet 20% / plum 12% glow | header wash |
| surface | #FFFFFF | #161729 | cards |
| surface-2 | #F7F6FF | #1E1F35 | chips, tray |
| surface-3 | #EFEDFA | #26273F | pressed / column bg |
| border | #E8E6F0 | #2A2B42 | hairlines |
| border-strong | #D4D1E2 | #3A3B57 | inputs, secondary buttons |
| ink | #0E0F1F | #F4F3FA | headings, numbers |
| text | #565360 | #C9C7D6 | body |
| text-muted | #66646F | #A3A1B3 | captions |
| primary | #5141D6 | #6C5CE7 | primary buttons, selection |
| primary-text | #5141D6 | #B4ABF7 | links, accent text |
| primary-soft | #EEEBFC | #2A2650 | selected chip fill |
| plum | #A03C8A | #D277BD | gradient end |
| lane-perfect | #5141D6 | #8E80F5 | brightest in dark too |
| lane-almost | #8478E3 | #6E62C9 | |
| lane-weak | #B9B2EF | #4A4489 | |
| lane-nonfit | #DCD9E6 | #2E2D45 | |
| gold | #E3B341 | #E3B341 | star resting |
| gold-glow | #FFD872 | #FFD872 | star halo |
| gold-ink | #7A5A10 | #FFD872 | gold text |
| success | #2F7D4F | #7BD3A2 | Applied |
| danger | #B42318 | #FF9B8F | errors, Denied |

### Changes from the brief's starting hexes (logged)
| Token | Brief | Now | Why |
|---|---|---|---|
| text-muted | #898891 | #66646F | #898891 is 3.50:1 on white (fails AA for captions). #66646F is 5.81:1 on white and 4.98:1 on the haze. |
| primary (dark) | "brighten slightly" | #6C5CE7 fill / #B4ABF7 text | White on #6C5CE7 is 4.86:1 (AA for button labels); #B4ABF7 text is 7.76:1 on dark surfaces. One brighter value couldn't serve both fills and text. |
| lane ramp (dark) | derive | #8E80F5 → #2E2D45 | Inverted so Perfect is the brightest step on dark, keeping it the most prominent lane. |
| gold-ink | — | #7A5A10 light / #FFD872 dark | Gold #E3B341 as text is ~2:1 on white; gold labels use a deep gold ink. Gold itself stays gold in both themes. |
| gradient (dark) | #5141D6 → #A03C8A | #9D92F5 → #E08BBF | The light gradient is ~2.5:1 on #0E0F1F; the dark version keeps the hue path and passes 7:1 at its darkest stop. |

### Radius
6 (chips inside cards) · 10 (buttons, inputs, chips) · 14 (cards) · 20 (sheets, the star cards) · pill (badges, season strip). Buttons use 10px like the reference.

### Spacing
4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56. Gutter 24px desktop / 16px mobile.

### Elevation (two levels, no random shadows)
- shadow-1: hairline ring + 1px soft drop. Cards.
- shadow-2: soft 32px drop + hairline. Popovers, the return prompt, menus.
- Glow: only the gold star halo (`--gold-halo`, `--gold-halo-strong`).

### Type scale
12 · 13 · 14 (base) · 16 · 18 · 22 · 28 · 36 · 48 · 64. Numbers: 700 weight, tabular-nums, −0.02em.

### Motion
fast 120ms (hover/press) · base 200ms (state change) · slow 320ms (populate step, column moves) ·
breathe 3200ms (star halo). Ease-out `cubic-bezier(.2,.8,.2,1)`.

### Interaction states (every interactive element, both themes)
hover: one surface step up (or primary-hover) · active: one more step + no transform ·
focus-visible: 2px `--focus` outline with 2px offset · disabled: 45% opacity, `not-allowed`, no hover.

## 8. Clean pass (human feedback, 2026-10-15: the Lavender Paper mock was "way too messy")

The mock stacked boxes inside boxes and put four markers on every card. The shipped UI follows these
rules instead; each one is enforced in `src/app/styles/base.css` and the components.

| Rule | Why |
|---|---|
| **No box inside a box.** Lanes are a header with a 3px colored rail, then rows divided by hairlines (Linear's list grammar). No tinted column containers. | Nested borders were the main source of noise. |
| **One quiet meta line per role.** Company, title, then `city · age · pay ✓ Verified today`. | Four badges per card competed with the title. |
| **At most one colored marker per row.** "New" is an indigo dot + word; Opened is muted text; Applied is green with a check. | Color should mean one thing at a glance. |
| **Fit label only where no lane says it** (Every Job Listing, company pages). | "Perfect fit" inside the Perfect lane was redundant. |
| **"Why" is a small info icon** in the top row; the explanation opens inline. | A text link on the meta line wrapped and dangled. |
| **Gold surfaces only for a starred company with news.** Resting stars are a plain row with a gold star glyph. | Three gold boxes made the column shout even on quiet days. |
| **Header in two tiers:** filters + season strip as one plain row; numbers below; legend in small type. | The mock's single band held five competing elements. |
| **No key-cap hint chips in the nav.** Shortcuts (1–4, /) still work and are documented here. | Decoration for a feature most students won't use. |
| **Every layout uses the full width.** Settings flows into two columns on wide screens. | The human hates dead right-side space. |

The mocks in `docs/mocks/` show the pre-clean-pass direction and use illustrative numbers.
