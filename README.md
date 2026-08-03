# Lmiere

Lmiere is a pay-per-generation image and motion studio designed for people who want capable AI tools without provider dashboards, model jargon, or shared team credits.

The experience has three deliberately separate visual systems:

- a warm archival field manual for discovery and trust;
- a dark signal-room studio for generation and private wallet work;
- an electric ultramarine editorial archive for completed records.

## Product routes

- `/` — field manual and outcome pricing
- `/studio` — generation studio
- `/archive` — private generation archive
- `/runs/:id` — complete run record and remix entry point
- `/account` — wallet, ledger, and account actions
- `/reset-password` — short-lived account recovery flow
- `/privacy` and `/terms` — beta legal drafts

Images use a localized cursor-reactive deformation: a small liquid swirl bends the artwork directly beneath the pointer without disturbing the rest of the composition. The effect, along with the account background motion, is disabled when the visitor prefers reduced motion.

## Architecture

- React + Vite interface
- Vercel Functions under `api/`
- Neon Managed Auth and Postgres for isolated user wallets, immutable credit ledger entries, and generation history
- Fal queue API called only from the server
- Optional Vercel Blob persistence for completed media
- Resend transactional email with idempotent welcome mail and signed delivery webhooks
- Stripe-hosted Checkout for test-mode prepaid credit packs, with signed and idempotent wallet crediting

The browser never receives `FAL_KEY`, `DATABASE_URL`, or email-provider credentials. Paid provider calls are blocked unless `LMIERE_ENABLE_PAID_GENERATIONS=true` is explicitly configured. A verified email, optional private-beta allowlist, per-user daily cap, global daily cap, and active-run cap are all enforced before a provider request is created.

## Local setup

1. Copy `.env.example` to `.env.local` and fill the server-only values.
2. Apply `db/schema.sql` to a Neon development or preview branch.
3. Run the full local stack with `vercel dev`.

```sh
npm install
npm test
npm run build
```

## Account and email launch sequence

1. Apply `db/schema.sql` to a Neon preview branch and test it there first.
2. In Neon Auth, require email verification using six-digit OTP codes. Keep auto sign-in after verification enabled.
3. Add `lmiere.com` and `www.lmiere.com` as trusted origins. Disable localhost access on the production auth branch.
4. Configure MochaHost MX, SPF, and DKIM records at the active DNS provider. Publish a DMARC policy after both senders pass authentication.
5. Verify `updates.lmiere.com` in Resend, disable open/click tracking for auth email, and add the Resend environment variables.
6. Register `https://lmiere.com/api/webhooks/resend` for delivered, bounced, complained, failed, and suppressed email events.
7. Set the beta and administrator allowlists before enabling paid generation.

## Stripe test checkout

Lmiere offers fixed $10, $25, and $50 prepaid credit packs from `/account`. The server creates a hosted Stripe Checkout Session; the browser never receives a Stripe secret. A successful redirect does not change the wallet. Credit is added only when `/api/webhooks/stripe` verifies a paid Stripe event and the database atomically records both the Checkout Session and its ledger entry.

For local testing:

1. Keep `LMIERE_STRIPE_TEST_MODE=true` and put a test secret or restricted key in the ignored `.env.local` file.
2. Run the full app with `vercel dev`.
3. Forward Stripe test events with `stripe listen --forward-to http://127.0.0.1:3000/api/webhooks/stripe` and copy its temporary `whsec_…` value to `STRIPE_WEBHOOK_SECRET`.
4. Sign in with a verified test account, choose a pack, and complete hosted Checkout with a Stripe test card.
5. Confirm one `purchase` entry and one balance increase appear even if the webhook is delivered more than once.

Automatic tax is intentionally off. It must not be enabled until the operating company has confirmed its registrations and launch-country tax treatment. Replace the broad test secret with a least-privilege restricted key before live mode.

`GET /api/admin/readiness` gives an allowlisted operator a secret-free launch check. It never returns credential values.

## Business activation gates

Keep `LMIERE_ENABLE_PAID_GENERATIONS=false` until all of these are green:

- verified-email signup and password reset tested end to end;
- durable media storage configured (provider URLs are not a permanent archive);
- Resend delivery and bounce webhooks tested;
- private-beta allowlist and spend caps confirmed;
- privacy/terms reviewed for the launch countries;
- support, privacy, security, billing, abuse, and postmaster addresses deliver correctly;
- Stripe test-mode prepaid credit checkout, signed webhook crediting, refunds, tax treatment, and reconciliation completed.

Payments should use Stripe-hosted Checkout for prepaid credit packs. Credit is added only from a verified Stripe webhook, never from a browser redirect. Live billing and automatic tax are intentionally not implemented or enabled in this foundation.

## Deployment boundary

This repository is intended to deploy as its own Vercel project. The existing `lumen` project and the `lmiere.com` domain must remain unchanged until the replacement preview has been verified and approved.
