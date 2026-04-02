alter table public.report_schedules
  add column if not exists processing_started_at timestamptz;

create index if not exists idx_report_schedules_processing
  on public.report_schedules(processing_started_at)
  where is_active = true;

drop policy if exists report_schedules_insert_manager on public.report_schedules;
create policy report_schedules_insert_manager
  on public.report_schedules
  for insert
  with check (
    public.current_role() = 'client_manager'
    and public.is_tenant_member(tenant_id)
  );

drop policy if exists report_schedules_update_manager on public.report_schedules;
create policy report_schedules_update_manager
  on public.report_schedules
  for update
  using (
    public.current_role() = 'client_manager'
    and public.is_tenant_member(tenant_id)
  )
  with check (
    public.current_role() = 'client_manager'
    and public.is_tenant_member(tenant_id)
  );

drop policy if exists report_schedules_delete_manager on public.report_schedules;
create policy report_schedules_delete_manager
  on public.report_schedules
  for delete
  using (
    public.current_role() = 'client_manager'
    and public.is_tenant_member(tenant_id)
  );

drop policy if exists collaboration_insert_manager on public.collaboration;
create policy collaboration_insert_manager
  on public.collaboration
  for insert
  with check (
    public.current_role() in ('agency_admin', 'client_manager')
    and public.is_tenant_member(tenant_id)
  );
