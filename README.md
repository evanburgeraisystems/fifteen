# Fifteen

Internship recruiting for college freshmen through juniors: **15 minutes a day, apply to every hit.**
Free for students. Every link goes straight to the employer's own posting and was verified on the latest pull.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. The app loads live listings when `public/data/snapshots/latest.json`
exists and has business internships; otherwise it loads the labeled demo dataset.

Pick a dataset explicitly with a query parameter (remembered for the tab):

| URL | Data |
|---|---|
| `/?dataset=live` | Real postings from public Greenhouse, Lever and Ashby boards |
| `/?dataset=demo` | 2,520 fictional postings with a year of history (labeled "Demo data") |
| `/?dataset=demo-zero` | The demo with zero new roles today |

## Data

```bash
npm run pull               # live pull: all seed companies, link verification, snapshot + history
npm run pull -- --offline  # same pipeline on recorded fixtures (no network)
npm run verify:links       # re-verify links in the latest snapshot
npm run demo-data          # regenerate the deterministic demo dataset
```

Snapshots are committed under `public/data/snapshots/` (one file per day). The snapshot history is the
"Last Intern Cycle" dataset. See `docs/DATA_PIPELINE.md` for sources, the seed list, the
Workday/Taleo gap and link-verification rules. `.github/workflows/pull.yml` runs the pull daily.

## Checks

```bash
npm run typecheck
npm run lint
npm test          # unit tests (Vitest)
npm run e2e       # Playwright journeys: 4 projects (desktop/mobile × light/dark)
```

## Model provider

Rules run first everywhere. "Model second" calls (role classification fallback, email stage, resume
profile) go through one interface in `src/core/provider`:

| Env var | Values |
|---|---|
| `FIFTEEN_MODEL_PROVIDER` | `mock` (default, deterministic, offline) or `http` |
| `FIFTEEN_MODEL_ENDPOINT` | URL that accepts `POST {task, input}` and returns the same JSON shape |

## Layout

| Path | What |
|---|---|
| `src/core/` | Pure TypeScript shared by the pipeline and the app: types, taxonomy, signals, fit model, windows/seasons, stars, pay, notifications, classifiers, ingest adapters, email + resume parsing |
| `src/app/` | React app: screens, components, store, styles (`styles/tokens.css` is the token source) |
| `scripts/` | Pull, link verification, demo generator, resume fixture generator |
| `e2e/` | Playwright journeys and fixtures (persona resumes, forwarded emails) |
| `DESIGN_DIRECTION.md` | Design research, directions, tokens, and every design decision |
| `PROGRESS.md` | Build log and final summary |
