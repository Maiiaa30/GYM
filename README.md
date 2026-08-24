# GYM

**[gym.drodrigues.cv](https://gym.drodrigues.cv)**

A training log and programme for two people who train together — at the same
time, in the same place, doing the same exercises in the same order.

That constraint is the whole design. The programme is **shared**: one plan, one
order, so nobody is reading a different screen between sets. The **loads are
per person**, because two people are not the same size and progress at their
own rate. Each can see what the other lifted on the same exercise, which is the
point of training as a pair.

It is built for the place it is used: a phone, in a gym, on a connection that
comes and goes. Ticking a set never waits on the network. The screen stays
awake. Every target explains itself — why the weight went up, held or came
down — because the people using it are beginners and a bare number teaches
nothing.

The programme is written once per block and can be tailored by a language
model, but the **loads never are**. Those come from a small, tested set of
progression rules that run with no network and no API key. The application
works completely without the model; it simply starts from a standard template
instead.

## Stack

- Next.js (App Router, TypeScript)
- Supabase — PostgreSQL, authentication, storage
- Tailwind CSS
- Deployed on Vercel behind Cloudflare DNS

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
```

### Database

Apply the files in `supabase/migrations/` in order (`0001` … `0006`) to the
Supabase project — either through the SQL editor in the dashboard, or with the
Supabase CLI:

```bash
supabase db push
```

Disable public sign-ups in the Supabase dashboard
(*Authentication → Sign In / Providers → Email → Allow new users to sign up*).
Accounts are provisioned explicitly.

### First account

```bash
node scripts/create-owner.mjs "Your Name" you@example.com "your-password"
```

The second account is created in **Settings → Members**, which returns a
one-time invitation code. The invited member enters that code with their email
at `/join` and chooses their own password.

## The opening screen

Today's training day, then the state of the habit: the week as seven dots
against the weekly target, the sets, load and personal records of the week so
far, thirteen weeks of the activity grid, and which muscle groups the week has
and has not touched. Under those, the last session's recap, whether the partner
has trained, and body weight over time.

Every card has an empty state rather than disappearing, so the screen is worth
looking at before there is any history behind it.

## Training days

A day is named after the weekday it falls on — three sessions a week is
Segunda, Quarta, Sexta — and described by the muscle groups it works, in plain
words. The screen opens on the day matching today, falling back to the rotation
on a day the block does not schedule.

Each day is built to fill the session length in the settings. That length is a
floor, not a ceiling: `src/lib/duration.ts` turns a prescription into minutes
from its sets, rest, warm-ups and the walk between stations, and a generated
day that would be over too early is rejected and asked for again. Running long
is never rejected — some sessions simply take longer.

## During a session

A session takes a snapshot of what it prescribes when it starts, so rebuilding
the block never disturbs a workout in progress, and either member can add or
drop an exercise mid-session without touching the programme both of them
follow.

The screen is held awake for as long as the session runs (per device, and
switchable off from the session's adjust panel), the body weight is asked for
once at the start if it has not been recorded that day, and every target says
why it is the number it is — added, held or deloaded — rather than presenting
a bare weight.

The rotation suggests the next training day, but any day of the block can be
chosen instead.

Loads move by the increment for that lift, or the number can be typed directly
for a machine's pin or a fixed dumbbell. Repetition targets have their own
control, so deciding on fifteen after doing ten does not mean typing it into
every row. Both apply to the sets not yet done.

Every exercise carries an explanation written for someone who has never done
it: the movement in numbered steps, the mistakes that are usually made, and the
catalogue's two frames cross-fading so the lift reads as a movement rather than
two photographs.

Leaving is not the same as giving up. The arrow in the header leaves the
session open and a "Treino a meio · Retomar" bar then follows you across every
screen until you go back to it. Abandoning is a separate, deliberate action at
the bottom of the adjust panel: it closes the session, and no progression is
computed from it.

Holds — planks, side planks, the superman — are logged in seconds, with a work
timer that counts the hold itself and writes the time actually held. Unilateral
work is logged as the total across both sides, because that is what the
progression rules count, and the interface shows the split ("10 por lado").
When an unloaded exercise finishes every set at the top of its range, the next
session says to add a set rather than another repetition.

## Supersets and freestyle

Two exercises can be paired mid-session — "juntar ao anterior" — and are then
worked through as rounds, back to back, with a single rest at the end of each
round. Unpairing is one tap, and a group left with a single member dissolves
itself. Planned supersets carry over into the session when it starts.

A session can also begin with nothing in it: exercises are chosen as you go and
each arrives with the weight you worked up to.

## Offline

Ticking a set never waits on the network. The row is written to IndexedDB
first and sent afterwards; entries survive the phone locking, the tab closing
and the app being killed, and are replayed when the connection returns, on the
next foreground, or on the next visit. Only the last state of a set is
replayed, so ticking, correcting and un-ticking collapse to one write.

The training screen shows what is waiting, and finishing a session flushes the
queue first: the progression must not be computed from a partial session.

A service worker (`public/sw.js`, no build plugin) makes the application
installable and lets it open with no connection: static assets and exercise
artwork are served cache-first, pages network-first with the last copy as a
fallback. It never touches writes — the queue owns the retry. Note that cached
pages sit in the browser's cache on that device.

## Progress

Four readings of the same history, one screen each:

- **Peso** — body weight over time with a goal line, each change coloured by
  whether it moves towards the goal
- **Atividade** — a year of training as a grid, one square per day, shaded by
  how many sets it held, plus volume per session
- **Músculos** — a schematic body, front and back, shaded by where the week's
  work went, naming the groups that received none
- **Força** — current working weight per lift, with the best set behind it and
  the estimated one-repetition maximum

Every chart is server-rendered SVG: no charting library, nothing to hydrate,
and they still draw with no connection.

## Programme generation

`GEMINI_API_KEY` enables tailored blocks. The model chooses the movements, the
order and the repetition ranges from the local catalogue; it never sets loads,
which stay with the progression engine.

The request carries both members' heights, body weights, ages, current working
weights and anything they have flagged as painful, so that the block suits the
pair. Everything the model returns is validated before it reaches the database:
known exercises only, sane set and repetition counts, no exercise twice in a
day, a weekly volume ceiling per muscle group, and a day long enough to fill
the session. If generation fails twice, or no key is configured, the built-in
template is used instead, so there is always a plan.

The model is not asked to name the days either — that comes from the weekday —
and the response schema pins each exercise to an enum of catalogue slugs for
the active equipment profile, so it cannot invent a movement or reach for a
barbell during a hotel week.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `node scripts/generate-icons.mjs` | Regenerate the application icons |
| `node scripts/create-owner.mjs` | Provision the first account |
| `node scripts/build-catalogue.mjs` | Rebuild the exercise catalogue and artwork |
| `node scripts/seed-catalogue.mjs` | Upload the catalogue to the database |
| `npm run lint` | Next.js lint |
| `npm test` | Unit tests for progression and plan validation |

## Deployment

Vercel, behind Cloudflare DNS. `gym.<domain>` is a CNAME to
`cname.vercel-dns.com`, DNS only — proxying it through Cloudflare breaks the
certificate Vercel issues.

Functions run in `dub1` (Dublin), next door to the Supabase project in
`eu-west-1`: the round trips to the database dominate, so the function belongs
beside it rather than beside the user.

Environment variables to set on the project, for every environment:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | the project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the secret key |
| `GEMINI_API_KEY` | optional, for tailored blocks |

## Interface language

The interface is European Portuguese; the code, comments and commit messages
are English. That boundary is deliberate and worth keeping — the application
belongs to the two people who use it, and the repository belongs to whoever
reads it next.

## Notes

This application is a training log. It does not provide medical advice.

It is built for two named people and their equipment. It is published because
the code may be useful to read, not because it is meant to be run by anyone
else: sign-up is closed, accounts are provisioned by hand, and the exercise
catalogue is deliberately 43 movements rather than a thousand.
