import assert from "node:assert/strict";
import test from "node:test";
import { emailList, requireUser } from "../api/_lib/auth.js";
import {
  globalDailyLimitCents,
  maxActiveGenerations,
  userDailyLimitCents,
} from "../api/_lib/db.js";
import { welcomeEmail } from "../api/_lib/email.js";
import {
  extractMedia,
  OUTCOME_CONFIG,
  resolveGenerationConfig,
  submitFal,
} from "../api/_lib/fal.js";
import { publicError } from "../api/_lib/http.js";
import {
  CREDIT_PACKS,
  creditPack,
  stripeKey,
  verifiedCheckoutCredit,
} from "../api/_lib/stripe.js";

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

test("generation settings resolve into the intended text, reference, and motion routes", () => {
  const draft = resolveGenerationConfig("fast", {
    prompt: "A quiet observatory",
    aspectRatio: "9:16",
  });
  assert.equal(draft.model, "fal-ai/flux/schnell");
  assert.equal(draft.input.image_size, "portrait_16_9");

  const transform = resolveGenerationConfig("quality", {
    prompt: "Preserve the bottle",
    referenceUrl: "https://cdn.example/reference.jpg",
    referenceStrength: 5,
    style: "product",
  });
  assert.equal(transform.model, "fal-ai/flux/krea/image-to-image");
  assert.equal(transform.input.image_url, "https://cdn.example/reference.jpg");
  assert.equal(transform.input.strength, 0.95);
  assert.match(transform.input.prompt, /Premium product photography/);

  const motion = resolveGenerationConfig("cinematic", {
    prompt: "The fabric moves in the wind",
    referenceUrl: "https://cdn.example/frame.webp",
    aspectRatio: "1:1",
  });
  assert.equal(motion.model, "fal-ai/kling-video/v2.5-turbo/pro/image-to-video");
  assert.equal(motion.input.image_url, "https://cdn.example/frame.webp");
  assert.equal(motion.input.aspect_ratio, "1:1");

  assert.throws(
    () => resolveGenerationConfig("fast", {
      prompt: "Transform it",
      referenceUrl: "https://cdn.example/reference.jpg",
    }),
    /References require/,
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

test("founder gift email includes the isolated wallet credit and message", () => {
  const email = welcomeEmail({
    name: "Hossam",
    gift: {
      fromName: "Naoufal",
      creditCents: 500,
      message: "The pixels have accountants now.",
    },
  });
  assert.match(email.subject, /Naoufal/);
  assert.match(email.text, /\$5\.00/);
  assert.match(email.text, /pixels have accountants/);
  assert.match(email.html, /Founder transmission/);
});

test("French accounts receive a localized welcome and founder gift", () => {
  const email = welcomeEmail({
    name: "Hossam",
    language: "fr",
    gift: {
      fromName: "Naoufal",
      creditCents: 500,
      message: "Naoufal split the photon budget 50/50. Spend your half wisely—the pixels have accountants now.",
    },
  });
  assert.match(email.subject, /cadeau de fondateur/i);
  assert.match(email.text, /5,00\s\$US/);
  assert.match(email.text, /même les pixels/);
  assert.match(email.html, /lang="fr"/);
  assert.match(email.html, /Ouvrir le studio/);
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

test("Stripe credit packs are fixed server-side and checkout amounts are revalidated", () => {
  assert.deepEqual(
    Object.values(CREDIT_PACKS).map(({ id, amountCents }) => ({ id, amountCents })),
    [
      { id: "signal-10", amountCents: 1000 },
      { id: "signal-25", amountCents: 2500 },
      { id: "signal-50", amountCents: 5000 },
    ],
  );
  assert.equal(creditPack("unknown"), null);

  const credit = verifiedCheckoutCredit({
    id: "cs_test_lmiere",
    currency: "usd",
    amount_total: 2500,
    payment_status: "paid",
    payment_intent: "pi_test_lmiere",
    customer: "cus_test_lmiere",
    metadata: {
      lmiere_user_id: "11111111-1111-4111-8111-111111111111",
      lmiere_pack_id: "signal-25",
      lmiere_credit_cents: "2500",
    },
  });
  assert.equal(credit.amountCents, 2500);
  assert.equal(credit.packId, "signal-25");

  assert.throws(() => verifiedCheckoutCredit({
    id: "cs_test_tampered",
    currency: "usd",
    amount_total: 1000,
    payment_status: "paid",
    metadata: {
      lmiere_user_id: "11111111-1111-4111-8111-111111111111",
      lmiere_pack_id: "signal-25",
      lmiere_credit_cents: "2500",
    },
  }), /amount does not match/i);
});

test("Stripe stays locked to test credentials until live mode is deliberately enabled", () => {
  const previous = {
    secret: process.env.STRIPE_SECRET_KEY,
    restricted: process.env.STRIPE_RESTRICTED_KEY,
    testMode: process.env.LMIERE_STRIPE_TEST_MODE,
  };
  delete process.env.STRIPE_RESTRICTED_KEY;
  delete process.env.LMIERE_STRIPE_TEST_MODE;
  process.env.STRIPE_SECRET_KEY = `sk${"_live_not_allowed"}`;
  assert.throws(() => stripeKey(), /locked to Stripe test mode/);
  process.env.STRIPE_SECRET_KEY = `sk${"_test_allowed"}`;
  assert.equal(stripeKey(), `sk${"_test_allowed"}`);

  for (const [key, value] of Object.entries({
    STRIPE_SECRET_KEY: previous.secret,
    STRIPE_RESTRICTED_KEY: previous.restricted,
    LMIERE_STRIPE_TEST_MODE: previous.testMode,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
