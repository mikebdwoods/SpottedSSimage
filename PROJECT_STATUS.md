# Spotted — Project Status

Snapshot date: **2026-07-18**. This file is the source of truth for "what's
built" vs "what's still broken/missing." Update it whenever a major piece
ships or a new issue is found — don't let it drift like the last one did.

## Current database snapshot (live, updated 2026-07-18 evening)

| Metric | Value |
|---|---|
| Photos (total) | 194 — 22 `live`, 172 `queued`; 23 `ai_status=done`, 171 `pending` |
| Celebrities | 42 total, 6 published |
| Clothing items | 108 |
| Item matches | 20 |
| Products (catalog) | 11 (6 generic seed + 5 real END. products) |
| External posts (news feed) | 7,425 — 190 now imported into photos (was 0 this morning) |
| Celebrity brand affinity rows | 375 |

(This morning's snapshot was 5 photos / 26 items / 6 products / 0 imported —
the pipeline fixes shipped today changed all of this substantially.)

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

### 0. ~~Looks not appearing despite "In the news" showing real photos~~ — FIXED (2026-07-18 evening)
Not a pipeline bug — the auto-import from issue 1/3 below was working
correctly, but every photo it creates lands as `status='queued'`
(intentional editorial gate, admin must publish). Nobody had published
anything yet, so celeb pages legitimately showed "0 looks" while photos
piled up unpublished in the background. **Published the 17 photos that
were fully AI-tagged with real identified clothing items** (excluded 3
more that Gemini correctly flagged as "no clearly visible outfit" —
right call, publishing those would've meant look pages with nothing on
them). Confirmed: Dua Lipa now shows 7 live looks.

**Also found and fixed while investigating**: 16 of those photos (and
their `external_posts`) had been contaminated by a different
Google-News-style bug — AOL.com articles all resolve to the *same*
generic site-wide fallback image (`s.yimg.com/.../og-image.png`, AOL's
default share card, not the actual article photo), which is exactly the
blue "AOL.com" logo box the user's screenshot showed in "In the news".
`resolve_articles`' `isBlockedImageHost` only blocked specific *hosts*
(Google's icon domains); it had no defence against a legitimate
publisher CDN serving a generic placeholder. Fixed with a
`looksGeneric()` filename-pattern check (`og-image`, `default-image`,
`social-share`, `placeholder`, `fallback`, bare `logo.*`) alongside the
host blocklist. The 16 tainted photos (zero had real clothing_items —
Gemini had already correctly rejected the ones it got to) were deleted
and their posts reset to `resolve_status='no_image'` so they stop
retrying. This class of bug — a publisher's platform-wide default image
slipping through — will keep recurring per-publisher; the pattern list
is a heuristic, not exhaustive.

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

### 2. Product catalog is thin — shopping links are still limited
Started at only 6 generic seed products against dozens of real
`clothing_items`. User-reported: a Liam Gallagher jacket correctly
AI-read as "C.P. Company" was matching to a ZARA jacket and a Gucci
jacket — the only two jacket-shaped products that existed — sharing
nothing with the real garment but category.

**Awin checked 2026-07-18**: token works (publisher account `2640528`
"Spotted", auto-discovered via `/accounts`), but the account has joined
**zero real retailer programmes** — only Awin's own administrative one.
Awin requires per-retailer approval (a manual step in their dashboard)
before any product feed is accessible. User decided to defer this
("leave the affiliates for now") and go direct-to-retailer instead.

**Direct-to-retailer sourcing tried 2026-07-18**: attempted to scrape
real product pages (title/price/image) from ASOS, Zara, and H&M —
**all three actively block automated requests** (ASOS: HTTP/2 connection
resets + explicit "Access Denied"; Zara/H&M: 403 on every URL tried).
This is a hard wall, not a fixable bug — those retailers' bot protection
rejects datacenter traffic regardless of user-agent. **END. (endclothing.com)
does not block it** and was usable. C.P. Company's own site (Salesforce
Commerce Cloud) also responds but renders its product grid client-side,
so only direct product URLs work, not category-page scraping.

Added **5 real, verified, direct-link products from END.** (no affiliate
tracking, `source_affiliate_network = NULL`), each confirmed live with a
real price and image before insertion:
- C.P. Company Air-Net Arm Lens Jacket (Olive), £255
- Diemme Alberone Chelsea Boot (Black), £197
- Our Legacy Cyphre Chelsea Boot (Black), £281
- Adsum Daisy Bucket Hat (Light Olive), £19
- Gentle Monster Pesh Sunglasses (Black), £219

Cleared and regenerated all `item_matches` against the improved catalog.
**Verified fixed**: the Liam Gallagher jacket's primary match is now the
real C.P. Company jacket itself (`match_type: exact`, `score: 0.83`),
correctly outranking the old ZARA/Gucci fallbacks which remain as lower
`similar` options rather than being deleted.

Catalog is still thin relative to the ~108 `clothing_items` now in the
system (most categories — dresses, jeans, jewellery, trousers, tops —
still have zero real products). Two ways to grow it further:
(a) get Awin retailer programmes approved, which unlocks structured
feed data instead of scraping; (b) keep sourcing via END. + other
scraping-friendly sites/brand-direct stores. The diagnostic function
`supabase/functions/awin_test` now doubles as a URL-verification tool
(`fetch_urls` array in its POST body) for this — safe to delete once a
proper `sync_products` function exists.

Also partially mitigated: the misleading "Top pick" badge (previously
applied to any category-only match regardless of relevance) is now
gated on match score — see `CONFIDENT_MATCH_SCORE` in the item page.

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
