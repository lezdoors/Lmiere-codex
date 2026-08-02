import { requireUser } from "./_lib/auth.js";
import { getAccount } from "./_lib/db.js";
import { methodNotAllowed, sendJson } from "./_lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);

  try {
    const user = await requireUser(request);
    return sendJson(response, 200, await getAccount(user.id));
  } catch (error) {
    return sendJson(response, error.statusCode ?? 500, {
      error: error.statusCode === 401 ? error.message : "The wallet could not be loaded.",
    });
  }
}
