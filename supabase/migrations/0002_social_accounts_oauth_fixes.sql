alter type public.platform add value if not exists 'twitter';

alter table public.social_accounts
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_error text;
