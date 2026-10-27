-- Run this if profiles already exists with only sale|edi roles.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('sale', 'edi', 'coordinator'));

drop policy if exists "insert own profile once" on public.profiles;
create policy "insert own profile once"
  on public.profiles for insert
  with check (auth.uid() = id and role in ('sale', 'edi', 'coordinator'));
