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
