import { requireUser } from "../_lib/auth.js";
import {
  getGeneration,
  mapGeneration,
  releaseGeneration,
  settleGeneration,
  updateGenerationProgress,
} from "../_lib/db.js";
import { extractMedia, getFalResult, getFalStatus, persistMedia } from "../_lib/fal.js";
import { methodNotAllowed, publicError, sendJson } from "../_lib/http.js";

function requestId(request) {
  if (typeof request.query?.id === "string") return request.query.id;
  const url = new URL(request.url, "http://localhost");
  return url.pathname.split("/").filter(Boolean).at(-1);
}

export default async function handler(request, response) {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);

  try {
    const user = await requireUser(request);
    const id = requestId(request);
    const record = await getGeneration(id, user.id);

    if (!record) return sendJson(response, 404, { error: "Generation not found." });
    if (["complete", "failed", "cancelled"].includes(record.status)) {
      return sendJson(response, 200, { generation: mapGeneration(record) });
    }
    if (!record.provider_request_id) {
      return sendJson(response, 200, { generation: mapGeneration(record) });
    }

    const status = await getFalStatus(record.model, record.provider_request_id);

    if (status.status === "IN_QUEUE") {
      const generation = await updateGenerationProgress(id, user.id, "in_queue", 12);
      return sendJson(response, 200, { generation });
    }
    if (status.status === "IN_PROGRESS") {
      const generation = await updateGenerationProgress(id, user.id, "in_progress", 58);
      return sendJson(response, 200, { generation });
    }

    let result;
    let media;
    try {
      result = await getFalResult(record.model, record.provider_request_id);
      media = extractMedia(result);
    } catch (providerError) {
      const statusCode = providerError?.status;
      const retryable = [408, 409, 425, 429].includes(statusCode) || statusCode >= 500;
      if (retryable) throw providerError;

      const generation = await releaseGeneration(
        id,
        user.id,
        "failed",
        "The provider could not complete this generation. No credits were charged.",
      );
      return sendJson(response, 200, { generation });
    }
    const storedUrl = await persistMedia({
      providerUrl: media.url,
      contentType: media.contentType,
      userId: user.id,
      generationId: id,
    });
    const generation = await settleGeneration({
      id,
      userId: user.id,
      resultUrl: storedUrl,
      providerResultUrl: media.url,
      contentType: media.contentType,
      providerPayload: result.data ?? result,
    });
    return sendJson(response, 200, { generation });
  } catch (error) {
    const problem = error.statusCode === 401
      ? { status: 401, message: error.message }
      : publicError(error);
    return sendJson(response, problem.status, { error: problem.message });
  }
}
