-- ---------------------------------------------------------------------------
-- A body-weight goal, so the chart can show what the numbers are moving
-- towards and colour each change by whether it helps.
-- ---------------------------------------------------------------------------

alter table profiles
  add column weight_goal_kg numeric(5, 2)
    check (weight_goal_kg is null or weight_goal_kg between 25 and 300);
