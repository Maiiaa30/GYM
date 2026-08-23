-- ---------------------------------------------------------------------------
-- Sessions carry their own prescription.
--
-- Until now the training screen read the shared programme directly, so a block
-- rebuilt mid-session emptied a workout that was already running, and an
-- exercise could not be added or dropped without touching the programme both
-- members follow. A session now takes a snapshot of what it prescribes when it
-- starts, and owns it from there.
--
-- Progression also records why the next load is what it is, so the training
-- screen can explain every target instead of presenting a bare number.
-- ---------------------------------------------------------------------------

create table session_items (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references sessions (id) on delete cascade,
  user_id            uuid not null references profiles (id) on delete cascade,
  position           smallint not null,
  exercise           text not null references exercises (slug),
  sets               smallint not null check (sets between 1 and 10),
  rep_low            smallint not null check (rep_low between 1 and 100),
  rep_high           smallint not null check (rep_high between 1 and 100),
  rest_sec           smallint not null default 120,
  notes              text,
  added_mid_session  boolean not null default false,
  unique (session_id, exercise),
  check (rep_high >= rep_low)
);

create index session_items_session_idx on session_items (session_id, position);

alter table session_items enable row level security;

create policy "own session items" on session_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The partner sees what you are doing today, the same way they see your sets.
create policy "partner reads session items" on session_items for select to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = session_items.session_id
        and s.performed_on = current_date
    )
  );

-- Why the next working weight is what it is.
alter table progression
  add column last_action text not null default 'start'
    check (last_action in ('start', 'increase', 'hold', 'deload', 'unchanged'));

-- Backfill: existing rows keep a neutral explanation.
update progression set last_action = 'unchanged' where working_kg > 0;
