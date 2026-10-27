-- EDI ownership + KPI timestamps. Run in the Supabase SQL editor on an existing DB.

alter table public.onboarding
  add column if not exists edi_owner_id uuid references public.profiles (id) on delete set null,
  add column if not exists edi_note text not null default '',
  add column if not exists ready_at timestamptz,
  add column if not exists assigned_at timestamptz,
  add column if not exists completed_at timestamptz;

create index if not exists onboarding_edi_owner_id_idx on public.onboarding (edi_owner_id);
create index if not exists onboarding_ready_at_idx on public.onboarding (ready_at);
create index if not exists onboarding_completed_at_idx on public.onboarding (completed_at);

comment on column public.onboarding.edi_owner_id is 'EDI team member assigned to this onboarding';
comment on column public.onboarding.edi_note is 'Internal EDI-only note';
comment on column public.onboarding.ready_at is 'When tech contact + trader IDs first became complete (Ready)';
comment on column public.onboarding.assigned_at is 'When an EDI owner was first assigned';
comment on column public.onboarding.completed_at is 'When EDI marked the onboarding completed';
