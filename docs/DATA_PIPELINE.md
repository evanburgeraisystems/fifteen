# Data pipeline: "the database on GitHub"

Fifteen has no server and no database. Listings come from the **public, keyless job-board APIs that
companies use to power their own career pages**. A daily job pulls them, normalizes and verifies them,
and **commits dated JSON snapshots to this repo**. The app reads those files.

```
data/seed/companies.json ──► adapters ──► normalize ──► internships only ──► verify links ──► snapshot ──► history
   (one line per company)    greenhouse     RawJob →         isInternship        GET each          dated JSON    rebuilt from
                             lever          Posting          (all role           apply URL         + latest      every snapshot
                             ashby                           families)
```

## Sources

| Source | Endpoint (no key) | Apply link we store |
|---|---|---|
| Greenhouse | `GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true&pay_transparency=true` | `absolute_url` (employer page or `job-boards.greenhouse.io`) |
| Lever | `GET https://api.lever.co/v0/postings/{slug}?mode=json` | `hostedUrl` (`jobs.lever.co/...`) |
| Ashby | `GET https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true` | `jobUrl` (`jobs.ashbyhq.com/...`) |

Every stored link is the employer's own ATS posting page, never an aggregator.

Notes on the shapes (verified against the live APIs):

- **Greenhouse** `content` is HTML that was entity-escaped once; we decode one level. `pay_transparency=true` is an
  additive public flag that returns `pay_input_ranges` (min/max in **cents**, one entry per pay zone); we collapse the
  zones to lowest-min / highest-max. `first_published` is the posted date, `updated_at` the last edit.
- **Lever** has no "updated" timestamp (`createdAt` is epoch ms). The description is split across `description`, `lists[]`
  and `additional`; we stitch them. `salaryRange` is only present when the employer fills it in.
- **Ashby** `isRemote` is `true` for many hybrid jobs, so `workplaceType` wins. Compensation arrives as typed
  `summaryComponents`; we use the `Salary` component (equity/bonus are ignored). Ashby answers **HTTP 200 for a closed
  posting id**, so link verification reads the page body (see below).

## The known gap: Workday, Taleo, iCIMS, Avature

Most banks, the Big 4 and large corporates hire through **Workday, Oracle Taleo, iCIMS or Avature**. None of them
exposes a comparable public, keyless board API: Workday's career-site JSON is tenant-specific and undocumented,
Taleo/iCIMS/Avature are session- or HTML-driven. So **Goldman, JPMorgan, the Big 4 and similar employers are not in
the dataset**, and we do not pretend otherwise. What is covered today: trading firms, many asset managers and
boutiques, fintech, high-growth tech with business internships, consumer brands, media, marketplaces, some
real-estate and energy companies, and a handful of advisory/research firms.

The seam for fixing this is `SourceAdapter` in `src/core/ingest/adapter.ts`:

```ts
interface SourceAdapter {
  source: 'greenhouse' | 'lever' | 'ashby';
  fetchJobs(seed: CompanySeed, fetchImpl: typeof fetch): Promise<RawJob[]>;
}
```

A future adapter (an employer-provided feed, a licensed aggregator, a sanctioned scraper) implements `fetchJobs`,
is added to `SourceId` in `types.ts` and to the `ADAPTERS` map in `src/core/ingest/index.ts`, and gets seed rows.
Normalization, link checks, snapshots and history are shared and need no changes.

## Daily run

`.github/workflows/pull.yml` runs at 11:00 UTC (and on demand) and calls `npm run pull` (`node scripts/pull.ts`),
then commits `public/data`. Locally:

```
npm run pull                       # full live run, writes public/data/**
node scripts/pull.ts --only coinbase,ramp   # partial: writes to a temp dir, never to the committed data
node scripts/pull.ts --offline     # recorded fixtures, no network (CI/dev): temp dir
node scripts/pull.ts --limit 10 --write     # partial run into public/data anyway (you probably don't want this)
npm run verify:links               # re-verify latest.json in place, drop dead links, rebuild history
```

Partial and offline runs write to `%TEMP%/fifteen-data-*` unless you pass `--out DIR` or `--write`, because a
snapshot holding only a few companies would make history think every other role had closed.

Steps in one run (`src/core/ingest/pipeline.ts`):

1. Load and validate `data/seed/companies.json` (duplicate slugs, unknown sources/industries fail loudly).
2. Pull each board (6 in parallel, 2 retries on network errors/429/5xx). **One failing board never fails the run**:
   it is recorded in `sources[]` (`ok: false`, `error`), and its postings from the last snapshot are carried over and
   re-verified so the role does not falsely "close" in history. If *every* board fails, nothing is written.
3. Normalize every job to a `Posting` and keep only `isInternship` ones, **across all role families** (the app
   filters to business; the architecture is for every role).
4. Verify every apply link (below). Only `linkStatus: "ok"` postings are written.
5. Write `public/data/snapshots/YYYY-MM-DD.json` and `latest.json` (identical), `index.json`, and rebuild
   `history.json` from all dated snapshots.

## Adding a company

Append one line to `data/seed/companies.json`:

```json
{"slug":"acme-capital","name":"Acme Capital","source":"greenhouse","token":"acme","industry":"finance","careersUrl":"https://job-boards.greenhouse.io/acme"}
```

- `token` is the board token: the path segment in `job-boards.greenhouse.io/{token}`, `jobs.lever.co/{slug}` or
  `jobs.ashbyhq.com/{org}`.
- Probe it before committing: the API must return HTTP 200 with a jobs array
  (`curl https://boards-api.greenhouse.io/v1/boards/acme/jobs`). A name that returns 404 on all three is on another ATS.
- Check it is the company you meant (a short token can belong to a different company with the same word).
- `slug` is permanent: it is part of every posting id (`source:slug:externalId`) and dedupe key. Do not rename it.
- `industry` is a hint used when posting text is ambiguous; set it honestly.

## What a snapshot contains

`Snapshot` (see `src/core/types.ts`): `dataset: "live"`, `date`, `pulledAt`, `trackingSince`, `sources[]`
(one `SourceRunResult` per company) and `postings[]` (one `Posting` each, serialized one per line so git diffs stay
readable). `sources[].kept` counts postings that survived link verification; when postings were dropped or a board
failed, `sources[].error` carries a short note (for example `1 dead link dropped`) while `ok` stays `true`.
`ok: false` means the board itself could not be read.

## Link verification (`src/core/ingest/verify.ts`)

Every visible link must be one that resolved on the latest pull. Each apply URL is fetched with `GET`,
`redirect: "follow"`, a browser-like User-Agent, 10 s timeout, at most 8 requests in flight and 4 per host
(job-boards.greenhouse.io is polite-limited; it started returning 403 to us after two back-to-back bursts of 350).
Network failures, timeouts and 5xx are retried twice (0.5 s, 1 s) before they count. First matching rule wins:

| Observed | Result |
|---|---|
| Network failure or timeout (after retries) | `error` |
| HTTP 404 or 410 | `dead` |
| HTTP 401/403/406/429 (the employer site or its CDN blocks bots; CloudFront alternates 403 and 406) | ask the ATS: is the job still on the company's board listing? yes → `ok`, no → `dead`, can't tell → `error` |
| Any other HTTP 4xx, or 5xx (after retries) | `error` |
| Final URL has `error=true` (Greenhouse closed job → board) | `dead` |
| Final URL path+query lacks the job id (redirected elsewhere) | `dead` |
| Ashby page body contains `"posting":null` (Ashby answers 200 for closed ids) | `dead` |
| Otherwise | `ok` |

Details worth knowing:

- "Ask the ATS" is one board-listing request per company, memoised (and free right after a pull, because the pull
  just read every board). It is how Coinbase, Pinterest and CloudFront-fronted Greenhouse pages stay verifiable when
  they answer scripts with 403: the page can't be fetched, but the board still lists the job.
- A live Greenhouse job whose *employer-site* page is broken (GSA Capital's website 404s every `gh_jid` link) is
  re-pointed at its Greenhouse-hosted page (`job-boards.greenhouse.io/{token}/jobs/{id}`), also the employer's own
  ATS page, when that resolves.
- `dead` and `error` postings are removed from the snapshot entirely (counts live in `sources[]`); `error` means
  "could not confirm", so it is treated as not visible.
- `node scripts/verify-links.ts` re-runs this on `latest.json` in place, and for Greenhouse postings on employer
  domains it also checks the board listing, because a closed job there can keep its `gh_jid` in the URL and still
  answer 200.

## The "Last Intern Cycle" dataset

Because snapshots are committed daily and never rewritten, **the git history of `public/data/snapshots/` is a dataset**:
for every role, the day it first appeared, the days it stayed open, the day it closed, and its pay. Next year, "Last
Intern Cycle" is just last year's snapshots. `history.json` is the aggregate view, rebuilt from all dated snapshots:

- `roles[]`: one per `dedupeKey` (company + normalized title + cycle, which survives reposts with new ids).
  `opened` is the earlier of first-seen and the ATS posted date; `closed` is `null` while the role is in the newest
  snapshot, otherwise the last day it was seen.
- `volume[]`: per date and industry, `open` (live internship postings that day) and `opened` (those first seen that day).
  Zero rows are omitted.
- `trackingSince` is the first snapshot date. **Everything before it is unknown**: on day one every posting has
  `firstSeen` = that day, so the app must say "Tracking since ..." and "Not enough history yet" rather than
  presenting day-one volume as a season.

## Caveats worth knowing

- `cycle` comes from an explicit year in the title, else the summer the posting was **first seen open** for (Aug-Dec ->
  next summer). The ATS posted date is deliberately not used: evergreen reqs carry dates years old (a Palantir internship
  "posted" in 2016 is open today, for next summer), and `firstSeen` is carried between days so the cycle never flips.
- Lever has no update timestamp; Greenhouse `first_published` can be older than the role's current requisition.
- A Greenhouse job on an employer domain that closes may still return 200 on its own site; only
  `verify-links.ts` (which consults the board listing) catches that.
- Some boards hand out links on a hosting wrapper (for example `app.careerpuck.com` for DV Trading). They are what the
  employer's board publishes as its posting URL, so we keep them as is.
- Pay is only as good as the employer's field: ATS field first, then pay-transparency text in the description.

## Tests

`npx vitest run src/core/ingest` (no network; recorded fixtures in `src/core/ingest/__fixtures__/`, a temp dir for
snapshot IO). Fixtures are trimmed real responses from Coinbase (Greenhouse), Belvedere Trading + D&B (Lever) and
Ramp (Ashby).
