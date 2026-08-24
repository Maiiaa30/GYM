-- ---------------------------------------------------------------------------
-- Remembering what was swapped away
--
-- Swapping only excluded what was currently in the session, so a second swap
-- offered the first exercise straight back: the rack you walked away from, or
-- the machine that was broken. Each slot now carries the exercises it has
-- already rejected, so swapping moves forward through the alternatives.
-- ---------------------------------------------------------------------------
alter table session_items
  add column if not exists swapped_from text[] not null default '{}';
