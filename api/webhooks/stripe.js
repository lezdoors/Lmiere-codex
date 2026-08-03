import { buffer } from "micro";
import { creditStripeCheckout } from "../_lib/db.js";
import { sendJson } from "../_lib/http.js";
import { stripe, stripeWebhookSecret, verifiedCheckoutCredit } from "../_lib/stripe.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  const signature = request.headers["stripe-signature"];
  if (typeof signature !== "string") {
    return sendJson(response, 400, { error: "Missing Stripe signature." });
  }

  let stripeClient;
  let webhookSecret;
  try {
    stripeClient = stripe();
    webhookSecret = stripeWebhookSecret();
  } catch {
    return sendJson(response, 503, { error: "Stripe webhook is not configured." });
  }

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(
      await buffer(request, { limit: "1mb" }),
      signature,
      webhookSecret,
    );
  } catch {
    return sendJson(response, 400, { error: "Invalid Stripe signature." });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      if (event.data.object.payment_status !== "paid") {
        return sendJson(response, 200, { received: true, waitingForPayment: true });
      }
      const checkout = verifiedCheckoutCredit(event.data.object);
      const result = await creditStripeCheckout({
        eventId: event.id,
        eventType: event.type,
        ...checkout,
      });
      return sendJson(response, 200, { received: true, applied: result.applied === true });
    }

    return sendJson(response, 200, { received: true, ignored: true });
  } catch {
    return sendJson(response, 500, { error: "Stripe payment could not be reconciled." });
  }
}
