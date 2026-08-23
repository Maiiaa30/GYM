-- ---------------------------------------------------------------------------
-- GYM — initial schema
--
-- Two accounts share one training programme. Programme data is readable by
-- every signed-in member; anything personal (sessions, logs, measurements,
-- progression) is restricted to its owner.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type equipment_profile as enum ('full_gym', 'hotel', 'home_minimal');
create type plan_source as enum ('template', 'generated', 'manual');
create type session_status as enum ('in_progress', 'completed', 'abandoned');
create type lift_family as enum ('lower_compound', 'upper_compound', 'accessory', 'bodyweight');

-- ---------------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  name          text not null,
  email         text not null unique,
  height_cm     numeric(5, 1),
  birth_date    date,
  sex           text check (sex in ('male', 'female', 'other', 'undisclosed')),
  experience    text not null default 'beginner'
                  check (experience in ('beginner', 'novice', 'intermediate')),
  injury_notes  text,
  is_owner      boolean not null default false,
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- Invitations. The second account is created by the first: the code is handed
-- over directly, and the invited member chooses their own password.
create table invites (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  name         text not null,
  code_hash    text not null,
  created_by   uuid not null references profiles (id) on delete cascade,
  expires_at   timestamptz not null default (now() + interval '30 days'),
  redeemed_at  timestamptz,
  redeemed_by  uuid references profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index invites_email_idx on invites (lower(email)) where redeemed_at is null;

-- Shared configuration for the pair.
create table household_settings (
  id                text primary key default 'only' check (id = 'only'),
  days_per_week     smallint not null default 3 check (days_per_week between 1 and 6),
  equipment         equipment_profile not null default 'full_gym',
  session_minutes   smallint not null default 60 check (session_minutes between 20 and 150),
  rest_default_sec  smallint not null default 120,
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Exercise catalogue (imported, read-only at runtime)
-- ---------------------------------------------------------------------------
create table exercises (
  slug            text primary key,
  name            text not null,
  primary_muscle  text not null,
  secondary       text[] not null default '{}',
  equipment       text not null,
  category        text not null,
  family          lift_family not null default 'accessory',
  increment_kg    numeric(4, 2) not null default 2.5,
  images          text[] not null default '{}',
  cues            text[] not null default '{}',
  instructions    text,
  profiles_ok     equipment_profile[] not null default '{full_gym}'
);

create index exercises_muscle_idx on exercises (primary_muscle);
create index exercises_profile_idx on exercises using gin (profiles_ok);

-- ---------------------------------------------------------------------------
-- Programme
-- ---------------------------------------------------------------------------
create table plans (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  block_start  date not null,
  weeks        smallint not null default 4 check (weeks between 1 and 12),
  equipment    equipment_profile not null default 'full_gym',
  source       plan_source not null default 'template',
  rationale    text,
  raw_json     jsonb,
  is_active    boolean not null default true,
  created_by   uuid references profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create unique index plans_single_active_idx on plans (is_active) where is_active;

create table plan_days (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans (id) on delete cascade,
  day_index  smallint not null,
  name       text not null,
  focus      text,
  unique (plan_id, day_index)
);

create table plan_items (
  id           uuid primary key default gen_random_uuid(),
  plan_day_id  uuid not null references plan_days (id) on delete cascade,
  position     smallint not null,
  exercise     text not null references exercises (slug),
  sets         smallint not null check (sets between 1 and 10),
  rep_low      smallint not null check (rep_low between 1 and 100),
  rep_high     smallint not null check (rep_high between 1 and 100),
  rest_sec     smallint not null default 120,
  notes        text,
  unique (plan_day_id, position),
  check (rep_high >= rep_low)
);

-- ---------------------------------------------------------------------------
-- Training history (personal)
-- ---------------------------------------------------------------------------
create table sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  plan_day_id  uuid references plan_days (id) on delete set null,
  performed_on date not null default current_date,
  status       session_status not null default 'in_progress',
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  notes        text
);

create index sessions_user_date_idx on sessions (user_id, performed_on desc);

create table set_logs (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  exercise    text not null references exercises (slug),
  set_no      smallint not null check (set_no between 1 and 20),
  is_warmup   boolean not null default false,
  target_kg   numeric(6, 2),
  weight_kg   numeric(6, 2),
  reps        smallint check (reps between 0 and 200),
  completed   boolean not null default false,
  logged_at   timestamptz not null default now(),
  unique (session_id, exercise, set_no, is_warmup)
);

create index set_logs_user_exercise_idx on set_logs (user_id, exercise, logged_at desc);

create table progression (
  user_id     uuid not null references profiles (id) on delete cascade,
  exercise    text not null references exercises (slug),
  working_kg  numeric(6, 2) not null default 0,
  fail_count  smallint not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, exercise)
);

create table personal_records (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles (id) on delete cascade,
  exercise       text not null references exercises (slug),
  weight_kg      numeric(6, 2) not null,
  reps           smallint not null,
  estimated_1rm  numeric(6, 2) not null,
  achieved_on    date not null default current_date,
  unique (user_id, exercise, achieved_on)
);

create table body_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg   numeric(5, 2),
  waist_cm    numeric(5, 1),
  photo_path  text,
  notes       text,
  unique (user_id, measured_on)
);

create index body_logs_user_date_idx on body_logs (user_id, measured_on desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table profiles           enable row level security;
alter table invites            enable row level security;
alter table household_settings enable row level security;
alter table exercises          enable row level security;
alter table plans              enable row level security;
alter table plan_days          enable row level security;
alter table plan_items         enable row level security;
alter table sessions           enable row level security;
alter table set_logs           enable row level security;
alter table progression        enable row level security;
alter table personal_records   enable row level security;
alter table body_logs          enable row level security;

-- Shared, readable by any signed-in member.
create policy "members read profiles"   on profiles   for select to authenticated using (true);
create policy "own profile update"      on profiles   for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members read exercises"  on exercises  for select to authenticated using (true);

create policy "members read settings"   on household_settings for select to authenticated using (true);
create policy "members write settings"  on household_settings for update to authenticated using (true) with check (true);

create policy "members read plans"      on plans      for select to authenticated using (true);
create policy "members read plan days"  on plan_days  for select to authenticated using (true);
create policy "members read plan items" on plan_items for select to authenticated using (true);

-- Personal data.
create policy "own sessions"   on sessions   for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own set logs"   on set_logs   for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own progress"   on progression for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own records"    on personal_records for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own body logs"  on body_logs  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Both members may see each other's completed set logs on the training screen,
-- which is the point of training together. Read only, and only for logs that
-- belong to a session on the same day.
create policy "partner reads set logs" on set_logs for select to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = set_logs.session_id
        and s.performed_on = current_date
    )
  );

create policy "partner reads sessions" on sessions for select to authenticated
  using (performed_on >= current_date - 7);

-- Invitations are visible to their author only; redemption runs with the
-- service role and therefore bypasses these policies.
create policy "own invites" on invites for all to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------
insert into household_settings (id) values ('only') on conflict do nothing;
