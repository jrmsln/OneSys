-- Move Music Leader from account access to confirmed service assignment access.
-- Run this after hardening.sql if hardening.sql was already applied.

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

drop policy if exists "Leaders can create songs" on public.songs;
drop policy if exists "Authenticated users can create songs" on public.songs;
create policy "Leaders and committed music leaders can create songs"
on public.songs
for insert to authenticated
with check ((public.can_manage_service_assignments() or public.can_edit_committed_music()) and created_by = auth.uid());

drop policy if exists "Chart leaders can update songs" on public.songs;
drop policy if exists "Authenticated users can update their songs" on public.songs;
drop policy if exists "Committed music leaders can update songs" on public.songs;
create policy "Leaders and committed music leaders can update songs"
on public.songs
for update to authenticated
using (public.can_manage_service_assignments() or public.can_edit_committed_music())
with check (public.can_manage_service_assignments() or public.can_edit_committed_music());
