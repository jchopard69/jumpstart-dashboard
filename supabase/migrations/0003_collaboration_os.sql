-- Collaboration OS tables

do $$ begin
  create type public.collab_kind as enum (
    'idea',
    'shoot',
    'edit',
    'publish',
    'next_step',
    'monthly_priority'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.collab_status as enum (
    'backlog',
    'planned',
    'in_progress',
    'review',
    'done'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.collab_priority as enum (
    'low',
    'medium',
    'high',
    'critical'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.collab_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  description text,
  kind public.collab_kind not null default 'idea',
  status public.collab_status not null default 'backlog',
  priority public.collab_priority not null default 'medium',
  due_date timestamptz,
  owner text,
  sort_order int,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_collab_items_tenant on public.collab_items(tenant_id);
create index if not exists idx_collab_items_tenant_status on public.collab_items(tenant_id, status);
create index if not exists idx_collab_items_tenant_kind on public.collab_items(tenant_id, kind);

alter table public.collab_items enable row level security;

create policy collab_items_admin_all on public.collab_items
  for all using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy collab_items_select_tenant on public.collab_items
  for select using (public.is_tenant_member(tenant_id));

create policy collab_items_write_manager on public.collab_items
  for insert with check (public.current_role() in ('agency_admin','client_manager') and public.is_tenant_member(tenant_id));

create policy collab_items_update_manager on public.collab_items
  for update using (public.current_role() in ('agency_admin','client_manager') and public.is_tenant_member(tenant_id))
  with check (public.current_role() in ('agency_admin','client_manager') and public.is_tenant_member(tenant_id));

create policy collab_items_delete_manager on public.collab_items
  for delete using (public.current_role() in ('agency_admin','client_manager') and public.is_tenant_member(tenant_id));
