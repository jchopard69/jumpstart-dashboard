-- Ads data model (Meta + LinkedIn)

do $$ begin
  create type public.ad_platform as enum ('meta','linkedin');
exception when duplicate_object then null; end $$;

create table if not exists public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  platform public.ad_platform not null,
  external_account_id text not null,
  account_name text,
  status text,
  currency text,
  timezone text,
  token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, platform, external_account_id)
);

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  platform public.ad_platform not null,
  external_campaign_id text not null,
  name text,
  status text,
  objective text,
  start_time timestamptz,
  end_time timestamptz,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, platform, ad_account_id, external_campaign_id)
);

create table if not exists public.ad_campaign_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  platform public.ad_platform not null,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  external_campaign_id text not null,
  date date not null,
  impressions int,
  reach int,
  clicks int,
  spend numeric,
  ctr numeric,
  cpc numeric,
  cpm numeric,
  conversions int,
  results int,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, platform, ad_account_id, external_campaign_id, date)
);

create index if not exists idx_ads_accounts_tenant on public.ad_accounts(tenant_id);
create index if not exists idx_ads_campaigns_tenant on public.ad_campaigns(tenant_id);
create index if not exists idx_ads_metrics_tenant_date on public.ad_campaign_metrics_daily(tenant_id, date);

alter table public.ad_accounts enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_campaign_metrics_daily enable row level security;

create policy ads_accounts_admin_all on public.ad_accounts
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy ads_accounts_select_tenant on public.ad_accounts
  for select using (public.is_tenant_member(tenant_id));

create policy ads_campaigns_admin_all on public.ad_campaigns
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy ads_campaigns_select_tenant on public.ad_campaigns
  for select using (public.is_tenant_member(tenant_id));

create policy ads_metrics_admin_all on public.ad_campaign_metrics_daily
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy ads_metrics_select_tenant on public.ad_campaign_metrics_daily
  for select using (public.is_tenant_member(tenant_id));
