# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Lmiere Product Direction

- Treat `design-reference.png` as the visual source of truth.
- The interface is a recovered archival field manual that wakes into a living render network.
- The light/dark transformation is state-driven: light is dormant, dark is focused or generating.
- Preserve the simple customer journey: describe, choose an outcome, see the exact price, generate.
- Keep Fal provider details and technical model names out of the default customer experience.
- Prototype with mocked jobs and credits first. Neon Auth, per-user credit ledgers, and Fal integration come after the UI is approved.
- Use warm bone, forest green, oxidized ultramarine, and sulfur amber. Avoid generic AI gradients, glassmorphism, dashboard grids, and excessive animation.
