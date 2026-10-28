-- EDI in-app notifications (mentions, assign, unassign).
-- Run in the Supabase SQL editor.

create table if not exists public.edi_notification (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  onboarding_id uuid not null references public.onboarding (id) on delete cascade,
  kind text not null default 'mention'
    check (kind in ('mention', 'assigned', 'unassigned')),
  note_excerpt text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint edi_notification_no_self check (recipient_id <> actor_id)
);

-- Safe for databases that already created the table without kind.
alter table public.edi_notification
  add column if not exists kind text not null default 'mention';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'edi_notification_kind_check'
  ) then
    alter table public.edi_notification
      add constraint edi_notification_kind_check
      check (kind in ('mention', 'assigned', 'unassigned'));
  end if;
end $$;

create index if not exists edi_notification_recipient_created_idx
  on public.edi_notification (recipient_id, created_at desc);

create index if not exists edi_notification_recipient_unread_idx
  on public.edi_notification (recipient_id)
  where read_at is null;

alter table public.edi_notification enable row level security;

comment on table public.edi_notification is
  'In-app EDI notifications for @mentions and workbucket assign/unassign';
