# Design QA — Phase 2

final result: passed

## Source visual truth

- Landing source: `qa/reference-landing.png` — 1487 × 1058 px.
- Studio source: `qa/reference-studio.png` — 1487 × 1058 px.
- Archive direction: the user-supplied Hermes Agent feature-grid screenshot — 3024 × 1964 px including Safari chrome. The comparison crops the 2960 × 1600 page region beginning at x32/y300.
- Lmiere source artwork: `design-reference.png` and the four approved images in `public/assets/`.

The landing and studio are responsive interpretations of their source panels rather than same-size clones. For the mandatory combined comparison pass, each source and implementation capture was density-normalized onto a 900 × 640 panel without stretching, then joined side by side:

- `qa/phase2/compare-landing.png`
- `qa/phase2/compare-studio.png`
- `qa/phase2/compare-archive.png`

## Implementation evidence

Desktop, 1280 × 720 CSS px:

- `qa/phase2/landing-desktop-viewport.png`
- `qa/phase2/landing-hero-signal.png`
- `qa/phase2/landing-outcomes.png`
- `qa/phase2/landing-records.png`
- `qa/phase2/studio-desktop.png`
- `qa/phase2/archive-signed-out-desktop.png`
- `qa/phase2/account-signed-out-desktop.png`

Mobile, 390 × 844 CSS px:

- `qa/phase2/landing-mobile.png`
- `qa/phase2/landing-mobile-outcomes.png`
- `qa/phase2/studio-mobile.png`
- `qa/phase2/archive-mobile.png`
- `qa/phase2/auth-panel-mobile.png`
- `qa/phase2/privacy-mobile.png`

Tablet geometry was also checked at 1024 × 768 CSS px. Browser captures were taken at device scale and compared after density normalization; layout decisions were judged in CSS pixels.

## Mandatory comparison findings

- Typography: the landing keeps the monumental Bodoni/mono contrast and paper-manual hierarchy; the studio keeps the compressed mono signal-room language; the archive deliberately adopts the ultramarine/ivory editorial system. No generic UI font or rounded-card drift remains.
- Spacing and layout: all three systems keep square geometry, hard dividers, generous display-type breathing room, and clear separation between pricing, records, wallet, and legal content. The landing does not blend the dark studio into the manual page.
- Colors and tokens: warm paper/cobalt, night/signal green/sulfur, and electric ultramarine/ivory remain page-specific. Text contrast and selected states are visibly distinct.
- Imagery: approved source artwork is used without placeholder assets. The second supplied video is a 575 KB muted background signal on the authenticated account intro; the AKAL-branded clip was intentionally excluded to avoid a brand collision.
- Icons: interface icons come from the existing Phosphor family and retain consistent light stroke weight and alignment.
- Copy: provider/model names and internal infrastructure language are absent from public-facing pages. Outcome, privacy, archive, and wallet copy is written for nontechnical users.
- AI-shortcut artifacts: no decorative blobs, fake avatars, custom SVG illustrations, or generic floating cards were introduced.

## Responsive and accessibility checks

- `/`, `/studio`, `/archive`, `/account`, `/privacy`, `/terms`, `/runs/demo`, and the 404 route have no horizontal overflow at 390 px.
- The same core routes have no horizontal overflow at 1024 px.
- The archive display-word overflow found in the first mobile pass was fixed by constraining grid children and reducing the mobile display scale; final archive width is 390/390 CSS px.
- All images have alt attributes and all visible buttons have accessible names.
- The studio prompt exposes a level-one heading, while account and sealed run states use semantic `h1` headings.
- Focus indicators, practical mobile controls, labels, status/error roles, and keyboard-reachable navigation remain present.
- Signal-image flicker is cursor-reactive and uses pointer position; duplicate image layers are decorative and hidden from assistive technology.
- The hero apparatus now uses the same cursor-positioned signal system, with a localized scan-grid pulse and sliced image echoes verified over the apparatus region.
- Signal flicker, transitions, and the account background video are disabled under `prefers-reduced-motion: reduce`.

## States and interactions verified

- Landing navigation opens `/studio`.
- Studio navigation opens `/archive`; browser back returns to `/studio`.
- Archive sign-in opens the mobile authentication panel; its close control returns to the page.
- Prompt editing, outcome selection, exact-price display, signed-out run protection, archive/wallet gates, legal routes, direct run routes, and 404 rendering remain functional.
- Signed-out, empty/sealed, active navigation, and mobile stacked states were inspected.
- The preview log contains Vite development messages only: no Lmiere console errors or warnings.

## Iteration history

- P1 — Product shell stopped at the landing/studio pair. Fixed with real archive, run-record, account, privacy, terms, and 404 routes plus direct-route Vercel rewrites.
- P2 — Archive and wallet access were weak on mobile. Fixed with a dedicated three-action studio mobile navigation.
- P2 — Public copy exposed test-account/provider language. Fixed with customer-facing private-account and outcome language.
- P2 — Studio footer/output density collided at shorter desktop heights. Fixed by allowing the studio to scroll naturally and preserving the output frame.
- P2 — The first mobile archive pass overflowed by 32 px. Fixed and rechecked across all routes.
- P2 — Motion lacked the requested intentional signal corruption. Fixed with cursor-positioned image echoes and a reduced-motion fallback.

Final findings: P0 0, P1 0, P2 0.

## Build verification

- `npm test`: 9/9 passed.
- `npm run build`: passed.
- `npm run test:sites`: 4/4 passed.
- `vercel build --yes`: preview build passed, including SPA rewrites.
