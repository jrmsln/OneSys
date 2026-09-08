-- Run this in the Supabase SQL editor on the existing database.
-- This is the safe incremental update for an already-created project.

alter table public.profiles
  add column if not exists username text,
  add column if not exists phone text,
  add column if not exists bio text,
  add column if not exists address text,
  add column if not exists facebook_url text,
  add column if not exists avatar_url text;

-- Optional cleanup if you no longer want the old team title field stored.
-- alter table public.profiles drop column if exists title;

-- If the username column exists but is not unique yet, this can be added safely
-- after confirming there are no duplicate usernames currently in the table.
-- create unique index if not exists profiles_username_unique
-- on public.profiles (username);

create policy "Users can insert their profile" on public.profiles
for insert to authenticated
with check (auth.uid() = id);

create or replace function public.get_profile_email_by_username(username_input text)
returns table (email text)
language sql
security definer
set search_path = public
as $$
  select au.email
  from public.profiles p
  join auth.users au on au.id = p.id
  where lower(p.username) = lower(username_input)
  limit 1;
$$;

grant execute on function public.get_profile_email_by_username(text) to anon;
grant execute on function public.get_profile_email_by_username(text) to authenticated;
