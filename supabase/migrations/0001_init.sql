-- Enable extensions
create extension if not exists "pgcrypto";

-- Enums
create type public.user_role as enum ('agency_admin','client_manager','client_user');
create type public.platform as enum ('instagram','facebook','linkedin','tiktok','youtube');
create type public.auth_status as enum ('active','revoked','expired','pending');
create type public.document_tag as enum ('contract','brief','report','other');
create type public.sync_status as enum ('success','failed','running');

-- Tables
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'client_user',
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  platform public.platform not null,
  account_name text not null,
  external_account_id text not null,
  auth_status public.auth_status not null default 'pending',
  token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.social_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  platform public.platform not null,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  date date not null,
  followers int,
  impressions int,
  reach int,
  engagements int,
  likes int,
  comments int,
  shares int,
  saves int,
  views int,
  watch_time int,
  posts_count int,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, platform, social_account_id, date)
);

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  platform public.platform not null,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  external_post_id text not null,
  posted_at timestamptz,
  url text,
  caption text,
  media_type text,
  thumbnail_url text,
  media_url text,
  metrics jsonb,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, platform, social_account_id, external_post_id)
);

create table if not exists public.collaboration (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  shoot_days_remaining int not null default 0,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.upcoming_shoots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shoot_date timestamptz not null,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  tag public.document_tag not null default 'other',
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  platform public.platform not null,
  social_account_id uuid references public.social_accounts(id) on delete set null,
  status public.sync_status not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  error_message text,
  rows_upserted int
);

-- Indexes
create index if not exists idx_profiles_tenant on public.profiles(tenant_id);
create index if not exists idx_social_metrics_tenant_date on public.social_daily_metrics(tenant_id, date);
create index if not exists idx_social_posts_tenant on public.social_posts(tenant_id, posted_at);
create index if not exists idx_documents_tenant on public.documents(tenant_id, created_at);
create index if not exists idx_sync_logs_tenant on public.sync_logs(tenant_id, started_at);

-- Helper functions for RLS
create or replace function public.current_role()
returns public.user_role
language sql
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_agency_admin()
returns boolean
language sql
stable
as $$
  select coalesce((select role = 'agency_admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_tenant_member(tenant uuid)
returns boolean
language sql
stable
as $$
  select coalesce((select tenant_id = tenant from public.profiles where id = auth.uid()), false);
$$;

-- RLS
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_daily_metrics enable row level security;
alter table public.social_posts enable row level security;
alter table public.collaboration enable row level security;
alter table public.upcoming_shoots enable row level security;
alter table public.documents enable row level security;
alter table public.sync_logs enable row level security;

-- tenants policies
create policy tenants_admin_all on public.tenants
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy tenants_select_own on public.tenants
  for select using (public.is_tenant_member(id));

-- profiles policies
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid() or public.is_agency_admin());

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid() or public.is_agency_admin());

create policy profiles_insert_admin on public.profiles
  for insert with check (public.is_agency_admin());

-- social_accounts policies
create policy social_accounts_admin_all on public.social_accounts
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy social_accounts_select_tenant on public.social_accounts
  for select using (public.is_tenant_member(tenant_id));

-- social_daily_metrics policies
create policy metrics_admin_all on public.social_daily_metrics
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy metrics_select_tenant on public.social_daily_metrics
  for select using (public.is_tenant_member(tenant_id));

-- social_posts policies
create policy posts_admin_all on public.social_posts
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy posts_select_tenant on public.social_posts
  for select using (public.is_tenant_member(tenant_id));

-- collaboration policies
create policy collaboration_admin_all on public.collaboration
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy collaboration_select_tenant on public.collaboration
  for select using (public.is_tenant_member(tenant_id));

create policy collaboration_edit_manager on public.collaboration
  for update using (public.current_role() in ('agency_admin','client_manager') and public.is_tenant_member(tenant_id))
  with check (public.current_role() in ('agency_admin','client_manager') and public.is_tenant_member(tenant_id));

-- upcoming_shoots policies
create policy shoots_admin_all on public.upcoming_shoots
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy shoots_select_tenant on public.upcoming_shoots
  for select using (public.is_tenant_member(tenant_id));

create policy shoots_edit_manager on public.upcoming_shoots
  for insert with check (public.current_role() in ('agency_admin','client_manager') and public.is_tenant_member(tenant_id));

create policy shoots_update_manager on public.upcoming_shoots
  for update using (public.current_role() in ('agency_admin','client_manager') and public.is_tenant_member(tenant_id))
  with check (public.current_role() in ('agency_admin','client_manager') and public.is_tenant_member(tenant_id));

create policy shoots_delete_manager on public.upcoming_shoots
  for delete using (public.current_role() in ('agency_admin','client_manager') and public.is_tenant_member(tenant_id));

-- documents policies
create policy documents_admin_all on public.documents
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy documents_select_tenant on public.documents
  for select using (public.is_tenant_member(tenant_id));

-- sync_logs policies
create policy sync_logs_admin_all on public.sync_logs
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy sync_logs_select_tenant on public.sync_logs
  for select using (public.is_tenant_member(tenant_id));

-- Storage policies
-- bucket: client-documents
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

create policy "Admins can manage documents" on storage.objects
for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy "Clients can read tenant documents" on storage.objects
for select using (
  bucket_id = 'client-documents'
  and public.is_tenant_member((split_part(name, '/', 1))::uuid)
);
