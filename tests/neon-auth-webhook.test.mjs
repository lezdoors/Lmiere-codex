import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  passwordResetEmail,
  verificationCodeEmail,
} from "../api/_lib/email.js";
import {
  clearNeonAuthJwksCache,
  lmiereResetUrl,
  verifyNeonAuthWebhook,
} from "../api/_lib/neon-auth-webhook.js";

function signedWebhook(payload, { timestamp = Date.now(), kid = "lmiere-test-key" } = {}) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const publicJwk = publicKey.export({ format: "jwk" });
  publicJwk.kid = kid;
  publicJwk.alg = "EdDSA";
  publicJwk.use = "sig";

  const rawBody = JSON.stringify(payload);
  const protectedHeader = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWS", kid }))
    .toString("base64url");
  const payloadB64 = Buffer.from(rawBody, "utf8").toString("base64url");
  const signaturePayload = `${timestamp}.${payloadB64}`;
  const signaturePayloadB64 = Buffer.from(signaturePayload, "utf8").toString("base64url");
  const signingInput = `${protectedHeader}.${signaturePayloadB64}`;
  const signature = crypto.sign(null, Buffer.from(signingInput), privateKey).toString("base64url");

  return {
    rawBody,
    publicJwk,
    headers: {
      "x-neon-signature": `${protectedHeader}..${signature}`,
      "x-neon-signature-kid": kid,
      "x-neon-timestamp": String(timestamp),
      "x-neon-event-id": payload.event_id,
      "x-neon-event-type": payload.event_type,
    },
  };
}

test("password reset email uses only Lmiere-facing branding and links", () => {
  const actionUrl = lmiereResetUrl("secret token", "https://www.lmiere.com");
  const email = passwordResetEmail({
    name: "Ryan Aoufal",
    actionUrl,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });

  assert.equal(actionUrl, "https://www.lmiere.com/reset-password?token=secret+token");
  assert.match(email.subject, /Lmiere/);
  assert.match(email.text, /www\.lmiere\.com\/reset-password/);
  assert.match(email.html, /Choose a new key/);
  assert.doesNotMatch(`${email.subject}${email.text}${email.html}`, /lmiere-codex|neon\.tech|Neon Auth/i);
});

test("verification email presents the OTP as a branded Lmiere signal", () => {
  const email = verificationCodeEmail({
    name: "Hossam Haddaoui",
    code: "482193",
    purpose: "email-verification",
  });

  assert.match(email.subject, /Lmiere verification code/);
  assert.match(email.text, /482193/);
  assert.match(email.html, />482193</);
  assert.doesNotMatch(`${email.subject}${email.text}${email.html}`, /lmiere-codex|neon\.tech|Neon Auth/i);
});

test("Neon Auth delivery webhooks require a fresh valid Ed25519 detached JWS", async () => {
  clearNeonAuthJwksCache();
  const now = Date.now();
  const payload = {
    event_id: "550e8400-e29b-41d4-a716-446655440000",
    event_type: "send.otp",
    timestamp: new Date(now).toISOString(),
    user: { email: "member@example.com", name: "Member" },
    event_data: { otp_code: "123456", otp_type: "email-verification" },
  };
  const signed = signedWebhook(payload, { timestamp: now });
  const verified = await verifyNeonAuthWebhook(signed.rawBody, signed.headers, {
    jwksUrl: "https://auth.example.test/.well-known/jwks.json",
    now,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ keys: [signed.publicJwk] }),
    }),
  });
  assert.deepEqual(verified, payload);

  await assert.rejects(
    verifyNeonAuthWebhook(`${signed.rawBody} `, signed.headers, {
      jwksUrl: "https://auth.example.test/.well-known/jwks.json",
      now,
      fetchImpl: async () => ({ ok: true, json: async () => ({ keys: [signed.publicJwk] }) }),
    }),
    /signature is invalid/,
  );

  const stale = signedWebhook(payload, { timestamp: now - 6 * 60 * 1000 });
  await assert.rejects(
    verifyNeonAuthWebhook(stale.rawBody, stale.headers, {
      jwksUrl: "https://auth.example.test/.well-known/jwks.json",
      now,
      fetchImpl: async () => ({ ok: true, json: async () => ({ keys: [stale.publicJwk] }) }),
    }),
    /outside the accepted window/,
  );
});
