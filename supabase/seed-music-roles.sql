insert into public.music_roles (name)
values
  ('Music Director'),
  ('Music Leader'),
  ('Vocal'),
  ('BGV'),
  ('Guitar'),
  ('Bass'),
  ('Drums'),
  ('Keys'),
  ('Other')
on conflict (name) do nothing;
