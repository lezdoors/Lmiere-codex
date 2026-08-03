import { requireVerifiedUser } from "./_lib/auth.js";
import { recordStripeCheckout } from "./_lib/db.js";
import { methodNotAllowed, readJsonBody, sendJson } from "./_lib/http.js";
import { createCreditCheckout, creditPack } from "./_lib/stripe.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);

  try {
    const user = await requireVerifiedUser(request);
    const body = readJsonBody(request);
    const pack = creditPack(body.packId);
    if (!pack) return sendJson(response, 400, { error: "Choose a valid credit pack." });

    const language = request.headers["x-lmiere-language"] === "fr" ? "fr" : "en";
    const session = await createCreditCheckout({ user, pack, language });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    await recordStripeCheckout({
      checkoutSessionId: session.id,
      userId: user.id,
      packId: pack.id,
      amountCents: pack.amountCents,
      currency: "usd",
    });

    return sendJson(response, 201, { url: session.url });
  } catch (error) {
    return sendJson(response, error.statusCode ?? 500, {
      error: error.statusCode && error.statusCode < 500
        ? error.message
        : "Secure checkout could not be opened.",
    });
  }
}
