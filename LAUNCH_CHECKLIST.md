# Lmiere launch gates

## Private founder beta

- Keep `LMIERE_ALLOWED_EMAILS` limited to the two founder accounts.
- Keep per-user and global daily spend limits non-zero, with no more than two active generations.
- Add `BLOB_READ_WRITE_TOKEN` so completed Fal media is copied into durable Lmiere storage instead of relying on provider URLs.
- Verify `updates.lmiere.com` in Resend, then add `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `LMIERE_EMAIL_FROM`, and `LMIERE_EMAIL_REPLY_TO` in Vercel.
- Configure Neon Auth’s custom email provider and webhook after Resend is ready; confirm both founder emails from the real domain.
- Add a Vercel WAF rate-limit rule for generation endpoints before inviting anyone outside the founders.
- Run one image and one video end to end: reservation, Fal queue, result storage, settlement, archive recovery, email delivery, and webhook receipt.

## Paid public beta

- Do not enable until Stripe checkout, signed webhooks, tax/VAT handling, receipts, refunds, and failed-payment recovery have been tested.
- In test mode, complete all three credit packs through hosted Checkout and confirm repeated webhook delivery never credits a wallet twice.
- Replace the test secret with a least-privilege restricted key, set a Vercel sensitive environment value, and register the production webhook endpoint only after the production deployment is approved.
- Reconcile Fal route cost manually and preserve margin. Fal does not currently expose a dependable public pricing API for automatic customer-price synchronization.
- Replace the beta legal draft with the actual controller/company identity, address, governing law, consumer terms, retention schedule, and processor list.
- Complete Morocco CNDP notification/authorization work and GDPR access, export, correction, and deletion operations.
- Keep the visible AI-generated label. Add machine-readable provenance/marking to downloaded media once the chosen provider/storage pipeline is verified to preserve it.
- Add privacy-safe funnel and reliability monitoring before spending on acquisition. Do not enable session replay before consent handling is ready.

## Release check

- `npm audit --omit=dev` returns zero known vulnerabilities.
- `npm test` and `npm run build` pass.
- Verify English and French on landing, auth, studio, archive, account, run, privacy, terms, reset, and transactional email.
- Test mobile at 390 px, tablet at 768 px, and desktop at 1440 px.
- Confirm the generation safety switch is deliberately set for the release environment.
- Confirm rollback: previous Vercel deployment remains available and database migrations are additive.
