-- Persist priority order inside EDI workbuckets (lower = higher priority / top).
-- Run in the Supabase SQL editor.

alter table public.onboarding
  add column if not exists edi_bucket_order integer not null default 0;

create index if not exists onboarding_edi_bucket_order_idx
  on public.onboarding (edi_owner_id, edi_bucket_order);

comment on column public.onboarding.edi_bucket_order is 'Priority within an EDI owner workbucket; lower numbers appear first';
