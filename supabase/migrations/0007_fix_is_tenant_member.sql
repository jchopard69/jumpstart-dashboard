-- Fix stack depth recursion in is_tenant_member by bypassing RLS safely
create or replace function public.is_tenant_member(tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists(select 1 from public.profiles where id = auth.uid() and tenant_id = tenant),
    false
  ) or coalesce(
    exists(select 1 from public.user_tenant_access where user_id = auth.uid() and tenant_id = tenant),
    false
  );
$$;

grant execute on function public.is_tenant_member(uuid) to authenticated;
