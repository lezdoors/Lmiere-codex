import { nanoid } from "nanoid";
import { requireUser } from "../_lib/auth.js";
import {
  markGenerationQueued,
  releaseGeneration,
  reserveGeneration,
} from "../_lib/db.js";
import { OUTCOME_CONFIG, submitFal } from "../_lib/fal.js";
import { methodNotAllowed, publicError, readJsonBody, sendJson } from "../_lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);

  let user;
  let generationId;

  try {
    user = await requireUser(request);
    const body = readJsonBody(request);
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const outcome = typeof body.outcome === "string" ? body.outcome : "";
    const config = OUTCOME_CONFIG[outcome];

    if (!config) return sendJson(response, 400, { error: "Choose a valid outcome." });
    if (!prompt || prompt.length > 2000) {
      return sendJson(response, 400, { error: "Use a prompt between 1 and 2,000 characters." });
    }

    generationId = `lm_${nanoid(14)}`;
    await reserveGeneration({
      id: generationId,
      userId: user.id,
      outcome,
      model: config.model,
      prompt,
      chargeCents: config.chargeCents,
    });

    const queued = await submitFal(outcome, prompt);
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
    const problem = error.statusCode === 401
      ? { status: 401, message: error.message }
      : publicError(error);
    return sendJson(response, problem.status, { error: problem.message });
  }
}
