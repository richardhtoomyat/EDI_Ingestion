-- Per-login Team tab column order (viewer preference, not shared).
-- Run in the Supabase SQL editor.

alter table public.profiles
  add column if not exists edi_team_view_order jsonb not null default '[]'::jsonb;

comment on column public.profiles.edi_team_view_order is
  'Ordered list of EDI profile ids for this user''s Team tab layout';
