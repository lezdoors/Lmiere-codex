import crypto from "node:crypto";

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;
const MAX_WEBHOOK_FUTURE_SKEW_MS = 60 * 1000;

let jwksCache = null;

export function requestHeader(headers, name) {
  return headers?.get?.(name)
    ?? headers?.[name]
    ?? headers?.[name.toLowerCase()];
}

async function fetchJwks(jwksUrl, fetchImpl, { force = false } = {}) {
  const now = Date.now();
  if (
    !force
    && jwksCache?.url === jwksUrl
    && now - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS
  ) {
    return jwksCache.value;
  }

  const response = await fetchImpl(jwksUrl, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Neon Auth signing keys could not be loaded.");
  const value = await response.json();
  if (!Array.isArray(value?.keys)) throw new Error("Neon Auth returned an invalid signing-key set.");
  jwksCache = { url: jwksUrl, fetchedAt: now, value };
  return value;
}

async function signingKey(jwksUrl, kid, fetchImpl) {
  let jwks = await fetchJwks(jwksUrl, fetchImpl);
  let jwk = jwks.keys.find((key) => key.kid === kid);
  if (!jwk) {
    jwks = await fetchJwks(jwksUrl, fetchImpl, { force: true });
    jwk = jwks.keys.find((key) => key.kid === kid);
  }
  if (!jwk) throw new Error("Neon Auth webhook signing key was not found.");
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519") {
    throw new Error("Neon Auth webhook signing key has an unexpected type.");
  }
  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

function webhookTimestamp(value, now) {
  if (!/^\d{13}$/.test(value ?? "")) throw new Error("Neon Auth webhook timestamp is invalid.");
  const timestamp = Number.parseInt(value, 10);
  const age = now - timestamp;
  if (age > MAX_WEBHOOK_AGE_MS || age < -MAX_WEBHOOK_FUTURE_SKEW_MS) {
    throw new Error("Neon Auth webhook timestamp is outside the accepted window.");
  }
  return timestamp;
}

export async function verifyNeonAuthWebhook(rawBody, headers, {
  jwksUrl = process.env.NEON_AUTH_JWKS_URL,
  fetchImpl = fetch,
  now = Date.now(),
} = {}) {
  if (!jwksUrl) throw new Error("NEON_AUTH_JWKS_URL is not configured.");

  const signature = requestHeader(headers, "x-neon-signature");
  const kid = requestHeader(headers, "x-neon-signature-kid");
  const timestampValue = requestHeader(headers, "x-neon-timestamp");
  const eventId = requestHeader(headers, "x-neon-event-id");
  const eventType = requestHeader(headers, "x-neon-event-type");
  if (!signature || !kid || !timestampValue || !eventId || !eventType) {
    throw new Error("Neon Auth webhook signature headers are missing.");
  }
  webhookTimestamp(timestampValue, now);

  const parts = signature.split(".");
  if (parts.length !== 3 || parts[1] !== "" || !parts[0] || !parts[2]) {
    throw new Error("Neon Auth webhook signature is not a detached JWS.");
  }
  const [headerB64, , signatureB64] = parts;
  let protectedHeader;
  try {
    protectedHeader = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
  } catch {
    throw new Error("Neon Auth webhook signature header is invalid.");
  }
  if (protectedHeader.alg !== "EdDSA" || protectedHeader.kid !== kid) {
    throw new Error("Neon Auth webhook signature header does not match its key.");
  }

  const payloadB64 = Buffer.from(rawBody, "utf8").toString("base64url");
  const signaturePayload = `${timestampValue}.${payloadB64}`;
  const signaturePayloadB64 = Buffer.from(signaturePayload, "utf8").toString("base64url");
  const signingInput = `${headerB64}.${signaturePayloadB64}`;
  const publicKey = await signingKey(jwksUrl, kid, fetchImpl);
  const verified = crypto.verify(
    null,
    Buffer.from(signingInput, "utf8"),
    publicKey,
    Buffer.from(signatureB64, "base64url"),
  );
  if (!verified) throw new Error("Neon Auth webhook signature is invalid.");

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error("Neon Auth webhook body is not valid JSON.");
  }
  if (payload?.event_id !== eventId || payload?.event_type !== eventType) {
    throw new Error("Neon Auth webhook metadata does not match its signed body.");
  }
  return payload;
}

export function lmiereResetUrl(token, appUrl = process.env.LMIERE_APP_URL || "https://www.lmiere.com") {
  if (!token) throw new Error("Password-reset token is missing.");
  const url = new URL("/reset-password", appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function clearNeonAuthJwksCache() {
  jwksCache = null;
}
