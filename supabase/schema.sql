-- NiketDigital.ai — foundation schema (multi-tenant PostgreSQL, Supabase)
-- Run in Supabase SQL Editor. NO seed data: no fake customers, leads or ad metrics.
-- Every table has RLS enabled. Tenancy: businesses.id is the tenant id;
-- users see only rows whose business_id (or owner_id / user_id) belongs to them.
-- Super-admin: profiles.is_admin = true (set manually in Supabase for a trusted user).
-- Tokens: integrations.encrypted_access_token holds AES-256-GCM ciphertext ONLY
-- (see api/_lib/crypto.ts). NEVER store a plaintext token here.
-- Website order statuses: New Order, Under Review, Quotation Sent, Payment Pending,
-- In Development, Customer Review, Revisions, Completed, Published.
-- Lead statuses: New, Contacted, Qualified, Estimate Scheduled, Proposal Sent, Won, Lost.

create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update using (auth.uid() = id);
drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert" on public.profiles for insert with check (auth.uid() = id);
-- Admins can read all profiles (needed for the admin customer list).
drop policy if exists "profiles admin read" on public.profiles;
create policy "profiles admin read" on public.profiles for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

-- ---------- businesses (tenant) ----------
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  industry text not null check (industry in ('Roofing','Home Remodeling','Construction','Pest Control')),
  business_email text,
  phone text,
  website text,
  service_locations text[] not null default '{}',
  address text,
  services text[] not null default '{}',
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id)
);
alter table public.businesses enable row level security;
drop policy if exists "businesses owner all" on public.businesses;
create policy "businesses owner all" on public.businesses for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "businesses admin read" on public.businesses;
create policy "businesses admin read" on public.businesses for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

-- ---------- plans & subscriptions ----------
create table if not exists public.plans (
  id text primary key, -- starter | growth | professional | agency
  name text not null,
  monthly_price_cents int not null,
  annual_monthly_price_cents int not null,
  stripe_price_monthly text,
  stripe_price_annual text,
  lead_limit int, -- null = unlimited
  ai_generation_limit int, -- null = unlimited
  features jsonb not null default '[]'::jsonb
);
alter table public.plans enable row level security;
drop policy if exists "plans public read" on public.plans;
create policy "plans public read" on public.plans for select using (true);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  interval text not null default 'monthly' check (interval in ('monthly','annual')),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','canceled','incomplete','unpaid')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions tenant" on public.subscriptions;
create policy "subscriptions tenant" on public.subscriptions for all using (
  auth.uid() = user_id and exists (select 1 from public.businesses b where b.id = subscriptions.business_id and b.owner_id = auth.uid())
) with check (auth.uid() = user_id);
drop policy if exists "subscriptions admin read" on public.subscriptions;
create policy "subscriptions admin read" on public.subscriptions for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

-- ---------- website orders ----------
create table if not exists public.website_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  industry text not null,
  design_style text,
  pages text[] not null default '{}',
  services text[] not null default '{}',
  service_locations text[] not null default '{}',
  contact_info text,
  additional_features text,
  logo_url text,
  status text not null default 'New Order' check (status in ('New Order','Under Review','Quotation Sent','Payment Pending','In Development','Customer Review','Revisions','Completed','Published')),
  quotation_amount_cents int,
  quotation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.website_orders enable row level security;
drop policy if exists "website_orders tenant" on public.website_orders;
create policy "website_orders tenant" on public.website_orders for all using (
  auth.uid() = user_id and exists (select 1 from public.businesses b where b.id = website_orders.business_id and b.owner_id = auth.uid())
) with check (auth.uid() = user_id);
drop policy if exists "website_orders admin all" on public.website_orders;
create policy "website_orders admin all" on public.website_orders for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

create table if not exists public.website_order_status_history (
  id uuid primary key default gen_random_uuid(),
  website_order_id uuid not null references public.website_orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);
alter table public.website_order_status_history enable row level security;
drop policy if exists "order_history tenant read" on public.website_order_status_history;
create policy "order_history tenant read" on public.website_order_status_history for select using (
  exists (select 1 from public.website_orders o where o.id = website_order_status_history.website_order_id and o.user_id = auth.uid())
);
drop policy if exists "order_history admin all" on public.website_order_status_history;
create policy "order_history admin all" on public.website_order_status_history for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

-- ---------- leads (CRM) ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  source text not null default 'Website form' check (source in ('Website form','Meta Lead Ads','Google Ads','Phone','Referral','Other')),
  campaign_id uuid,
  status text not null default 'New' check (status in ('New','Contacted','Qualified','Estimate Scheduled','Proposal Sent','Won','Lost')),
  notes text,
  follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.leads enable row level security;
drop policy if exists "leads tenant" on public.leads;
create policy "leads tenant" on public.leads for all using (
  exists (select 1 from public.businesses b where b.id = leads.business_id and b.owner_id = auth.uid())
) with check (
  exists (select 1 from public.businesses b where b.id = leads.business_id and b.owner_id = auth.uid())
);
drop policy if exists "leads admin read" on public.leads;
create policy "leads admin read" on public.leads for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

-- ---------- ad accounts / integrations / campaigns ----------
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('meta','google','stripe')),
  status text not null default 'not_connected' check (status in ('not_connected','connected','needs_reconnect','error')),
  -- Encrypted token ONLY (AES-256-GCM, api/_lib/crypto.ts). Never plaintext.
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  scopes text,
  external_user_id text,
  config jsonb not null default '{}'::jsonb, -- safe metadata only; NEVER a token
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id, provider)
);
alter table public.integrations enable row level security;
drop policy if exists "integrations tenant" on public.integrations;
create policy "integrations tenant" on public.integrations for all using (
  auth.uid() = user_id and exists (select 1 from public.businesses b where b.id = integrations.business_id and b.owner_id = auth.uid())
) with check (auth.uid() = user_id);
drop policy if exists "integrations admin read" on public.integrations;
create policy "integrations admin read" on public.integrations for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

create table if not exists public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null check (provider in ('meta','google')),
  external_account_id text not null,
  name text,
  currency text,
  created_at timestamptz not null default now(),
  unique(business_id, provider, external_account_id)
);
alter table public.ad_accounts enable row level security;
drop policy if exists "ad_accounts tenant" on public.ad_accounts;
create policy "ad_accounts tenant" on public.ad_accounts for all using (
  exists (select 1 from public.businesses b where b.id = ad_accounts.business_id and b.owner_id = auth.uid())
) with check (
  exists (select 1 from public.businesses b where b.id = ad_accounts.business_id and b.owner_id = auth.uid())
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null check (provider in ('meta','google')),
  ad_account_id uuid references public.ad_accounts(id) on delete set null,
  external_campaign_id text,
  name text not null,
  objective text,
  status text not null default 'draft' check (status in ('draft','paused','active','archived')),
  -- Draft/paused only until the customer explicitly approves publishing.
  approved_to_publish boolean not null default false,
  budget_cents int,
  targeting jsonb not null default '{}'::jsonb,
  ai_copy jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
drop policy if exists "campaigns tenant" on public.campaigns;
create policy "campaigns tenant" on public.campaigns for all using (
  exists (select 1 from public.businesses b where b.id = campaigns.business_id and b.owner_id = auth.uid())
) with check (
  exists (select 1 from public.businesses b where b.id = campaigns.business_id and b.owner_id = auth.uid())
);

-- Campaign metrics: ONLY rows imported from a connected ad account or entered
-- by the user. Never fabricated. Empty = no data.
create table if not exists public.campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  date date not null,
  impressions int not null default 0,
  clicks int not null default 0,
  leads int not null default 0,
  spend_cents int not null default 0,
  conversions int not null default 0,
  source text not null default 'manual' check (source in ('manual','meta','google')),
  created_at timestamptz not null default now(),
  unique(campaign_id, date, source)
);
alter table public.campaign_metrics enable row level security;
drop policy if exists "campaign_metrics tenant" on public.campaign_metrics;
create policy "campaign_metrics tenant" on public.campaign_metrics for all using (
  exists (select 1 from public.businesses b where b.id = campaign_metrics.business_id and b.owner_id = auth.uid())
) with check (
  exists (select 1 from public.businesses b where b.id = campaign_metrics.business_id and b.owner_id = auth.uid())
);

-- ---------- AI generations & usage ----------
create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  prompt_excerpt text,
  created_at timestamptz not null default now()
);
alter table public.ai_generations enable row level security;
drop policy if exists "ai_generations tenant" on public.ai_generations;
create policy "ai_generations tenant" on public.ai_generations for all using (
  auth.uid() = user_id and exists (select 1 from public.businesses b where b.id = ai_generations.business_id and b.owner_id = auth.uid())
) with check (auth.uid() = user_id);

create table if not exists public.usage_limits (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  month text not null, -- YYYY-MM
  leads_count int not null default 0,
  ai_generations_count int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.usage_limits enable row level security;
drop policy if exists "usage_limits tenant" on public.usage_limits;
create policy "usage_limits tenant" on public.usage_limits for all using (
  exists (select 1 from public.businesses b where b.id = usage_limits.business_id and b.owner_id = auth.uid())
) with check (
  exists (select 1 from public.businesses b where b.id = usage_limits.business_id and b.owner_id = auth.uid())
);

-- ---------- support & audit ----------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'Open' check (status in ('Open','In Progress','Resolved','Closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
drop policy if exists "support_tickets tenant" on public.support_tickets;
create policy "support_tickets tenant" on public.support_tickets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "support_tickets admin all" on public.support_tickets;
create policy "support_tickets admin all" on public.support_tickets for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
drop policy if exists "audit_logs tenant read" on public.audit_logs;
create policy "audit_logs tenant read" on public.audit_logs for select using (
  auth.uid() = user_id or exists (select 1 from public.businesses b where b.id = audit_logs.business_id and b.owner_id = auth.uid())
);
drop policy if exists "audit_logs admin read" on public.audit_logs;
create policy "audit_logs admin read" on public.audit_logs for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

-- OAuth state (hashed, short-lived; server only, service-role access).
create table if not exists public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  business_id uuid references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('meta','google')),
  kind text not null default 'state',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.oauth_states enable row level security;
-- No direct user access: only the service-role key (server) touches this table.

-- ---------- plan seed (catalog only, not customer data) ----------
insert into public.plans (id, name, monthly_price_cents, annual_monthly_price_cents, lead_limit, ai_generation_limit, features) values
  ('starter','Starter',4900,3900,100,50,'["AI Marketing Assistant","Lead CRM","Email support"]'::jsonb),
  ('growth','Growth',9900,7900,500,200,'["Everything in Starter","Meta + Google Ads drafts","Campaign reporting","Priority support"]'::jsonb),
  ('professional','Professional',19900,15900,2000,750,'["Everything in Growth","AI automation workflows","Advanced analytics","Monthly marketing report"]'::jsonb),
  ('agency','Agency',39900,31900,null,null,'["Everything in Professional","Multiple businesses","White-label reports","Dedicated support"]'::jsonb)
on conflict (id) do nothing;

-- Storage bucket for business logos / photos (create in Dashboard > Storage if not present):
--   insert into storage.buckets (id, name, public) values ('business-assets','business-assets', true)
--   on conflict (id) do nothing;
