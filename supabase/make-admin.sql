-- Replace the email below with the email used to sign up for Onesys.
insert into public.account_types (user_id, account_type)
select id, 'admin'::public.account_type
from auth.users
where email = 'jrmdsln@gmail.com'
on conflict (user_id, account_type) do nothing;

-- Admins can manage account types for the team.
grant insert, update, delete on public.account_types to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_types
    where user_id = auth.uid()
      and account_type = 'admin'::public.account_type
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "Admins can manage account types"
on public.account_types
for all to authenticated
using (public.is_admin())
with check (public.is_admin());
