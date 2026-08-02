# Lmiere

Lmiere is a pay-per-generation image and motion studio designed for people who want capable AI tools without provider dashboards, model jargon, or shared team credits.

The experience has two deliberately separate visual systems:

- a warm archival field manual for discovery and trust;
- a dark signal-room studio for authenticated generation work.

## Architecture

- React + Vite interface
- Vercel Functions under `api/`
- Neon Managed Auth and Postgres for isolated user wallets, immutable credit ledger entries, and generation history
- Fal queue API called only from the server
- Optional Vercel Blob persistence for completed media

The browser never receives `FAL_KEY` or `DATABASE_URL`. Paid provider calls are blocked unless `LMIERE_ENABLE_PAID_GENERATIONS=true` is explicitly configured.

## Local setup

1. Copy `.env.example` to `.env.local` and fill the server-only values.
2. Apply `db/schema.sql` to a Neon development or preview branch.
3. Run the full local stack with `vercel dev`.

```sh
npm install
npm test
npm run build
```

## Deployment boundary

This repository is intended to deploy as its own Vercel project. The existing `lumen` project and the `lmiere.com` domain must remain unchanged until the replacement preview has been verified and approved.
