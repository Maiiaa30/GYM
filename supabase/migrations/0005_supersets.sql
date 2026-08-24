-- ---------------------------------------------------------------------------
-- Supersets.
--
-- Exercises sharing a group number are performed back to back, one round at a
-- time, with a single rest at the end of each round. The number is only an
-- identifier: consecutive items carrying the same one belong together.
-- ---------------------------------------------------------------------------

alter table plan_items add column superset_group smallint;
alter table session_items add column superset_group smallint;
