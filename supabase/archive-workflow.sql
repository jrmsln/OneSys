alter table public.services add column if not exists archived_at timestamptz;
alter table public.setlists add column if not exists archived_at timestamptz;

create index if not exists services_active_date_idx on public.services (service_date) where archived_at is null;
create index if not exists setlists_active_service_idx on public.setlists (service_id) where archived_at is null;

grant delete, update on public.services to authenticated;
grant delete, update on public.service_assignments to authenticated;
grant delete, update on public.setlists, public.setlist_songs to authenticated;

drop policy if exists "Authenticated users can update services" on public.services;
create policy "Creators can update active services"
on public.services
for update to authenticated
using (created_by = auth.uid() and archived_at is null)
with check (created_by = auth.uid() and archived_at is null);

drop policy if exists "Authenticated users can manage setlists" on public.setlists;
create policy "Admins and music directors can manage setlists"
on public.setlists
for all to authenticated
using (public.can_manage_service_assignments())
with check (public.can_manage_service_assignments());

drop policy if exists "Authenticated users can manage setlist songs" on public.setlist_songs;
create policy "Admins and music directors can manage setlist songs"
on public.setlist_songs
for all to authenticated
using (public.can_manage_service_assignments())
with check (public.can_manage_service_assignments());

create policy "Admins can archive services"
on public.services
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can remove services"
on public.services
for delete to authenticated
using (public.is_admin());

create policy "Admins can archive setlists"
on public.setlists
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can remove setlists"
on public.setlists
for delete to authenticated
using (public.is_admin());

create policy "Admins can remove lineup assignments"
on public.service_assignments
for delete to authenticated
using (public.is_admin());

create policy "Admins can manage setlist songs"
on public.setlist_songs
for delete to authenticated
using (public.is_admin());
