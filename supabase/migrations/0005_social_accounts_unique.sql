-- Add unique constraint on social_accounts to prevent duplicates
-- per tenant / platform / external account

alter table public.social_accounts
  add constraint social_accounts_tenant_platform_external_unique
  unique (tenant_id, platform, external_account_id);
