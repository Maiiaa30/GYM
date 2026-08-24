-- ---------------------------------------------------------------------------
-- Push subscriptions
--
-- One row per device that has agreed to be notified. Keyed on the endpoint the
-- browser hands out, so re-subscribing on the same device replaces its row
-- instead of accumulating them.
--
-- A member may only read and write their own. Sending to the *other* member
-- runs with the service role, which is the only way one account can reach
-- another's devices — deliberately, so that nothing client-side can address
-- somebody else's phone.
-- ---------------------------------------------------------------------------
create table if not exists push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references profiles (id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "own push subscriptions" on push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
