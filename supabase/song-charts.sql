-- Add structured chart metadata for the song library.
alter type public.account_type add value if not exists 'music_leader';

alter table public.songs
  add column if not exists song_key text,
  add column if not exists notation_mode text not null default 'chords' check (notation_mode in ('chords', 'nashville')),
  add column if not exists chart_sections jsonb not null default '[]'::jsonb;

create or replace function public.can_manage_service_assignments()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_types
    where user_id = auth.uid()
      and account_type::text in ('admin', 'music_director', 'music_leader')
  );
$$;

revoke all on function public.can_manage_service_assignments() from public;
grant execute on function public.can_manage_service_assignments() to authenticated;

drop policy if exists "Authenticated users can update their songs" on public.songs;
drop policy if exists "Chart leaders can update songs" on public.songs;
create policy "Chart leaders can update songs"
on public.songs
for update to authenticated
using (public.can_manage_service_assignments())
with check (public.can_manage_service_assignments());

drop policy if exists "Admins and music directors can assign members" on public.service_assignments;
drop policy if exists "Chart leaders can assign members" on public.service_assignments;
create policy "Chart leaders can assign members"
on public.service_assignments
for insert to authenticated
with check (public.can_manage_service_assignments());
