-- Allow signed-in users to update their own profile name fields.
-- Run in the Supabase SQL editor.

create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
