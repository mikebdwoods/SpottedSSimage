# Spotted — UK Celebrity Fashion Discovery

Discover what UK celebrities are wearing and shop the look for less.
Next.js 15 (App Router) + Supabase (`spotted-db`, project `pecwegnjigpayzsjvmif`) + Vercel.

> **See [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) for a current build vs.
> open-issues snapshot** — what's actually live, current DB stats, and the
> active list of known problems. This README covers architecture; that file
> covers where things stand right now.

## How the site works

**Visitor journey:** Homepage → Celebrity page → Photo (look) → Clothing item → Buy via retailer links.

| Route | Purpose |
|---|---|
| `/` | Hero, latest looks, celebrity grid, merch, newsletter |
| `/celebrities` | A–Z directory of published celebrities |
| `/celebrity/[slug]` | Profile, looks grid, merch, "In the news", related celebs |
| `/celebrity/[slug]/photo/[id]` | A look: photo + AI-identified clothing items + comments + save |
| `/celebrity/[slug]/item/[id]` | One item: shoppable product matches in price tiers |
| `/looks` | All looks, filterable by celebrity and category |
| `/category/[slug]` | Items by category (dress, bag, shoes, …) |
| `/news` | Celebrity news feed from RSS ingestion |
| `/trending`, `/search`, `/account` | Discovery, search, saved looks + comments |

## The content pipeline (fully automated)

```
Google News RSS ──(cron: every 2h)──▶ external_posts (7,400+ posts)
       │
       ▼  admin imports the good ones (/admin/feed, bulk or single)
    photos (status: queued, ai_status: pending)
       │
       ▼  cron: hourly at :05 — analyze_photo edge function (Claude Vision)
    clothing_items (category, color, brand_guess, description)
       │
       ▼  cron: hourly at :15 — match_products edge function (relevance scoring)
    item_matches ──▶ products (shoppable links, price tiers)
       │
       ▼  admin publishes (/admin/photos, single or batch)
    Public site
```

- **`analyze_photo`** (Supabase edge function): downloads the photo, sends it
  to an AI vision model, parses identified clothing into `clothing_items`.
  Tries **Gemini** (`gemini-2.5-flash`, free tier w/ billing enabled) first via
  `GEMINI_API_KEY`; falls back to **Claude** (`claude-sonnet-4-6`) via
  `ANTHROPIC_API_KEY` if Gemini fails and a Claude key is present. `ai_summary`
  records which provider produced each result. Self-healing: billing/rate-limit/
  quota/API errors return the photo to `pending` for automatic retry. With
  neither key configured, photos stay `pending` — never fabricated placeholder
  data.
- **`match_products`**: scores products against each item (category synonyms +
  brand + colour); only creates matches with a genuine connection.
- Photo statuses: `queued` → (`approved`) → `live` (public) / `hidden`.
  Public pages show `live` + `approved`.
- AI statuses: `pending` → `processing` → `done` / `error`.

## Admin (`/admin`, requires `user_roles.role = 'admin'`)

- **Dashboard** — stats incl. Feed Inbox backlog and AI queue
- **Photos** — status filters, publish/hide, run AI, batch publish, batch AI (20/click)
- **Feed Inbox** — browse news posts, bulk-select → "Import + AI"
- **Upload / Import URL** — add photos manually
- **Celebrities** — add/edit, publish/unpublish, delete (cleans up everything)
- **Items** (via photo detail) — edit AI results, manage product matches
- **Merch / Newsletter / Comments** — management pages

## Environment variables

| Where | Name | Purpose |
|---|---|---|
| Vercel | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server reads (RLS applies) |
| Vercel | `SUPABASE_SERVICE_ROLE_KEY` | `/api/process-photo` writes |
| Vercel | `NEXT_PUBLIC_SITE_URL` | Absolute URLs, OG images, internal API calls |
| Vercel | `GEMINI_API_KEY` | Instant "Run AI" from admin, free tier via [aistudio.google.com](https://aistudio.google.com) |
| Vercel | `ANTHROPIC_API_KEY` | Optional upgrade/fallback if Gemini fails |
| Vercel | `INTERNAL_API_SECRET` | Auth for `/api/process-photo` (any random string) |
| Supabase edge secrets | `GEMINI_API_KEY` | Hourly cron AI analysis — **required** for the pipeline to run |
| Supabase edge secrets | `ANTHROPIC_API_KEY` | Optional fallback if Gemini fails/hits quota |

## Development

```bash
npm install
cp .env.local.example .env.local   # or fill .env.local manually
npm run dev
```

`supabase/functions/` holds the deployed edge function sources (Deno —
excluded from the Next.js tsconfig). Deploy via Supabase MCP/CLI.
`scripts/` holds one-off SQL (run in the Supabase SQL editor).

## Operational notes

- Deploys: push to `main` → Vercel auto-deploy.
- Cron jobs (pg_cron in Supabase): ingest queue every 30 min, photo AI hourly
  at :05 (20/batch), product matching hourly at :15 (30/batch), RSS ingest
  every 2 h.
- RLS is enforced on every table; admin writes require `is_admin()`.
  SECURITY DEFINER admin functions all check `is_admin()` internally.
