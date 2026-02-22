-- Multi-tenant access: allow users to access multiple tenants

-- Table to store additional tenant access for users
create table if not exists public.user_tenant_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, tenant_id)
);

-- Index for faster lookups
create index if not exists idx_user_tenant_access_user on public.user_tenant_access(user_id);
create index if not exists idx_user_tenant_access_tenant on public.user_tenant_access(tenant_id);

-- Update is_tenant_member to check both profiles.tenant_id and user_tenant_access
create or replace function public.is_tenant_member(tenant uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    (select true from public.profiles where id = auth.uid() and tenant_id = tenant)
    or
    (select true from public.user_tenant_access where user_id = auth.uid() and tenant_id = tenant),
    false
  );
$$;

-- RLS for user_tenant_access
alter table public.user_tenant_access enable row level security;

-- Admin can manage all access
create policy user_tenant_access_admin_all on public.user_tenant_access
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

-- Users can see their own access entries
create policy user_tenant_access_select_own on public.user_tenant_access
  for select using (user_id = auth.uid());
