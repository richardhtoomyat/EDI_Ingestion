-- Per-login Team tab preferences (viewer only, not shared).
-- Run in the Supabase SQL editor.

alter table public.profiles
  add column if not exists edi_team_view_order jsonb not null default '[]'::jsonb;

alter table public.profiles
  add column if not exists edi_team_hidden jsonb not null default '[]'::jsonb;

comment on column public.profiles.edi_team_view_order is
  'Ordered list of EDI profile ids for this user''s Team tab layout';

comment on column public.profiles.edi_team_hidden is
  'EDI profile ids this user has hidden from their Team tab';
