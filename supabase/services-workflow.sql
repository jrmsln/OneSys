insert into public.music_roles (name)
values ('Music Director'), ('Vocal'), ('BGV'), ('Guitar'), ('Bass'), ('Drums'), ('Keys'), ('Other')
on conflict (name) do nothing;

grant insert on public.service_assignments to authenticated;

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
      and account_type in ('admin'::public.account_type, 'music_director'::public.account_type)
  );
$$;

revoke all on function public.can_manage_service_assignments() from public;
grant execute on function public.can_manage_service_assignments() to authenticated;

create policy "Admins and music directors can assign members"
on public.service_assignments
for insert to authenticated
with check (public.can_manage_service_assignments());
