-- Score snapshots: persist JumpStart Score over time for trend analysis
create table if not exists public.score_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  snapshot_date date not null,
  global_score integer not null check (global_score between 0 and 100),
  grade text not null,
  sub_scores jsonb not null default '[]'::jsonb,
  period_days integer not null default 30,
  created_at timestamptz not null default now(),
  unique (tenant_id, snapshot_date)
);

create index idx_score_snapshots_tenant_date on public.score_snapshots (tenant_id, snapshot_date);

alter table public.score_snapshots enable row level security;

create policy "Admin full access on score_snapshots"
  on public.score_snapshots for all
  using (public.is_agency_admin())
  with check (public.is_agency_admin());

create policy "Tenant members can read score_snapshots"
  on public.score_snapshots for select
  using (public.is_tenant_member(tenant_id));

-- Tenant goals: agency sets performance targets per client
create table if not exists public.tenant_goals (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  followers_target integer,
  engagement_rate_target numeric(5,2),
  posts_per_week_target integer,
  reach_target integer,
  views_target integer,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.tenant_goals enable row level security;

create policy "Admin full access on tenant_goals"
  on public.tenant_goals for all
  using (public.is_agency_admin())
  with check (public.is_agency_admin());

create policy "Tenant members can read tenant_goals"
  on public.tenant_goals for select
  using (public.is_tenant_member(tenant_id));
