-- Find duplicate library entries before enabling database-level protection.
select
  lower(regexp_replace(trim(title), '\\s+', ' ', 'g')) as normalized_title,
  lower(regexp_replace(trim(coalesce(artist, '')), '\\s+', ' ', 'g')) as normalized_artist,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as song_ids
from public.songs
group by 1, 2
having count(*) > 1
order by duplicate_count desc, normalized_title;

-- After reviewing and merging the rows returned above, run this index.
-- It prevents future duplicates with the same title and artist, ignoring case and extra spaces.
-- create unique index songs_title_artist_unique_idx
-- on public.songs (
--   lower(regexp_replace(trim(title), '\\s+', ' ', 'g')),
--   lower(regexp_replace(trim(coalesce(artist, '')), '\\s+', ' ', 'g'))
-- );
