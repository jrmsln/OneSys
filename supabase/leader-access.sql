-- Give Music Directors the same account-management access as Admins.
drop policy if exists "Admins can manage account types" on public.account_types;

create policy "Admins and music directors can manage account types"
on public.account_types
for all to authenticated
using (public.can_manage_service_assignments())
with check (public.can_manage_service_assignments());
