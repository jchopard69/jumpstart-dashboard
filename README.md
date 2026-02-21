# Jumpstart Dashboard

Next.js + Supabase social performance dashboard (Meta/Instagram+Facebook, LinkedIn, TikTok) with daily sync and per-tenant analytics.

## Local setup

1) Install deps

```bash
npm install
```

2) Configure environment variables (see below)

3) Run migrations in your Supabase project

```bash
supabase db reset
# or run the SQL files in supabase/migrations manually
```

4) Start the app

```bash
npm run dev
```

## Environment variables

Required for app runtime:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (base URL used for internal cron/admin triggers)
- `ENCRYPTION_SECRET` (used to encrypt stored OAuth tokens)
- `CRON_SECRET` (used by Vercel Cron + admin-triggered sync endpoints)

Optional:

- `DEMO_MODE` (`true` to enable demo badges/UI)
- `CRON_ALLOW_QUERY_SECRET` (`true` to accept `?secret=` query param for cron endpoints; discouraged in production)

Platform OAuth / API config:

- Meta: `META_APP_ID`, `META_APP_SECRET`
- LinkedIn: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- TikTok: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`
- YouTube: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Twitter/X (optional): `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`

## Cron jobs (Vercel)

Vercel Cron uses GET requests. This project expects an `Authorization: Bearer $CRON_SECRET` header.

- `/api/cron/sync` (daily social sync)
- `/api/cron/refresh-tokens` (daily OAuth refresh)

If you cannot send headers (local testing only), set `CRON_ALLOW_QUERY_SECRET=true` and call:

- `/api/cron/sync?secret=...`
- `/api/cron/refresh-tokens?secret=...`

## Useful scripts

- `npm run build` (production build)
- `npm run lint` (eslint; install `eslint` as a dev dependency if your environment does not include it)
- `npm run security-check` (tenant isolation self-check helper)

## Notes

- Database schema + RLS policies live in `supabase/migrations`.
- Cron endpoints are protected by `CRON_SECRET` and should never be exposed without auth.
- If you see `@next/swc-darwin-arm64` missing on macOS, reinstall without `--omit=optional` (the build script also attempts to restore SWC from the npm cache).
