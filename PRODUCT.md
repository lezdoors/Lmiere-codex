# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Lmiere is for people who want capable image and motion generation without learning provider dashboards, model names, checkpoints, or shared team-credit systems. The initial operating group is Ryan and Hossam; the broader audience is nontechnical and independent users in Europe, Morocco, and the United States, with English and French as first-class languages.

## Product Purpose

Lmiere turns an ordinary-language prompt into an image or short motion result through a simple sequence: describe the intended result, choose an outcome, approve the exact price, and generate. Success means Ryan and Hossam can use Lmiere instead of Higgsfield for daily work, each with a private balance and archive, before the same workflow is monetized for outside users.

## Positioning

Lmiere sells understandable outcomes at a visible per-generation price. It deliberately hides provider and model complexity from the default customer experience while preserving a private, auditable record of every credit movement and generation.

## Operating Context

Users arrive through the public landing page, create or verify an account, add prepaid credit, write a prompt in the studio, select an image or motion outcome, review its exact cost, and approve the run. They return to the archive to recover, download, or remix completed work and to the account screen to review their balance and ledger.

## Capabilities and Constraints

- Vite and React power the web client; Vercel hosts the site and serverless API routes.
- Neon Managed Auth and Postgres provide email/password identity, email verification, isolated wallets, immutable ledger entries, and per-user generation history.
- Fal is the initial generation provider. Provider names and model identifiers stay out of the default customer interface.
- Stripe-hosted Checkout supplies fixed prepaid credit packs in test mode. Wallet credit is applied only by a verified, idempotent webhook.
- English and French must cover the landing, authentication, studio, archive, account, run, legal, reset-password, and transactional-email experiences.
- Paid provider calls remain guarded by verified email, optional beta allowlists, per-user and global daily limits, active-run limits, and an explicit server environment switch.
- Generated media must be labeled as AI-generated. Durable result storage is required before public monetization.
- Live billing, tax treatment, refunds, privacy operations, and transactional email delivery remain launch gates until they are verified end to end.

## Brand Commitments

The product name is Lmiere. The public identity is a recovered field manual that wakes into a living render network: warm paper and oxidized cobalt for the landing, a pale north-lit optical bench for the studio, a focused dark private account area, and electric ultramarine for the archive. Monumental editorial type pairs with precise monospaced controls and metadata. Nous Research, Hermes Agent, and Offporter are principle references for confidence, pacing, contrast, spatial restraint, and image treatment; their layouts, assets, identity, markup, and copy are not to be reproduced.

## Evidence on Hand

- The current visual reference is [`design-reference.png`](./design-reference.png).
- Original Lmiere brand marks, app icons, and social artwork live in [`public/brand`](./public/brand).
- The current hero, specimen, result, Phosphor, and motion assets live in [`public/assets`](./public/assets).
- The implemented product routes and interaction states live in [`src/App.jsx`](./src/App.jsx), with the visual system in [`src/styles.css`](./src/styles.css).
- Backend safeguards and integration tests live in [`api`](./api), [`db`](./db), and [`tests`](./tests).
- No customer testimonials, usage benchmarks, partner logos, or public adoption claims are confirmed; future work must not fabricate them.

## Product Principles

1. Show the exact price before any paid generation begins.
2. Keep every balance, run, result, and ledger entry isolated to its verified owner.
3. Hide provider complexity without hiding cost, status, provenance, or failure.
4. Make the public experience memorable and the operating experience calm.
5. Earn monetization through verified reliability before expanding providers or features.

## Accessibility & Inclusion

The web experience must support keyboard navigation, visible focus, touch and coarse pointers, reduced motion with immediate final states, meaningful media alternatives, and usable responsive layouts in both English and French.
