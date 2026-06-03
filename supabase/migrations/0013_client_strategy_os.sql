do $$ begin
  create type public.strategy_action_status as enum (
    'recommended',
    'planned',
    'in_progress',
    'done',
    'paused'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.strategy_action_owner as enum (
    'jumpstart',
    'client',
    'shared'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.strategy_action_priority as enum (
    'low',
    'medium',
    'high',
    'critical'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.client_strategy_profiles (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  positioning text,
  target_audience text,
  offer_focus text,
  brand_voice text,
  editorial_pillars text,
  current_quarter_objectives text,
  monthly_focus text,
  jumpstart_note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.monthly_strategy_briefs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  period_month date not null,
  title text not null default 'Brief mensuel JumpStart',
  executive_summary text,
  wins text,
  learnings text,
  next_focus text,
  client_requests text,
  jumpstart_actions text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, period_month)
);

create table if not exists public.strategy_action_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  rationale text,
  expected_impact text,
  owner public.strategy_action_owner not null default 'jumpstart',
  status public.strategy_action_status not null default 'recommended',
  priority public.strategy_action_priority not null default 'medium',
  due_date date,
  sort_order int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_monthly_strategy_briefs_tenant_period
  on public.monthly_strategy_briefs(tenant_id, period_month desc);

create index if not exists idx_strategy_action_items_tenant_status
  on public.strategy_action_items(tenant_id, status, priority);

alter table public.client_strategy_profiles enable row level security;
alter table public.monthly_strategy_briefs enable row level security;
alter table public.strategy_action_items enable row level security;

create policy client_strategy_profiles_admin_all on public.client_strategy_profiles
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy client_strategy_profiles_select_tenant on public.client_strategy_profiles
  for select using (public.is_tenant_member(tenant_id));

create policy monthly_strategy_briefs_admin_all on public.monthly_strategy_briefs
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy monthly_strategy_briefs_select_tenant on public.monthly_strategy_briefs
  for select using (public.is_tenant_member(tenant_id) and is_published = true);

create policy strategy_action_items_admin_all on public.strategy_action_items
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy strategy_action_items_select_tenant on public.strategy_action_items
  for select using (public.is_tenant_member(tenant_id));
