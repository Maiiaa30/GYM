-- ---------------------------------------------------------------------------
-- Two properties an exercise can have that change how a set is logged.
--
--   is_timed  the set is a hold: the repetition fields carry seconds
--   per_side  the movement is done one limb at a time; the logged number is
--             the total across both sides, and the interface shows the split
-- ---------------------------------------------------------------------------

alter table exercises add column is_timed boolean not null default false;
alter table exercises add column per_side boolean not null default false;
