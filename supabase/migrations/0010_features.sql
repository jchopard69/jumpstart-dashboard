-- =====================================================
-- Migration 0010: Notifications, Report Schedules,
--                 Content Calendar, Audience Demographics
-- =====================================================

-- ============================
-- 1. Notifications & Alerts
-- ============================
do $$ begin
  create type public.notification_type as enum (
    'sync_failure',
    'account_disconnect',
    'metric_drop',
    'score_drop',
    'info'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type public.notification_type not null default 'info',
  title text not null,
  message text,
  metadata jsonb default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_tenant_read
  on public.notifications(tenant_id, is_read, created_at desc);

alter table public.notifications enable row level security;

create policy notifications_admin_all on public.notifications
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy notifications_select_tenant on public.notifications
  for select using (public.is_tenant_member(tenant_id));

create policy notifications_update_tenant on public.notifications
  for update using (public.is_tenant_member(tenant_id));

-- ============================
-- 2. Report Schedules (email)
-- ============================
do $$ begin
  create type public.report_frequency as enum ('weekly', 'monthly');
exception when duplicate_object then null; end $$;

create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  frequency public.report_frequency not null default 'weekly',
  recipients text[] not null default '{}',
  is_active boolean not null default true,
  last_sent_at timestamptz,
  next_send_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_report_schedules_tenant
  on public.report_schedules(tenant_id);
create index if not exists idx_report_schedules_next_send
  on public.report_schedules(next_send_at) where is_active = true;

alter table public.report_schedules enable row level security;

create policy report_schedules_admin_all on public.report_schedules
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy report_schedules_select_tenant on public.report_schedules
  for select using (public.is_tenant_member(tenant_id));

-- ============================
-- 3. Content Calendar
-- ============================
do $$ begin
  create type public.calendar_post_status as enum ('idea', 'draft', 'planned', 'published');
exception when duplicate_object then null; end $$;

create table if not exists public.content_calendar (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  description text,
  platform text, -- nullable = cross-platform
  planned_date date,
  planned_time time,
  status public.calendar_post_status not null default 'idea',
  tags text[] default '{}',
  color text, -- hex color for UI
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_calendar_tenant_date
  on public.content_calendar(tenant_id, planned_date);

alter table public.content_calendar enable row level security;

create policy content_calendar_admin_all on public.content_calendar
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy content_calendar_select_tenant on public.content_calendar
  for select using (public.is_tenant_member(tenant_id));

create policy content_calendar_insert_tenant on public.content_calendar
  for insert with check (public.is_tenant_member(tenant_id));

create policy content_calendar_update_tenant on public.content_calendar
  for update using (public.is_tenant_member(tenant_id));

create policy content_calendar_delete_tenant on public.content_calendar
  for delete using (public.is_tenant_member(tenant_id));

-- ============================
-- 4. Audience Demographics
-- ============================
create table if not exists public.audience_demographics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  platform text not null,
  dimension text not null, -- 'age', 'gender', 'country', 'city'
  value text not null,     -- e.g. '25-34', 'female', 'FR', 'Paris'
  percentage numeric not null default 0,
  count int,
  fetched_at timestamptz not null default now(),
  unique (tenant_id, social_account_id, platform, dimension, value)
);

create index if not exists idx_audience_demographics_tenant
  on public.audience_demographics(tenant_id, platform);

alter table public.audience_demographics enable row level security;

create policy audience_demographics_admin_all on public.audience_demographics
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy audience_demographics_select_tenant on public.audience_demographics
  for select using (public.is_tenant_member(tenant_id));
