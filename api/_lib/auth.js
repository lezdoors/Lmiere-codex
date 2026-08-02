import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "./db.js";

let jwks;

function getJwks() {
  if (!process.env.NEON_AUTH_JWKS_URL) {
    throw new Error("NEON_AUTH_JWKS_URL is not configured.");
  }
  if (!jwks) jwks = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL));
  return jwks;
}

export async function requireUser(request) {
  const authorization = request.headers.authorization ?? "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    const error = new Error("Sign in is required.");
    error.statusCode = 401;
    throw error;
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      requiredClaims: ["sub", "exp"],
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new Error("Missing user identity.");
    }

    return { id: payload.sub, claims: payload };
  } catch {
    const error = new Error("Your session has expired. Please sign in again.");
    error.statusCode = 401;
    throw error;
  }
}

export function emailList(value = "") {
  return new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function accessError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export async function requireVerifiedUser(request) {
  const identity = await requireUser(request);
  const sql = db();
  const [record] = await sql`
    select id, email, name, "emailVerified" as email_verified, coalesce(banned, false) as banned
      from neon_auth."user"
      where id = ${identity.id}::uuid
      limit 1
  `;

  if (!record || record.banned) {
    throw accessError("This account is not available.", 401, "account_unavailable");
  }
  if (record.email_verified !== true) {
    throw accessError("Confirm your email before opening a wallet or starting a run.", 403, "email_verification_required");
  }

  const allowedEmails = emailList(process.env.LMIERE_ALLOWED_EMAILS);
  if (allowedEmails.size > 0 && !allowedEmails.has(record.email.toLowerCase())) {
    throw accessError("Lmiere is in a private beta. This email is not on the access list yet.", 403, "private_beta_only");
  }

  return {
    ...identity,
    email: record.email,
    name: record.name ?? "",
    emailVerified: true,
  };
}

export async function requireAdminUser(request) {
  const user = await requireVerifiedUser(request);
  const administrators = emailList(process.env.LMIERE_ADMIN_EMAILS);
  if (administrators.size === 0 || !administrators.has(user.email.toLowerCase())) {
    throw accessError("Operator access is required.", 403, "operator_access_required");
  }
  return user;
}
