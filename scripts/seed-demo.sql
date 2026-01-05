-- Demo seed data (replace placeholders with real UUIDs from auth.users and tenants)
-- 1) Insert demo tenants
insert into public.tenants (id, name, slug, is_active)
values
  ('00000000-0000-0000-0000-000000000001', 'Demo Client One', 'demo-client-one', true),
  ('00000000-0000-0000-0000-000000000002', 'Demo Client Two', 'demo-client-two', true)
on conflict (id) do nothing;

-- 2) Insert demo profiles (replace user IDs)
-- replace USER_ID_1 and USER_ID_2 with values from auth.users
insert into public.profiles (id, email, full_name, role, tenant_id)
values
  ('USER_ID_1', 'client.one@example.com', 'Client One User', 'client_manager', '00000000-0000-0000-0000-000000000001'),
  ('USER_ID_2', 'client.two@example.com', 'Client Two User', 'client_user', '00000000-0000-0000-0000-000000000002');

-- 3) Insert demo social accounts (mock data)
insert into public.social_accounts (tenant_id, platform, account_name, external_account_id, auth_status)
values
  ('00000000-0000-0000-0000-000000000001', 'instagram', 'Demo IG One', 'demo-ig-1', 'active'),
  ('00000000-0000-0000-0000-000000000001', 'youtube', 'Demo YT One', 'demo-yt-1', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'tiktok', 'Demo TikTok Two', 'demo-tt-2', 'active');

-- 4) Insert collaboration data
insert into public.collaboration (tenant_id, shoot_days_remaining, notes)
values
  ('00000000-0000-0000-0000-000000000001', 3, 'Quarterly brand shoot in progress.'),
  ('00000000-0000-0000-0000-000000000002', 6, 'Awaiting creative approvals.');

-- 5) Insert upcoming shoots
insert into public.upcoming_shoots (tenant_id, shoot_date, location, notes)
values
  ('00000000-0000-0000-0000-000000000001', now() + interval '7 days', 'Paris Studio', 'Hero campaign'),
  ('00000000-0000-0000-0000-000000000002', now() + interval '14 days', 'Lyon', 'UGC crew');
