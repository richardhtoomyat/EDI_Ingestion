-- Custom 214 AT7 flags for EDI mapping.
-- Run in the Supabase SQL editor after onboarding.sql.

alter table public.onboarding
  add column if not exists needs_at7_mapping boolean not null default false,
  add column if not exists at7_custom_count integer not null default 0;

comment on column public.onboarding.needs_at7_mapping is 'True when authoritative 214 statuses include customized AT7-01/AT7-02';
comment on column public.onboarding.at7_custom_count is 'Count of customized AT7 rows for the authoritative source';

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

create index if not exists onboarding_needs_at7_mapping_idx
  on public.onboarding (needs_at7_mapping)
  where needs_at7_mapping = true;

alter table public.onboarding_at7_code enable row level security;

comment on table public.onboarding_at7_code is 'Normalized 214 status AT7 codes per onboarding; is_custom flags EDI mapping work';
