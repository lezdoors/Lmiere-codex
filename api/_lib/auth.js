import { createRemoteJWKSet, jwtVerify } from "jose";

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
