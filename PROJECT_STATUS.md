# Spotted — Project Status

Snapshot date: **2026-07-18**. This file is the source of truth for "what's
built" vs "what's still broken/missing." Update it whenever a major piece
ships or a new issue is found — don't let it drift like the last one did.

## Current database snapshot (live, updated 2026-07-18 ~14:40 UTC — ⚠️ pipeline has been stalled since ~19:50 UTC, see roadmap item 0; numbers below stopped moving around 21:15 UTC)

| Metric | Value |
|---|---|
| Photos (total) | 1,077 — 118 `live` (auto-published), 959 `queued`; 954 still `ai_status=pending` |
| Celebrities | 42 total, 6 published |
| Clothing items | 504 (sourcing: 498 unattempted, 3 sourced, 1 no_source, 2 error — cron just started) |
| Item matches | 302 |
| Products (catalog) | 19 (6 generic seed + 13 real, auto-sourcing now adding more continuously) |
| External posts | 7,425 — 1,096 resolved w/ real photo, 731 no usable image, 5,591 still queued (~19h left) |
| Celebrity brand affinity rows | 375 |

All growth is the automated pipeline (resolve → import → AI-tag →
auto-publish → source → match) running by itself. This table is stale the
moment it's written; treat it as a point-in-time reference. Started the
day at 5 photos / 26 items / 6 products.

---

## What's next — prioritized roadmap (written 2026-07-18)

In priority order, with reasoning. Items 0-2 are done; the rest are open.

### 0. 🚨 Active infra incident — pg_cron jobs failing project-wide ("job startup timeout") — OPEN, discovered 2026-07-18 ~21:15 UTC
Every single cron job on the project (`resolve-articles-every-5min`,
`analyze-photos-every-10min`, `match-products-every-15min`,
`source-products-every-20min`, `ingest-queue-every-30min`,
`process-ingest-queue`) has been failing back-to-back with
`return_message: "job startup timeout"` continuously since at least
19:50 UTC (checked as far back as that; may have started earlier) —
confirmed still failing as of 21:30 UTC, over 90 minutes. **The entire
automated pipeline is stalled**: zero new photos created since 21:15:51
UTC despite ~5,000 unresolved posts in the backlog.

Investigated: not a code issue (started well before today's
`resolve_articles` v5 deploy, and hits every job type equally, not just
one function). Not connection-pool exhaustion (`pg_stat_activity` shows
only ~22 connections, nowhere near a limit). `net.http_request_queue` is
empty (not a backed-up pg_net queue). Postgres logs show a cluster of
`"canceling statement due to statement timeout"` errors around the same
window. Likely candidate: `max_worker_processes = 6` /
`max_parallel_workers = 2` — pg_cron's dynamic per-job background
workers share that same small pool with autovacuum, logical
replication, and the `pg_net` worker, and `cron.max_running_jobs = 32`
implies far more concurrency headroom than 6 worker-process slots can
actually provide. This looks like a Supabase-platform-level resource
ceiling for this project's compute tier, not something fixable via SQL
from the client side (no invasive fix — e.g. restarting/pausing the
project — was attempted; that's a call for the project owner, not
something to do unilaterally on live production infra).

**Next step: needs Supabase support/dashboard investigation, or simply
monitoring to see if it self-clears.** Until it does, the pipeline is
effectively paused — nothing downstream of this is going to move.

### 1. ~~Unclog the AI-tagging bottleneck~~ — DONE (2026-07-18)
With the resolver importing hundreds of photos/day, hourly AI tagging at
20/batch (480/day) had become the pipeline's choke point — 954 photos
pending and rising. Rescheduled: `analyze-photos-every-10min` (2,880/day
capacity) replaces `analyze-photos-hourly`; `match-products-every-15min`
(2,880 items/day) replaces `match-products-hourly`. Backlog should clear
in under a day; capacity now comfortably exceeds inflow.

### 2. ~~Duplicate-look collapse~~ — DONE (2026-07-18)
Multiple outlets syndicate the same agency photo, and the resolver
imported each article separately — so a celebrity's page would show
near-identical looks several times (e.g. several Dua Lipa honeymoon
posts using the same paparazzi set). Root cause: `resolve_articles`
only deduped on exact `source_post_url` (the article link), never on
the underlying image — different articles about the same event each
created their own `photos` row.

**Two-part fix:**
- One-time cleanup migration (`dedupe_duplicate_photo_images`, applied
  directly): found 54 duplicate `(celeb_id, image_url)` groups (137
  rows total, 83 "excess"), 22 of which were already `live` on the
  public site. For each group, kept the photo with the richest AI
  result (most `clothing_items`), tie-broken by already-`live` status
  then earliest `created_at` — deliberately prioritising AI-result
  quality over which duplicate happened to be live first, promoting a
  better `queued` duplicate to `live` if needed so the group never lost
  public visibility. Repointed `external_posts.photo_id` to the keeper,
  deleted the rest. Verified: 0 duplicate groups remaining post-migration.
- Prevention fix in `resolve_articles` (deployed as v5, 21:15:51 UTC):
  before inserting a new photo, now also checks for an existing photo
  with the same `(celeb_id, image_url)`, not just the same
  `source_post_url`, and reuses it instead of creating a duplicate.

**Verification caveat**: live-traffic confirmation is incomplete because
of the infra incident (item 0) — cron runs since the v5 deploy have all
failed to start, so there's been no real opportunity yet to observe v5
processing a genuine syndicated-photo case in production. What *is*
confirmed: every duplicate group found after the deploy has
`created_at` timestamps that predate 21:15:51 UTC (created by the old
code during the gap between the cleanup migration and the v5 deploy),
and zero new photos of any kind have been created since — consistent
with the fix being correct and simply not yet exercised, not with it
being broken. Re-check once item 0 clears and the resolver is running
again.

### 3. Publish more celebrities (instant breadth, near-zero work)
Only 6 of 42 celebrities are published, but the pipeline is importing
content for all of them — the other 36 have looks piling up invisibly.
Either review + publish manually in `/admin/celebrities`, or (consistent
with the auto-publish philosophy) auto-publish any celebrity once they
have ≥3 live looks and a profile photo. The second is a small change to
the pipeline and keeps everything hands-off.

### 4. Affiliate revenue (user action required first)
Every product link is currently a plain retailer link earning nothing.
Blocked on Awin retailer-programme approvals (manual, in the Awin
dashboard — apply to END., ASOS, etc.). Once ≥1 programme is approved:
build the link-rewriter (plain URL → `awin1.com/cread.php?...` tracking
URL for retailers with an approved programme, leave others direct) and
the Awin datafeed sync for bulk catalog. Until then, revenue is zero by
construction.

### 5. Sourcing quality review + catalog scale-up decision
After the sourcing backlog drains (~2 days), review the hit rate in
`debug_log` (`label='source_products'`) and spot-check match quality on
the site. If grounded-search sourcing under-delivers, build the sitemap
bulk-ingester for proven-scrapeable retailers (END./Missoma/Uniqlo
publish full product sitemaps — thousands of SKUs, no AI cost).

### 6. Engagement + growth surface (currently unused)
Comments (0), saved looks (0), newsletter (1 signup, no sends). The
machinery exists but nothing drives usage. Candidates: weekly automated
newsletter ("this week's top looks" from live data), trending page
tuning, and basic SEO checks (sitemap/OG images exist; verify indexing).
Worth doing only after the content+dedupe items above — growth on top of
a feed full of duplicate looks would waste the traffic.

### 7. Ops hygiene (small, whenever)
Retry/clear the 4 `ai_status=error` photos; decide the fate of the
"News Feed" placeholder celebrity; purge `debug_log` periodically (add
a weekly cleanup cron); delete the `awin_test` diagnostic function once
sourcing is stable.

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
       ▼  cron: every 5 min ("resolve-articles-every-5min") — decode link, scrape real
       │  article photo, auto-import into photos (status: queued, ai_status: pending)
       │
       ▼  cron: every 10 min ("analyze-photos-every-10min") — analyze_photo edge function
    clothing_items (category, color, brand_guess, description)
       │  photo AUTO-PUBLISHES (status → live) when a real outfit is found
       │
       ├──▼  cron: every 20 min ("source-products-every-20min") — source_products
       │   Gemini grounded-search finds real UK listings per item; each candidate
       │   URL is fetched + verified (direct, then Jina Reader proxy for
       │   bot-walled retailers) before insertion into products
       │
       ▼  cron: every 15 min ("match-products-every-15min") — match_products edge function
    item_matches ──▶ products (shoppable links, price tiers)
       │
       ▼  Public site — admin panel is now for moderation (hide), not publishing
```

Active cron jobs (verified in `cron.job`, 2026-07-18):

| Job | Schedule |
|---|---|
| `rss-ingest-every-2-hours` | `0 */2 * * *` |
| `ingest-queue-every-30min` / `process-ingest-queue` | `*/30 * * * *` |
| `analyze-photos-every-10min` (was hourly; bumped 2026-07-18 for throughput) | `*/10 * * * *` |
| `match-products-every-15min` (was hourly; bumped 2026-07-18) | `*/15 * * * *` |
| `resolve-articles-every-5min` (added 2026-07-18) | `*/5 * * * *` |
| `refresh-observed-brand-affinity-6h` (added 2026-07-18) | `20 */6 * * *` |
| `source-products-every-20min` (added 2026-07-18) | `*/20 * * * *` |

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

## Build log — issues found & fixed (historical, chronological)

For what's still open, see **"What's next — prioritized roadmap"** near
the top of this file. Everything below is a dated record of problems
diagnosed and fixed during initial buildout — kept for context on *why*
things are built the way they are, not a current task list. Numbering
is chronological-by-discovery, not priority (that's the roadmap's job).

### -1. Photos now auto-publish (2026-07-18 late evening) — supersedes issue 0 below
User explicitly asked for the manual-publish gate to go: "I want the
photos to automatically publish." Changed `analyze_photo` (edge function)
and `/api/process-photo` (Next.js route, kept in sync) so that once AI
finds a real outfit (`items.length > 0`) on a photo that's still
`status='queued'`, it goes straight to `status='live'` in the same
update as `ai_status='done'`. A photo where Gemini found nothing stays
`queued` — never publishes an empty look page. A photo an admin has
explicitly `hidden` is never touched (only auto-publishes from
`queued`), so manual moderation still works, it's just no longer a
required step for normal flow. One-time catch-up: published the 76
photos that were already `done` with real items but stuck `queued`.
Going forward this is fully automatic — the admin "Photos" page is now
for moderation/curation (hide something wrong) rather than a required
publish gate.

### 0. ~~Looks not appearing despite "In the news" showing real photos~~ — FIXED (2026-07-18 evening, now superseded by auto-publish above)
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

**Superseded by auto-publish (issue -1 above):** no manual publish batch
needed anymore — resolved/AI-tagged photos with a real outfit go live on
their own.

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

**Round 2 (2026-07-18 late evening) — the real scale of the gap.** The AI
pipeline had been running for hours in the background and
`clothing_items` had grown from ~108 to **445**, dominated by
`jewellery` (118), `top` (82), `other` (60, mostly non-fashion —
tambourines, phone cases, headphones — not realistically shoppable and
deprioritised), `dress` (49), `jacket` (45). The catalog had zero
jewellery products despite it being by far the largest category, which
is why the user saw "0 matches" everywhere, not just on the C.P.
Company jacket.

Sourced and verified 5 more real products, expanding past END. (which
is streetwear/menswear-leaning, weak on jewellery/dresses) to other
sites confirmed *not* to block automated fetching:
- **Missoma** (UK jewellery brand): Classic Small Hoop Earrings 18ct
  Gold Plated £98, Ancien Ring Sterling Silver £115, Classic Snake
  Chain Necklace Silver £105
- **Uniqlo**: two basic crew-neck tees (black, white) — price couldn't
  be reliably extracted from their page structure, so `price = NULL`
  rather than guessed; the item page already handles this ("See price"
  fallback), so it's an honest real product rather than a fabricated
  price.

Catalog is now 16 products (was 6 this morning). Cleared and
re-ran `match_products` across ~150 of the ~400 then-unmatched items
(the hourly `match-products-hourly` cron — 30/batch — is still working
through the rest and will keep doing so automatically). **Verified
fixed**: the exact "Hat, navy" item from the user's second screenshot
(Dua Lipa) now matches to the real Adsum bucket hat instead of showing
"No matches yet."

**Honest assessment of what's actually needed, since "think long and
hard" was the ask:** matching quality is fundamentally bounded by
catalog size, and catalog size is bounded by how many products can be
verified as real before insertion. Three retailer families now proven
scrapeable (END., Missoma, Uniqlo), plus C.P. Company's own site
(product pages only, not category listings) — each one sourced by
hand: search for a specific real product → fetch it through
`awin_test`'s `fetch_urls` batch mode → confirm price/image → insert.
That's maybe 5-10 products per sourcing session at the current
by-hand pace. Getting meaningful coverage across `dress` (49, zero
coverage), `skirt` (10), `bag` (10), `trousers` (7), `scarf` (7),
`belt` (6), `shoes` (6), `jeans` (3) — none of which have a single
product yet — needs several more rounds like this one, ideally
targeted at retailers that carry that specific category well (e.g.
Whistles/Reiss/& Other Stories for dresses, not tested yet).

**SUPERSEDED (2026-07-18 night): sourcing is now fully automated.**
New `source_products` edge function + `source-products-every-20min`
cron. Per clothing item it: (1) asks Gemini with **Google Search
grounding** (`tools: [{google_search:{}}]`, works on the existing
`GEMINI_API_KEY`) for up to 3 real UK product listings matching the
item's AI description, preferring known-scrapeable retailers;
(2) **verifies every candidate URL** before insertion — direct fetch
with og:title/og:image/structured-price extraction first, then the
**Jina Reader proxy (`r.jina.ai/<url>`)** as fallback, which was
confirmed live to defeat the retailer bot-walls that blocked us (an
ASOS product page returned its real title through Jina after
hard-blocking direct fetches); (3) inserts only verified products,
fires `match_products` for the item immediately, and marks the item
`sourced`/`no_source`/`error` (`clothing_items.sourcing_status` +
`sourcing_attempted_at`) so each item costs exactly one Gemini call
ever — the backlog (~380 shoppable items) drains in ~1.5 days at
4 items/20min, then the cron runs as a cheap no-op on empty batches,
picking up only newly AI-tagged items.

Verified live before scheduling: first batch sourced a real Pandora
"Square Sparkle Halo Ring, Sterling silver, £69" (page-verified price
+ real Pandora CDN image) for a silver-rings jewellery item — the
biggest zero-coverage category. Also caught + fixed in testing: END.
serves soft-404s ("This page could not be found") with HTTP 200, so
the verification bad-title guard was widened; the one bad row it let
through was deleted and its item re-queued. Jina markdown parsing
skips cookie-banner/consent imagery and prefers retailer-hosted
images; markdown-extracted prices are distrusted entirely (candidate
falls back to the search-grounded price or NULL — never a guess).

Cost note: each attempted item = 1 grounded Gemini call. Grounded
search is billed by Google beyond the free daily allowance — worst
case a few hundred calls/day while the backlog drains, then a trickle.
One-time-per-item semantics cap total spend at roughly the number of
shoppable clothing items.

Still-valid longer-term paths (complementary, not required now):
1. **Awin retailer programmes** (still zero joined) — structured bulk
   feeds + affiliate revenue; the only route to thousands of SKUs and
   commission.
2. **Bulk sitemap ingestion** of proven-scrapeable retailers (END.,
   Missoma, Uniqlo publish full product sitemaps) — thousands of real
   SKUs with zero AI spend; worth building if grounded-search hit
   rates disappoint.

Also known but not urgent: `process_unmatched_items_batch()` re-selects
items that got zero matches on a prior attempt (nothing marks a "tried,
found nothing" state), so items in totally-uncovered categories get
retried every cron cycle for no benefit until that category gets real
product coverage. Harmless (just wasted cron cycles), not fixed this
round.

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

### 4. Only 6 of 42 celebrities are published — STILL OPEN, tracked as roadmap #3
36 celebrity records exist but aren't publicly visible. Worth reviewing
whether that's intentional (incomplete profiles) or just backlog. Note:
publishing more celebrities now surfaces looks fast — photos auto-publish
once AI finds a real outfit (issue -1), no manual step needed.

### 7. ~~`/celebrities` directory showed a "looks" count that included unpublished photos~~ — FIXED (2026-07-18)
The count on `/celebrities` used `photos(count)` with no status filter,
so it counted every photo regardless of publish state — e.g. it showed
"62 looks" for Dua Lipa while her actual page said "0 looks" (correctly
filtered to `live`/`approved`). This got a lot more visible once
issue 1's auto-import started creating dozens of `queued` photos per
celebrity. Fixed by filtering the embedded count to
`status in (live, approved)`, matching what the celebrity page itself
shows.

### 5. The product catalog gap (issue 2) now also blocks brand-guess matches — LARGELY RESOLVED by automated sourcing
The celebrity brand-affinity fallback correctly infers likely brands
even with zero product matches, but had nothing to match against in
most categories. The `source_products` automation (see issue 2's
2026-07-18 night update) now fills exactly this gap continuously —
verified live producing a real Pandora ring match for a jewellery item
that previously had none.

### 10. ~~Auto-publish didn't require actual clothing~~ — FIXED (2026-07-18)
User-requested rule: a photo with no clothes visible (e.g. a close-up of
a face) should never publish. The auto-publish gate (issue -1 above) was
checking `items.length > 0`, but the AI's item categories include pure
accessories — `bag`, `sunglasses`, `jewellery`, `hat`, `belt`, `scarf`,
`other` — which can appear alone on a close-up crop with no outfit in
frame at all (earrings + sunglasses on a face shot, say). Such a photo
passed the old gate and went live with nothing to actually shop.

Fixed in both `analyze_photo` (edge function, deployed v43) and
`/api/process-photo` (kept in sync per convention): added
`ACCESSORY_ONLY_CATEGORIES` and a `hasGenuineClothing()` check — a photo
now only auto-publishes if at least one identified item's category is
*not* in that accessory set (i.e. a real garment: dress, top, jacket,
coat, jeans, trousers, skirt, shoes/trainers/boots, suit, bodysuit,
shorts, jumpsuit). Also ran a one-time correction over existing data:
found 9 already-`live` photos whose *only* items were accessory-only
categories (e.g. a Dua Lipa bikini shot tagged just `hat`+`jewellery`, a
Charli XCX Met Gala photo tagged only `other`) and reverted them to
`queued` — data preserved, not deleted, so any that turn out to be a
genuine miscategorisation (AI should have said "dress" not "other") can
be manually republished from `/admin/photos`.

### 8. ~~Duplicate looks from syndicated photos~~ — FIXED (2026-07-18), see roadmap #2 for full writeup
Same-image duplicates across multiple `photos` rows for one celebrity,
caused by `resolve_articles` deduping only on `source_post_url` and not
on the image itself. One-time cleanup migration collapsed 54 groups
(137 rows); prevention fix deployed in `resolve_articles` v5.

### 9. Discovered mid-session: project-wide pg_cron outage ("job startup timeout") — OPEN, tracked as roadmap #0
While verifying the above fix, found every cron job on the project has
been failing to start for 90+ minutes, unrelated to any code change.
See roadmap #0 for full investigation notes.

### 6. Minor: a "News Feed" placeholder occupies a `celebrities` row — STILL OPEN, tracked as roadmap #7
One of the 42 `celebrities` rows (slug `news-feed`) isn't a real
celebrity — likely a catch-all used for unattributed feed content. It's
harmless (correctly skipped by brand-profile seeding, never published)
but worth a decision on whether to keep, hide, or delete it.
