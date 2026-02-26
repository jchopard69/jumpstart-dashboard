-- Demo tenant support and write safeguards

alter table public.tenants
  add column if not exists is_demo boolean not null default false;

create index if not exists idx_tenants_is_demo on public.tenants(is_demo);

create or replace function public.is_demo_tenant(tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_demo from public.tenants where id = tenant), false);
$$;

grant execute on function public.is_demo_tenant(uuid) to authenticated;

-- Demo tenants remain fully readable but non-admin tenant writes are blocked.
drop policy if exists collaboration_edit_manager on public.collaboration;
create policy collaboration_edit_manager on public.collaboration
  for update using (
    public.current_role() in ('agency_admin','client_manager')
    and public.is_tenant_member(tenant_id)
    and not public.is_demo_tenant(tenant_id)
  )
  with check (
    public.current_role() in ('agency_admin','client_manager')
    and public.is_tenant_member(tenant_id)
    and not public.is_demo_tenant(tenant_id)
  );

drop policy if exists shoots_edit_manager on public.upcoming_shoots;
create policy shoots_edit_manager on public.upcoming_shoots
  for insert with check (
    public.current_role() in ('agency_admin','client_manager')
    and public.is_tenant_member(tenant_id)
    and not public.is_demo_tenant(tenant_id)
  );

drop policy if exists shoots_update_manager on public.upcoming_shoots;
create policy shoots_update_manager on public.upcoming_shoots
  for update using (
    public.current_role() in ('agency_admin','client_manager')
    and public.is_tenant_member(tenant_id)
    and not public.is_demo_tenant(tenant_id)
  )
  with check (
    public.current_role() in ('agency_admin','client_manager')
    and public.is_tenant_member(tenant_id)
    and not public.is_demo_tenant(tenant_id)
  );

drop policy if exists shoots_delete_manager on public.upcoming_shoots;
create policy shoots_delete_manager on public.upcoming_shoots
  for delete using (
    public.current_role() in ('agency_admin','client_manager')
    and public.is_tenant_member(tenant_id)
    and not public.is_demo_tenant(tenant_id)
  );
