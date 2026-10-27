-- Onboarding form storage. UUID is the primary key; Technow Request ID is unique.
-- Replaces public.onboardings (dummy-seeded). Run this in the Supabase SQL editor.

drop table if exists public.onboardings cascade;
drop table if exists public.onboarding cascade;

create table public.onboarding (
  id uuid primary key default gen_random_uuid(),
  technow_request_id text not null unique,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  company_name text not null default '',
  customer_email text not null,
  prefill jsonb not null default '{}'::jsonb,
  submission jsonb,
  trader_id_qa text not null default '',
  trader_id_prod text not null default '',
  needs_at7_mapping boolean not null default false,
  at7_custom_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists onboarding_created_at_idx on public.onboarding (created_at desc);
create index if not exists onboarding_customer_email_idx on public.onboarding (customer_email);
create index if not exists onboarding_needs_at7_mapping_idx
  on public.onboarding (needs_at7_mapping)
  where needs_at7_mapping = true;

create table if not exists public.onboarding_at7_code (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.onboarding (id) on delete cascade,
  source text not null check (source in ('prefill', 'submission')),
  group_kind text not null check (group_kind in ('normal', 'exception')),
  status_key text not null,
  status_name text not null default '',
  status_code text not null default '',
  default_at701 text not null default '',
  default_at702 text not null default '',
  at701 text not null default '',
  at702 text not null default '',
  is_custom boolean not null default false,
  custom_fields text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  unique (onboarding_id, source, status_key)
);

create index if not exists onboarding_at7_code_onboarding_id_idx
  on public.onboarding_at7_code (onboarding_id);

create index if not exists onboarding_at7_code_custom_idx
  on public.onboarding_at7_code (is_custom)
  where is_custom = true;

alter table public.onboarding enable row level security;
alter table public.onboarding_at7_code enable row level security;

comment on table public.onboarding is 'EDI customer onboarding records';
comment on column public.onboarding.id is 'Supabase UUID primary key';
comment on column public.onboarding.technow_request_id is 'Technow Request ID (unique business key)';
comment on column public.onboarding.token is 'Public customer form access token';
comment on column public.onboarding.trader_id_qa is 'Trader ID (QA) set by EDI Coordinator';
comment on column public.onboarding.trader_id_prod is 'Trader ID (Prod) set by EDI Coordinator';
comment on column public.onboarding.needs_at7_mapping is 'True when authoritative 214 statuses include customized AT7-01/AT7-02';
comment on column public.onboarding.at7_custom_count is 'Count of customized AT7 rows for the authoritative source';
comment on table public.onboarding_at7_code is 'Normalized 214 status AT7 codes per onboarding; is_custom flags EDI mapping work';
