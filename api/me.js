import { requireVerifiedUser } from "./_lib/auth.js";
import { getAccount } from "./_lib/db.js";
import { sendVerifiedAccountEmails } from "./_lib/email.js";
import { methodNotAllowed, sendJson } from "./_lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);

  try {
    const user = await requireVerifiedUser(request);
    const account = await getAccount(user.id);
    const language = request.headers["x-lmiere-language"] === "fr" ? "fr" : "en";
    await sendVerifiedAccountEmails(user, { gift: account.gift, language }).catch(() => null);
    return sendJson(response, 200, account);
  } catch (error) {
    return sendJson(response, error.statusCode ?? 500, {
      error: error.statusCode && error.statusCode < 500 ? error.message : "The wallet could not be loaded.",
    });
  }
}
