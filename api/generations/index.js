import { nanoid } from "nanoid";
import { requireVerifiedUser } from "../_lib/auth.js";
import {
  markGenerationQueued,
  releaseGeneration,
  reserveGeneration,
} from "../_lib/db.js";
import { OUTCOME_CONFIG, resolveGenerationConfig, submitFal } from "../_lib/fal.js";
import { methodNotAllowed, publicError, readJsonBody, sendJson } from "../_lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);

  let user;
  let generationId;

  try {
    user = await requireVerifiedUser(request);
    const body = readJsonBody(request);
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const outcome = typeof body.outcome === "string" ? body.outcome : "";
    const referenceUrl = typeof body.referenceUrl === "string" ? body.referenceUrl.trim() : "";
    const style = typeof body.style === "string" ? body.style : "natural";
    const aspectRatio = typeof body.aspectRatio === "string" ? body.aspectRatio : undefined;
    const referenceStrength = body.referenceStrength;
    const config = OUTCOME_CONFIG[outcome];

    if (!config) return sendJson(response, 400, { error: "Choose a valid outcome." });
    if (!prompt || prompt.length > 2000) {
      return sendJson(response, 400, { error: "Use a prompt between 1 and 2,000 characters." });
    }
    if (referenceUrl) {
      let parsed;
      try {
        parsed = new URL(referenceUrl);
      } catch {
        return sendJson(response, 400, { error: "Use a valid HTTPS reference URL." });
      }
      if (parsed.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
        return sendJson(response, 400, { error: "Use a public HTTPS reference URL." });
      }
    }

    const resolved = resolveGenerationConfig(outcome, {
      prompt,
      referenceUrl,
      style,
      aspectRatio,
      referenceStrength,
    });

    generationId = `lm_${nanoid(14)}`;
    await reserveGeneration({
      id: generationId,
      userId: user.id,
      outcome,
      model: resolved.model,
      prompt,
      chargeCents: config.chargeCents,
    });

    const queued = await submitFal(outcome, prompt, {
      referenceUrl,
      style,
      aspectRatio,
      referenceStrength,
    });
    const generation = await markGenerationQueued(generationId, user.id, queued.request_id);
    return sendJson(response, 202, { generation });
  } catch (error) {
    if (user && generationId) {
      try {
        await releaseGeneration(generationId, user.id, "failed", error.message);
      } catch {
        // Preserve the original provider or validation error.
      }
    }
    const problem = error.statusCode && error.statusCode < 500
      ? { status: error.statusCode, message: error.message }
      : publicError(error);
    return sendJson(response, problem.status, { error: problem.message });
  }
}
