grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.account_types, public.music_roles, public.user_music_roles to authenticated;
grant select, insert, update on public.services to authenticated;
grant select, update on public.service_assignments to authenticated;
grant select, insert, update, delete on public.availability to authenticated;
grant select, insert, update on public.songs to authenticated;
grant select, insert, update, delete on public.setlists, public.setlist_songs to authenticated;
