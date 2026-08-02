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
  if (message.includes("email_verification_required")) {
    return { status: 403, message: "Confirm your email before opening a wallet or starting a run." };
  }
  if (message.includes("private_beta_only")) {
    return { status: 403, message: "Lmiere is in a private beta. This email is not on the access list yet." };
  }
  if (message.includes("user_daily_limit_reached")) {
    return { status: 429, message: "This account reached its daily beta limit. Try again tomorrow." };
  }
  if (message.includes("global_daily_limit_reached")) {
    return { status: 503, message: "The studio reached today’s safety limit. No credits were reserved." };
  }
  if (message.includes("too_many_active_generations")) {
    return { status: 409, message: "Finish the active runs before starting another one." };
  }
  if (message.includes("generation_not_found")) {
    return { status: 404, message: "Generation not found." };
  }
  if (message.includes("Paid generations are disabled")) {
    return { status: 503, message };
  }
  return { status: 500, message: "The machine could not complete that request." };
}
