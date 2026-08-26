import { requireVerifiedUser } from "../_lib/auth.js";
import { uploadFalReference } from "../_lib/fal.js";
import { methodNotAllowed, publicError, readJsonBody, sendJson } from "../_lib/http.js";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_REFERENCE_BYTES = 2_750_000;

function safeFileName(value, contentType) {
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const stem = String(value || "reference")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "reference";
  return `${stem}.${extension}`;
}

function decodeImage(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl || "");
  if (!match || !ALLOWED_TYPES.has(match[1].toLowerCase())) {
    throw Object.assign(new Error("Use a JPEG, PNG, or WebP reference image."), { statusCode: 400 });
  }
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_REFERENCE_BYTES) {
    throw Object.assign(new Error("Keep reference images below 2.75 MB."), { statusCode: 413 });
  }
  return { bytes, contentType: match[1].toLowerCase() };
}

export default async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);

  try {
    await requireVerifiedUser(request);
    const body = readJsonBody(request);
    const { bytes, contentType } = decodeImage(body.dataUrl);
    const url = await uploadFalReference({
      bytes,
      contentType,
      name: safeFileName(body.name, contentType),
    });
    return sendJson(response, 201, { reference: { url, contentType } });
  } catch (error) {
    const problem = error.statusCode && error.statusCode < 500
      ? { status: error.statusCode, message: error.message }
      : publicError(error);
    return sendJson(response, problem.status, { error: problem.message });
  }
}
