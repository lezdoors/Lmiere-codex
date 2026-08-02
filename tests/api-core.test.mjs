import assert from "node:assert/strict";
import test from "node:test";
import { requireUser } from "../api/_lib/auth.js";
import { extractMedia, OUTCOME_CONFIG, submitFal } from "../api/_lib/fal.js";
import { publicError } from "../api/_lib/http.js";

test("generation routes map to the intended provider models and customer prices", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(OUTCOME_CONFIG).map(([key, value]) => [key, {
      model: value.model,
      chargeCents: value.chargeCents,
    }])),
    {
      fast: { model: "fal-ai/flux/schnell", chargeCents: 8 },
      cinematic: { model: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video", chargeCents: 42 },
      quality: { model: "fal-ai/flux-pro/v1.1-ultra", chargeCents: 76 },
    },
  );
});

test("media extraction supports Fal image and video results", () => {
  assert.deepEqual(
    extractMedia({ data: { images: [{ url: "https://cdn.example/result.jpg", content_type: "image/jpeg" }] } }),
    { url: "https://cdn.example/result.jpg", contentType: "image/jpeg" },
  );
  assert.deepEqual(
    extractMedia({ data: { video: { url: "https://cdn.example/result.mp4" } } }),
    { url: "https://cdn.example/result.mp4", contentType: "video/mp4" },
  );
});

test("paid provider calls are blocked unless explicitly enabled", async () => {
  const previous = process.env.LMIERE_ENABLE_PAID_GENERATIONS;
  delete process.env.LMIERE_ENABLE_PAID_GENERATIONS;
  await assert.rejects(
    submitFal("fast", "A test prompt"),
    /Paid generations are disabled/,
  );
  if (previous === undefined) delete process.env.LMIERE_ENABLE_PAID_GENERATIONS;
  else process.env.LMIERE_ENABLE_PAID_GENERATIONS = previous;
});

test("API identity checks reject requests without a Neon bearer token", async () => {
  await assert.rejects(
    requireUser({ headers: {} }),
    (error) => error.statusCode === 401 && /Sign in/.test(error.message),
  );
});

test("wallet errors become stable user-facing responses", () => {
  assert.deepEqual(publicError(new Error("insufficient_credits")), {
    status: 402,
    message: "This wallet does not have enough credits for that run.",
  });
});
