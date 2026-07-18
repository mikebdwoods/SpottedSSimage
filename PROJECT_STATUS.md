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

**Remaining verification:** once the backlog resolves, import a batch via
`/admin/feed` and confirm real photos flow end-to-end (import → AI →
publish → public site). If the user still sees icon placeholders on the
live site after this, that's browser/CDN cache of the old (deleted)
pages — the DB contains no icon photos at all.

### 2. Product catalog is empty — shopping links are barely meaningful
Only 6 seed products exist in `products` against 26 real `clothing_items`,
yielding 16 `item_matches`. That's not enough real inventory for the
"shop the look" feature to deliver real value. Needs a real product
catalog — either a retailer feed/API integration or manual curation — to
make match quality meaningful at scale.

### 3. Feed Inbox has never been used to import real content
7,425 external posts have been scraped via RSS, but **0 have been
imported into `photos`**. Until 2026-07-18 this was actually impossible
to do usefully — imports could only produce Google News icons (see
issue 1). Now that article resolution is live, importing a batch via
`/admin/feed` once the backlog resolves is the highest-leverage step for
actually populating the site. The pipeline downstream of import
(AI tagging, product matching, publishing) has so far only been proven
against 5 hand-verified photos.

### 4. Only 6 of 42 celebrities are published
36 celebrity records exist but aren't publicly visible. Worth reviewing
whether that's intentional (incomplete profiles) or just backlog.
