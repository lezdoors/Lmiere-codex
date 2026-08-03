import { requireVerifiedUser } from "./_lib/auth.js";
import { acknowledgeAccountGrant } from "./_lib/db.js";
import { methodNotAllowed, sendJson } from "./_lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);

  try {
    const user = await requireVerifiedUser(request);
    const acknowledged = await acknowledgeAccountGrant(user.id);
    return sendJson(response, 200, { acknowledged });
  } catch (error) {
    return sendJson(response, error.statusCode ?? 500, {
      error: error.statusCode && error.statusCode < 500
        ? error.message
        : "The founder message could not be closed.",
    });
  }
}
