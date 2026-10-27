-- Track who last modified an onboarding form (Sales / EDI / Coordinator).
-- Run in the Supabase SQL editor after onboarding.sql.

alter table public.onboarding
  add column if not exists last_modified_by_name text not null default '',
  add column if not exists last_modified_by_team text not null default '';

comment on column public.onboarding.last_modified_by_name is 'First and last name of the last person who saved the form';
comment on column public.onboarding.last_modified_by_team is 'Team label: Sales, EDI, or Coordinator';
