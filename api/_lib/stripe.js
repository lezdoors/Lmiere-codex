import Stripe from "stripe";

export const CREDIT_PACKS = Object.freeze({
  "signal-10": Object.freeze({
    id: "signal-10",
    name: "Signal 10",
    amountCents: 1000,
  }),
  "signal-25": Object.freeze({
    id: "signal-25",
    name: "Signal 25",
    amountCents: 2500,
  }),
  "signal-50": Object.freeze({
    id: "signal-50",
    name: "Signal 50",
    amountCents: 5000,
  }),
});

let stripeClient;

export function stripeKey() {
  const key = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe test mode is not configured.");
  if (process.env.LMIERE_STRIPE_TEST_MODE !== "false" && !/^[sr]k_test_/.test(key)) {
    throw new Error("Lmiere is locked to Stripe test mode.");
  }
  return key;
}

export function stripe() {
  if (!stripeClient) {
    stripeClient = new Stripe(stripeKey(), {
      apiVersion: "2026-07-29.dahlia",
      appInfo: {
        name: "Lmiere",
        version: "0.0.0",
        url: "https://lmiere.com",
      },
    });
  }
  return stripeClient;
}

export function stripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("The Stripe webhook secret is not configured.");
  return secret;
}

export function creditPack(packId) {
  return CREDIT_PACKS[packId] ?? null;
}

export function appOrigin() {
  const configured = (process.env.LMIERE_APP_URL || "https://lmiere.com").replace(/\/$/, "");
  const origin = new URL(configured);
  if (origin.protocol !== "https:" && origin.hostname !== "127.0.0.1" && origin.hostname !== "localhost") {
    throw new Error("LMIERE_APP_URL must use HTTPS outside local development.");
  }
  return origin.origin;
}

export async function createCreditCheckout({ user, pack, language = "en" }) {
  return stripe().checkout.sessions.create({
    mode: "payment",
    integration_identifier: "lmiere_credits_hxnqvkpd",
    customer_email: user.email,
    client_reference_id: user.id,
    locale: language === "fr" ? "fr" : "en",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pack.amountCents,
          product_data: {
            name: `Lmiere ${pack.name}`,
            description: `${pack.amountCents / 100} USD in prepaid generation credit`,
          },
        },
      },
    ],
    metadata: {
      lmiere_user_id: user.id,
      lmiere_pack_id: pack.id,
      lmiere_credit_cents: String(pack.amountCents),
    },
    payment_intent_data: {
      metadata: {
        lmiere_user_id: user.id,
        lmiere_pack_id: pack.id,
        lmiere_credit_cents: String(pack.amountCents),
      },
    },
    success_url: `${appOrigin()}/account?checkout=success`,
    cancel_url: `${appOrigin()}/account?checkout=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + (30 * 60),
  });
}

export function verifiedCheckoutCredit(session) {
  const pack = creditPack(session?.metadata?.lmiere_pack_id);
  const amountCents = Number.parseInt(session?.metadata?.lmiere_credit_cents ?? "", 10);
  const userId = session?.metadata?.lmiere_user_id;

  if (!pack || !userId || amountCents !== pack.amountCents) {
    throw new Error("Stripe checkout metadata does not match a Lmiere credit pack.");
  }
  if (session.currency !== "usd" || session.amount_total !== pack.amountCents) {
    throw new Error("Stripe checkout amount does not match the requested Lmiere credit pack.");
  }
  if (session.payment_status !== "paid") {
    throw new Error("Stripe checkout is not paid.");
  }

  return {
    checkoutSessionId: session.id,
    paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
    stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
    userId,
    packId: pack.id,
    amountCents: pack.amountCents,
    currency: "usd",
  };
}
