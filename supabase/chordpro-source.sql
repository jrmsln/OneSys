-- Store the authoritative ChordPro source for each song chart.
alter table public.songs
  add column if not exists chordpro_source text not null default '';
