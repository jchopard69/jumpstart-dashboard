# Jumpstart Dashboard Audit (Feb 21, 2026)

## Current architecture summary
- **Frontend**: Next.js App Router with server components + Tailwind UI; dashboard shows global KPIs first, then platform drill-down (tables, charts, top posts, ads summary).
- **Backend**: Next.js API routes for OAuth, cron sync, exports, admin ops. Supabase (Postgres + Auth + Storage) with SSR clients.
- **Data**: Social metrics and posts stored in `social_daily_metrics` + `social_posts`; ads in `ad_*` tables. Tokens encrypted via `ENCRYPTION_SECRET`.
- **Auth/RLS**: Supabase Auth + middleware gate on `/client` and `/admin`; RLS policies for tenant isolation; admin uses service role client for privileged queries.
- **Sync**: Cron endpoints for daily sync + token refresh; platform connectors for Meta/LinkedIn/TikTok/YouTube/Twitter; sync logs stored in `sync_logs`.

## What works already
- Solid multi-tenant schema with RLS policies and indexes for key metrics tables.
- Dashboard UI is cohesive with KPI aggregation, trends, and platform breakdowns.
- OAuth flows implemented for major platforms; tokens encrypted at rest.
- Cron endpoints exist for sync + token refresh; admin UI supports manual triggers.
- Export endpoints (PDF/CSV) and document management are present.

## Gaps / risks
### Auth
- Profile creation relies on admin actions; no automatic “create profile on signup” trigger. Risk: users without a profile are locked out.
- `profiles` selection during login is by email; if email changes in Auth, dashboard routing could mis-route.

### Cron
- Cron auth needs to match Vercel behavior (GET + Authorization header). Query-secret usage should be opt-in only.
- Cron schedules are only defined for core sync/refresh; ads sync/backfill are manual only (OK for MVP but should be clear).

### Sync
- `ENCRYPTION_SECRET` is required; missing it breaks sync silently for encrypted accounts (logs exist but no alerting).
- Global sync for all tenants can be heavy; no queueing or rate-limited concurrency controls beyond basic per-platform limits.

### Data model
- `social_accounts` lacks a uniqueness constraint on `(tenant_id, platform, external_account_id)` which can lead to duplicates.
- `social_daily_metrics` stores mutable follower values; backfills adjust history (OK, but no audit trail).

### RLS
- Service-role use in admin paths bypasses RLS (expected) but increases blast radius if those routes are exposed.
- Storage policies rely on folder naming by tenant UUID; uploads must be consistent to avoid leakage.

### UI
- Admin settings still mention query-secret cron usage; should reflect Authorization header.
- No operational visibility on cron auth failures (only logs).

## MVP Definition of Done (next week)
- Daily sync and token refresh run reliably in production (Vercel Cron GET + auth).
- Dashboard loads aggregated KPIs with drill-down by platform for Meta/LinkedIn/TikTok.
- No hardcoded secrets in repo; env vars documented.
- `npm run build` succeeds in CI; lint is non-interactive.
- Basic admin health view shows recent sync status/errors.

## Prioritized fix list (max 10)
1) Align Vercel Cron config with Authorization header and remove hardcoded query secret.
2) Add env/setup documentation (Supabase, cron, OAuth, encryption).
3) Ensure lint runs non-interactively (explicit config; add eslint dependency in CI if needed).
4) Validate build on CI/macOS (SWC optional deps installed; avoid `npm install --omit=optional`).
5) Add an automatic profile creation path on signup (DB trigger or server action).
6) Add uniqueness constraint for `social_accounts` per tenant/platform/external ID.
7) Add runtime alerts or admin UI notices for failed cron auth / missing secrets.
8) Clarify manual-only jobs (ads sync/backfill) and add guardrails in admin UI.
9) Add job-level metrics (rows processed, duration) to `sync_logs` for visibility.
10) Add backfill throttling/queueing to avoid API rate limits on large tenants.
