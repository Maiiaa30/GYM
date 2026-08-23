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

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `node scripts/generate-icons.mjs` | Regenerate the application icons |
| `node scripts/create-owner.mjs` | Provision the first account |

## Notes

This application is a training log. It does not provide medical advice.
