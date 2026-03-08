-- Add per-tenant role to user_tenant_access for SaaS-ready memberships

alter table public.user_tenant_access
  add column if not exists role public.user_role not null default 'client_user';

create index if not exists idx_user_tenant_access_tenant_role
  on public.user_tenant_access(tenant_id, role);
