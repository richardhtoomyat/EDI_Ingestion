-- Persist EDI Team tab column order (lower = further left).
-- Run in the Supabase SQL editor.

alter table public.profiles
  add column if not exists edi_team_order integer not null default 0;

create index if not exists profiles_edi_team_order_idx
  on public.profiles (role, edi_team_order);

comment on column public.profiles.edi_team_order is 'Display order of EDI workbuckets on the Team tab';
