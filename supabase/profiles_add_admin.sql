-- Add admin role. Admins are assigned only via SQL (not self-signup).
-- Example:
--   update public.profiles set role = 'admin' where email = 'you@dayross.com';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('sale', 'edi', 'coordinator', 'admin'));

-- Self-signup still cannot create admin accounts.
drop policy if exists "insert own profile once" on public.profiles;
create policy "insert own profile once"
  on public.profiles for insert
  with check (auth.uid() = id and role in ('sale', 'edi', 'coordinator'));

comment on column public.profiles.role is 'Portal role: sale, edi, coordinator, or admin (admin assigned via SQL only)';
