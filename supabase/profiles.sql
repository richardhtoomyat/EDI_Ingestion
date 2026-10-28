create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  first_name text not null,
  last_name text not null,
  role text not null check (role in ('sale', 'edi', 'coordinator', 'admin')),
  edi_team_view_order jsonb not null default '[]'::jsonb,
  edi_team_hidden jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "insert own profile once"
  on public.profiles for insert
  with check (auth.uid() = id and role in ('sale', 'edi', 'coordinator'));

create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
