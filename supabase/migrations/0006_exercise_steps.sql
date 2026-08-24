-- ---------------------------------------------------------------------------
-- Exercise explanations
--
-- The catalogue already carried `instructions`, a single English paragraph
-- from the source dataset that was never shown. Beginners need the movement
-- broken into ordered steps, and they need to be told what usually goes wrong,
-- so both are stored as ordered arrays written in the interface language.
-- ---------------------------------------------------------------------------
alter table exercises
  add column if not exists steps     text[] not null default '{}',
  add column if not exists mistakes  text[] not null default '{}';
