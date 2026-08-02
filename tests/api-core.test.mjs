import assert from "node:assert/strict";
import test from "node:test";
import { emailList, requireUser } from "../api/_lib/auth.js";
import {
  globalDailyLimitCents,
  maxActiveGenerations,
  userDailyLimitCents,
} from "../api/_lib/db.js";
import { welcomeEmail } from "../api/_lib/email.js";
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

test("private beta email lists are normalized and deduplicated", () => {
  assert.deepEqual(
    [...emailList(" Ryan@Example.com, hossam@example.com,ryan@example.com ")],
    ["ryan@example.com", "hossam@example.com"],
  );
});

test("beta spend protections have safe defaults and accept explicit zeroes", () => {
  const previous = {
    user: process.env.LMIERE_DAILY_USER_LIMIT_CENTS,
    global: process.env.LMIERE_DAILY_GLOBAL_LIMIT_CENTS,
    active: process.env.LMIERE_MAX_ACTIVE_GENERATIONS,
  };
  delete process.env.LMIERE_DAILY_USER_LIMIT_CENTS;
  delete process.env.LMIERE_DAILY_GLOBAL_LIMIT_CENTS;
  delete process.env.LMIERE_MAX_ACTIVE_GENERATIONS;
  assert.equal(userDailyLimitCents(), 500);
  assert.equal(globalDailyLimitCents(), 2000);
  assert.equal(maxActiveGenerations(), 2);

  process.env.LMIERE_DAILY_USER_LIMIT_CENTS = "0";
  process.env.LMIERE_DAILY_GLOBAL_LIMIT_CENTS = "0";
  process.env.LMIERE_MAX_ACTIVE_GENERATIONS = "0";
  assert.equal(userDailyLimitCents(), 0);
  assert.equal(globalDailyLimitCents(), 0);
  assert.equal(maxActiveGenerations(), 0);

  for (const [key, value] of Object.entries({
    LMIERE_DAILY_USER_LIMIT_CENTS: previous.user,
    LMIERE_DAILY_GLOBAL_LIMIT_CENTS: previous.global,
    LMIERE_MAX_ACTIVE_GENERATIONS: previous.active,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("welcome email is branded, reply-friendly, and escapes account names", () => {
  const email = welcomeEmail({ name: "<Ryan>" });
  assert.match(email.subject, /verified/i);
  assert.match(email.text, /https:\/\/lmiere.com\/studio/);
  assert.doesNotMatch(email.html, /<Ryan>/);
  assert.match(email.html, /&lt;Ryan&gt;/);
});

test("wallet errors become stable user-facing responses", () => {
  assert.deepEqual(publicError(new Error("insufficient_credits")), {
    status: 402,
    message: "This wallet does not have enough credits for that run.",
  });
  assert.deepEqual(publicError(new Error("user_daily_limit_reached")), {
    status: 429,
    message: "This account reached its daily beta limit. Try again tomorrow.",
  });
});
