# GYM

A private training log and programme for two people who train together.

Both members follow the same programme; loads and repetitions are tracked per
person. Built mobile first, for use on a phone in a gym with unreliable
connectivity.

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

Apply `supabase/migrations/0001_init.sql` to the Supabase project — either
through the SQL editor in the dashboard, or with the Supabase CLI:

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
- **Actividade** — a year of training as a grid, one square per day, shaded by
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
pair. Everything the model returns is validated — known exercises only, sane
set and repetition counts, a weekly volume ceiling per muscle group — before it
reaches the database. If generation fails twice, or no key is configured, the
built-in template is used instead, so there is always a plan.

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
| `npm test` | Unit tests for progression and plan validation |

## Notes

This application is a training log. It does not provide medical advice.
