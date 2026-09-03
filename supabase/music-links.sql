alter table public.services add column if not exists playlist_url text;
alter table public.songs add column if not exists source_url text;
