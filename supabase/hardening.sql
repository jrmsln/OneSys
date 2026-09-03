-- Align database writes with the leader-only planning workflow.

insert into public.music_roles (name)
values ('Music Leader')
on conflict (name) do nothing;

delete from public.account_types
where account_type::text = 'music_leader';

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
      and account_type::text in ('admin', 'music_director')
  );
$$;

revoke all on function public.can_manage_service_assignments() from public;
grant execute on function public.can_manage_service_assignments() to authenticated;

create or replace function public.can_edit_committed_music()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.service_assignments assignment
    join public.services service on service.id = assignment.service_id
    join public.music_roles role on role.id = assignment.role_id
    join public.availability response
      on response.user_id = assignment.user_id
     and response.available_date = service.service_date
     and response.is_available = true
    where assignment.user_id = auth.uid()
      and assignment.status = 'confirmed'::public.assignment_status
      and role.name = 'Music Leader'
      and service.archived_at is null
  );
$$;

revoke all on function public.can_edit_committed_music() from public;
grant execute on function public.can_edit_committed_music() to authenticated;

drop policy if exists "Authenticated users can create services" on public.services;
create policy "Leaders can create services"
on public.services
for insert to authenticated
with check ((public.can_manage_service_assignments() or public.can_edit_committed_music()) and created_by = auth.uid());

drop policy if exists "Chart leaders can update songs" on public.songs;
drop policy if exists "Authenticated users can update their songs" on public.songs;
create policy "Committed music leaders can update songs"
on public.songs
for update to authenticated
using (public.can_manage_service_assignments() or public.can_edit_committed_music())
with check (public.can_manage_service_assignments() or public.can_edit_committed_music());

drop policy if exists "Creators can update active services" on public.services;
create policy "Leaders can update active services"
on public.services
for update to authenticated
using (public.can_manage_service_assignments() and archived_at is null)
with check (public.can_manage_service_assignments() and archived_at is null);

drop policy if exists "Admins can archive services" on public.services;
create policy "Leaders can archive services"
on public.services
for update to authenticated
using (public.can_manage_service_assignments())
with check (public.can_manage_service_assignments());

drop policy if exists "Authenticated users can create songs" on public.songs;
drop policy if exists "Leaders can create songs" on public.songs;
create policy "Leaders can create songs"
on public.songs
for insert to authenticated
with check (public.can_manage_service_assignments() and created_by = auth.uid());

create or replace function public.append_setlist_song(
  target_setlist_id uuid,
  target_song_id uuid
)
returns public.setlist_songs
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_position integer;
  inserted_song public.setlist_songs;
begin
  if not public.can_manage_service_assignments() then
    raise exception 'Only music leaders can edit setlists';
  end if;

  perform 1
  from public.setlists
  where id = target_setlist_id
  for update;

  if not found then
    raise exception 'Setlist not found';
  end if;

  select coalesce(max(position), 0) + 1
    into next_position
    from public.setlist_songs
   where setlist_id = target_setlist_id;

  insert into public.setlist_songs (setlist_id, song_id, position)
  values (target_setlist_id, target_song_id, next_position)
  returning * into inserted_song;

  return inserted_song;
end;
$$;

revoke all on function public.append_setlist_song(uuid, uuid) from public;
grant execute on function public.append_setlist_song(uuid, uuid) to authenticated;
