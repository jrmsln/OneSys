create extension if not exists pgcrypto;

create type public.account_type as enum ('admin', 'music_director', 'music_team_member');
create type public.service_status as enum ('draft', 'published', 'completed');
create type public.assignment_status as enum ('pending', 'confirmed', 'declined');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_types (
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_type public.account_type not null,
  primary key (user_id, account_type)
);

create table public.music_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.user_music_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.music_roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  service_date date not null,
  start_time time not null,
  status public.service_status not null default 'draft',
  notes text,
  playlist_url text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_assignments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.music_roles(id),
  status public.assignment_status not null default 'pending',
  response_note text,
  created_at timestamptz not null default now(),
  unique (service_id, user_id)
);

create table public.availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  available_date date not null,
  is_available boolean not null,
  note text,
  unique (user_id, available_date)
);

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  source_url text,
  lyrics text,
  chords text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.setlists (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null unique references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.setlist_songs (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references public.setlists(id) on delete cascade,
  song_id uuid not null references public.songs(id),
  position integer not null check (position > 0),
  service_key text,
  unique (setlist_id, position),
  unique (setlist_id, song_id)
);

alter table public.profiles enable row level security;
alter table public.account_types enable row level security;
alter table public.music_roles enable row level security;
alter table public.user_music_roles enable row level security;
alter table public.services enable row level security;
alter table public.service_assignments enable row level security;
alter table public.availability enable row level security;
alter table public.songs enable row level security;
alter table public.setlists enable row level security;
alter table public.setlist_songs enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.account_types, public.music_roles, public.user_music_roles to authenticated;
grant select, insert, update on public.services to authenticated;
grant select, update on public.service_assignments to authenticated;
grant select, insert, update, delete on public.availability to authenticated;
grant select, insert, update on public.songs to authenticated;
grant select, insert, update, delete on public.setlists, public.setlist_songs to authenticated;

create policy "Users can view profiles" on public.profiles for select to authenticated using (true);
create policy "Users can update their profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users can view account types" on public.account_types for select to authenticated using (true);
create policy "Users can view music roles" on public.music_roles for select to authenticated using (true);
create policy "Users can view assigned roles" on public.user_music_roles for select to authenticated using (true);
create policy "Authenticated users can view services" on public.services for select to authenticated using (true);
create policy "Authenticated users can create services" on public.services for insert to authenticated with check (created_by = auth.uid());
create policy "Authenticated users can update services" on public.services for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "Users can view assignments" on public.service_assignments for select to authenticated using (true);
create policy "Users can respond to their assignments" on public.service_assignments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can manage their availability" on public.availability for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Authenticated users can view songs" on public.songs for select to authenticated using (true);
create policy "Authenticated users can create songs" on public.songs for insert to authenticated with check (created_by = auth.uid());
create policy "Authenticated users can update their songs" on public.songs for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "Authenticated users can view setlists" on public.setlists for select to authenticated using (true);
create policy "Authenticated users can manage setlists" on public.setlists for all to authenticated using (true) with check (true);
create policy "Authenticated users can view setlist songs" on public.setlist_songs for select to authenticated using (true);
create policy "Authenticated users can manage setlist songs" on public.setlist_songs for all to authenticated using (true) with check (true);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
