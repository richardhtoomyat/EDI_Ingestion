-- EDI work stages (Started / Test / Production). Run in the Supabase SQL editor.

alter table public.onboarding
  add column if not exists edi_stage text not null default '',
  add column if not exists estimated_completion_date date,
  add column if not exists started_at timestamptz,
  add column if not exists test_at timestamptz,
  add column if not exists production_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'onboarding_edi_stage_check'
  ) then
    alter table public.onboarding
      add constraint onboarding_edi_stage_check
      check (edi_stage in ('', 'started', 'test', 'production'));
  end if;
end $$;

create index if not exists onboarding_edi_stage_idx on public.onboarding (edi_stage);

comment on column public.onboarding.edi_stage is 'EDI work stage: started, test, or production';
comment on column public.onboarding.estimated_completion_date is 'Estimated completion date entered when Started';
comment on column public.onboarding.started_at is 'When EDI first moved to Started';
comment on column public.onboarding.test_at is 'When EDI first moved to Test';
comment on column public.onboarding.production_at is 'When EDI first moved to Production';
