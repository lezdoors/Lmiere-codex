export function sendJson(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

export function methodNotAllowed(response, allowed) {
  response.setHeader("Allow", allowed.join(", "));
  return sendJson(response, 405, { error: "Method not allowed." });
}

export function readJsonBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string" && request.body.length > 0) {
    return JSON.parse(request.body);
  }
  return {};
}

export function publicError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("insufficient_credits")) {
    return { status: 402, message: "This wallet does not have enough credits for that run." };
  }
  if (message.includes("generation_not_found")) {
    return { status: 404, message: "Generation not found." };
  }
  if (message.includes("Paid generations are disabled")) {
    return { status: 503, message };
  }
  return { status: 500, message: "The machine could not complete that request." };
}
