# Spotted — Project Status

Snapshot date: **2026-07-18**. This file is the source of truth for "what's
built" vs "what's still broken/missing." Update it whenever a major piece
ships or a new issue is found — don't let it drift like the last one did.

## Current database snapshot (live, queried 2026-07-18)

| Metric | Value |
|---|---|
| Photos (total) | 5 — all `status='live'`, all `ai_status='done'` |
| Celebrities | 42 total, **6 published** |
| Clothing items | 26 |
| Item matches | 16 |
| Products (catalog) | 6 (seed data only) |
| Merch products | 6 |
| External posts (news feed) | 7,425 — **0 imported into photos** |
| Comments | 0 |
| Saved looks | 0 |
| Newsletter signups | 1 |

The two numbers that matter most right now: **only 5 real photos exist**,
and **none of the 7,425 scraped news posts have been imported yet**. Almost
everything described as "built" below is a working pipeline with almost no
content flowing through it.

---

## What's built

### Public site
Next.js 15 App Router, deployed on Vercel from `main` (auto-deploy on push).

| Route | Purpose |
|---|---|
| `/` | Hero, latest looks, celebrity grid, merch, newsletter signup |
| `/celebrities` | A–Z directory of published celebrities |
| `/celebrity/[slug]` | Profile, looks grid, merch, "In the news", related celebs |
| `/celebrity/[slug]/photo/[id]` | A look: photo + AI-identified clothing items + comments + save |
| `/celebrity/[slug]/item/[id]` | One item: shoppable product matches in price tiers |
| `/looks` | All looks, filterable by celebrity and category |
| `/category/[slug]` | Items by category (dress, bag, shoes, …) |
| `/news` | Celebrity news feed from RSS ingestion |
| `/trending`, `/search` | Discovery + search |
| `/account` | Saved looks + comment history (auth required) |
| `/about`, `/contact`, `/privacy`, `/terms`, `/unsubscribe` | Static/support pages |
| `/auth/login`, `/auth/callback`, `/auth/signout` | Supabase auth flow |

### Admin panel (`/admin`, requires `user_roles.role = 'admin'`)

| Page | Purpose |
|---|---|
| Dashboard | Stats incl. Feed Inbox backlog and AI queue depth |
| Photos (`/admin/photos`, `/admin/photos/[id]`) | Status filters, publish/hide, run AI (single + batch of 20), edit AI results |
| Feed Inbox (`/admin/feed`) | Browse the 7,425 scraped news posts, bulk-select → "Import + AI" |
| Upload (`/admin/upload`) | Add a photo manually by file upload |
| Import URL (`/admin/import`) | Add a photo manually by pasting an image URL |
| Celebrities (`/admin/celebrities`, `/[id]`) | Add/edit, publish/unpublish, delete (cascades cleanup) |
| Items (`/admin/items`, `/[id]`) | Review AI-identified clothing items, manage product matches |
| Merch (`/admin/merch`) | Manage merch product listings |
| Newsletter (`/admin/newsletter`) | View signups |
| Comments (`/admin/comments`) | Moderate comments |

### Content pipeline (automated, cron-driven)

```
Google News RSS ──(cron: every 2h, "rss-ingest-every-2-hours")──▶ external_posts (7,425 posts)
       │
       ▼  admin imports the good ones via /admin/feed (bulk or single)
    photos (status: queued, ai_status: pending)
       │
       ▼  cron: hourly at :05 ("analyze-photos-hourly") — analyze_photo edge function
    clothing_items (category, color, brand_guess, description)
       │
       ▼  cron: hourly at :15 ("match-products-hourly") — match_products edge function
    item_matches ──▶ products (shoppable links, price tiers)
       │
       ▼  admin publishes via /admin/photos (single or batch)
    Public site (status → live)
```

Active cron jobs (verified in `cron.job`, 2026-07-18):

| Job | Schedule |
|---|---|
| `rss-ingest-every-2-hours` | `0 */2 * * *` |
| `ingest-queue-every-30min` / `process-ingest-queue` | `*/30 * * * *` |
| `analyze-photos-hourly` | `5 * * * *` |
| `match-products-hourly` | `15 * * * *` |
| `resolve-articles-every-5min` (added 2026-07-18) | `*/5 * * * *` |
| `refresh-observed-brand-affinity-6h` (added 2026-07-18) | `20 */6 * * *` |

### AI vision pipeline (`analyze_photo` Supabase edge function + `/api/process-photo` Next.js route)

- **Primary provider: Google Gemini** (`gemini-2.5-flash`) via `GEMINI_API_KEY`.
  Switched from Claude-only earlier in the project after Claude billing
  blocked progress; Gemini's free tier (with billing enabled on the linked
  Google Cloud project) is now the default path.
- **Fallback provider: Claude** (`claude-sonnet-4-6`) via `ANTHROPIC_API_KEY`,
  used only if Gemini fails and a Claude key is configured. Both providers'
  error messages are surfaced together on double failure (fixed this
  session — previously Gemini failures were silently swallowed by the
  fallback).
- `ai_summary` records which provider produced each result (`gemini`,
  `claude`, or `claude-fallback`).
- **Self-healing retries**: transient errors (rate limit, quota,
  5xx, "overloaded") reset the photo to `ai_status='pending'` so the hourly
  cron retries automatically, with the reason kept visible in `ai_summary`
  (`"Will retry: ..."`). Permanent errors go to `ai_status='error'`.
- With no API key configured at all, photos are left `pending` — the
  function never fabricates placeholder clothing data.
- `match_products` scores catalog products against each clothing item
  (category synonyms + brand + colour) and only creates a match when
  there's a genuine connection — it does not force matches to pad numbers.

### Celebrity brand-affinity knowledge base (added 2026-07-18)
Product matching used to go blank whenever the AI vision pass couldn't
read a brand off a garment (no visible logo — the common case for plain
jeans, tees, etc). Now it falls back to what that celebrity is actually
known to wear:

- New table `celebrity_brand_affinity` (celeb_id, category, brand,
  confidence, source, evidence_count). Two sources feed it:
  - **`observed`** — aggregated from the celebrity's own AI-tagged
    `clothing_items.brand_guess` history via
    `refresh_observed_brand_affinity()` (SQL function, cron every 6h at
    `:20`). The most trustworthy signal — it comes from real photos of
    that person.
  - **`ai_seed`** — general-knowledge brand associations from Gemini/Claude
    (new `build_brand_profile` edge function), conservative and
    category-specific (e.g. Bella Hadid → Chopard jewellery 0.8, Chrome
    Hearts tops 0.5). Exists so a brand-new celebrity with zero photos
    still has a fallback. Fires automatically when a celebrity is added
    (`addCelebrity` action) and can be re-run per-celeb from
    `/admin/celebrities/[id]` ("Rebuild brand profile").
- **Backfilled for all 41 existing real celebrities** (363 affinity rows;
  the 42nd celebrity row, "News Feed", is a non-celebrity placeholder used
  for unattributed feed content and correctly got nothing).
- `match_products` only uses the guess when `brand_guess` is null (never
  overrides an actual AI read), scores it lower than a confirmed brand
  match, and writes the guess to new `clothing_items.inferred_brand` /
  `inferred_brand_confidence` columns rather than conflating it with
  `brand_guess`.
- UI never states a guess as fact: item pages show "Possibly {brand}" in
  a dashed pill, and matches sourced this way get a "Style guess" badge
  instead of "Exact match"/"Top pick".
- **Verified end-to-end**: an Olivia Rodrigo dress item with no visible
  brand correctly inferred "Vivienne Westwood" (her highest-confidence
  `dress` affinity, 0.65). It produced zero product matches only because
  the 6-row seed catalog (issue 2 above) has no dresses at all — the
  inference and write-back worked correctly; there's just nothing to
  match against yet.

### Data cleanup done this session

Removed 148 junk/placeholder photo rows that had accumulated from earlier
seed/test data — broken `lh3.googleusercontent.com` avatar URLs (118) and
`picsum.photos` Lorem Picsum placeholders (~9), 42 of which were
`status='live'` and actually visible on the public site. This is what
took `photos` from 153 rows down to 5 genuinely real, verified photos.
The 5 remaining photos have all been re-processed through Gemini and
produce accurate, specific results (e.g. correctly read "C.P. Company"
branding off a jacket, "brat" merch text off a top).

### Security / infra

- RLS enforced on every table; admin writes require `is_admin()`.
- All `SECURITY DEFINER` admin functions check `is_admin()` internally.
- Supabase project: `spotted-db` (`pecwegnjigpayzsjvmif`).
- Deploys: push to `main` → Vercel auto-deploy. GitHub repo
  `mikebdwoods/SpottedSSimage`.

---

## What still needs addressing

### 1. ~~Site shows Google News icons instead of real photos~~ — ROOT CAUSE FOUND & FIXED (2026-07-18)
The "junk" placeholder photos weren't seed data — they were the **Google
News logo**, and the pipeline itself was creating them. Google News RSS
never includes the article's real photo (its `media:content` is always
the Google News icon) and its links are encrypted
`news.google.com/rss/articles/CBMi...` redirects, so 7,397 of 7,425
`external_posts` had the icon as their image and no publisher URL.
Every Feed Inbox import copied that icon straight into `photos` — which
is exactly what the user's screenshots showed. Deleting the junk photos
earlier only treated the symptom.

**The fix (all deployed):**
- New `resolve_articles` edge function: decodes each Google News link to
  the real publisher article via Google's own `batchexecute` endpoint
  (fetch splash page → extract signature/timestamp → POST to decode),
  then scrapes the article's `og:image`/`twitter:image`. Verified live:
  Pitchfork, Rolling Stone etc. links now resolve to real CDN photo URLs.
- `external_posts` gained `resolve_status` / `resolve_error` /
  `resolved_at`; cron `resolve-articles-every-5min` works through the
  backlog 25 at a time, newest first (~24 h to clear 7,394 posts).
  Rate-limit responses pause the batch and retry next run.
- Feed Inbox now only shows **resolved** posts (real photos), with a
  counter for how many are still resolving.
- Import actions hard-refuse any post whose image host is
  `lh3.googleusercontent.com` / `news.google.com` / `gstatic.com`, so a
  placeholder can never become a photo again.
- **`resolve_articles` now auto-loads every successfully resolved post
  straight into the Looks pipeline** (`photos`, `status='queued'`,
  `ai_status='pending'`) instead of waiting for a manual Feed Inbox
  click — admin publish is still the gate before anything goes public.
  AI runs via the existing hourly cron (20/batch) rather than firing
  immediately, so a 25-post resolve batch doesn't burst Gemini. The 81
  posts already resolved before this existed were backfilled the same
  way in one pass.

**Remaining verification:** watch `/admin/photos` over the next few hours
as the 81 backfilled + ongoing resolved photos get AI-tagged, then
publish a batch and confirm they render correctly on the public site.

### 2. Product catalog is empty — shopping links are barely meaningful
Only 6 seed products exist in `products` against 26 real `clothing_items`.
Confirmed live and user-reported: a Liam Gallagher jacket correctly
AI-read as "C.P. Company" got matched to a ZARA "Leather Effect Jacket"
and a Gucci "Leather Biker Jacket" — the only two jacket-shaped products
in the entire catalog — because there's no C.P. Company product to match
and nothing closer available. That's not enough real inventory for the
"shop the look" feature to deliver real value. Needs a real product
catalog — either a retailer feed/API integration or manual curation — to
make match quality meaningful at scale.

Partially mitigated 2026-07-18: the misleading "Top pick" badge (which
was applied to that Gucci jacket despite it sharing nothing but category
with the real garment) is now gated on match score, so a bare
category-only match no longer gets badged as a confident recommendation
— see `CONFIDENT_MATCH_SCORE` in the item page. The underlying gap
(nothing genuinely close to match against) still needs a real catalog.

**Awin account connected 2026-07-18** (`AWIN_API_TOKEN` secret, publisher
account `2640528` "Spotted", auto-discovered via `/accounts` — no need for
a separately-configured publisher ID secret). Confirmed live: the token
works, but **the account has joined zero real retailer programmes** —
only Awin's own administrative programme (id 3). Awin requires applying
to and being approved by each retailer's affiliate programme
individually (Selfridges, ASOS, Zara, END., etc.) before their product
feed becomes accessible — this is a manual step in the Awin dashboard,
not something that can be automated from here. **Nothing can be synced
until at least a few programmes are joined.** A throwaway diagnostic
function (`supabase/functions/awin_test`) confirms credentials and lists
joined programmes — safe to delete once real sync exists. Rakuten not
yet connected (user said "we can add more later").

Next step once programmes are joined: build a `sync_products` edge
function pulling each joined programme's Awin datafeed, generating real
`awin1.com` tracking links (format
`https://www.awin1.com/cread.php?awinmid={merchantId}&awinaffid=2640528&clickref=&p={destinationUrl}`),
and upserting into `products`.

### 3. ~~Feed Inbox has never been used to import real content~~ — FIXED (2026-07-18)
7,425 external posts have been scraped via RSS but, until issue 1 was
fixed, importing them could only ever produce Google News icons — so
nothing had been imported. Now `resolve_articles` auto-imports every
resolved post into `photos` (see issue 1). 81 photos already created
this way, AI-tagging in progress via the hourly cron; thousands more
will follow as the resolve backlog clears over the next ~24h. Admin
publish remains the gate before anything goes public.

### 4. Only 6 of 42 celebrities are published
36 celebrity records exist but aren't publicly visible. Worth reviewing
whether that's intentional (incomplete profiles) or just backlog. Note:
now that resolve_articles auto-imports (issue 1/3), publishing more
celebrities will surface a lot of queued-but-unpublished looks fairly
fast (e.g. Dua Lipa already has 66 auto-imported photos, 0 published).

### 7. ~~`/celebrities` directory showed a "looks" count that included unpublished photos~~ — FIXED (2026-07-18)
The count on `/celebrities` used `photos(count)` with no status filter,
so it counted every photo regardless of publish state — e.g. it showed
"62 looks" for Dua Lipa while her actual page said "0 looks" (correctly
filtered to `live`/`approved`). This got a lot more visible once
issue 1's auto-import started creating dozens of `queued` photos per
celebrity. Fixed by filtering the embedded count to
`status in (live, approved)`, matching what the celebrity page itself
shows.

### 5. The product catalog gap (issue 2) now also blocks brand-guess matches
The new celebrity brand-affinity fallback (above) correctly infers likely
brands even with zero product matches, because the catalog has nothing
in most categories to match against — confirmed live on an Olivia
Rodrigo dress item. This makes populating a real product catalog even
more valuable: it would immediately light up matches for both
AI-confirmed brands and celebrity-style-guess brands at once.

### 6. Minor: a "News Feed" placeholder occupies a `celebrities` row
One of the 42 `celebrities` rows (slug `news-feed`) isn't a real
celebrity — likely a catch-all used for unattributed feed content. It's
harmless (correctly skipped by brand-profile seeding, never published)
but worth a decision on whether to keep, hide, or delete it.
