import { getResendClient } from "../_lib/email.js";
import { recordEmailDeliveryEvent } from "../_lib/db.js";
import { methodNotAllowed, sendJson } from "../_lib/http.js";

export const config = {
  api: { bodyParser: false },
};

function header(request, name) {
  return request.headers?.get?.(name)
    ?? request.headers?.[name]
    ?? request.headers?.[name.toLowerCase()];
}

async function rawBody(request) {
  if (typeof request.text === "function") return request.text();
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  if (!process.env.RESEND_WEBHOOK_SECRET || !process.env.RESEND_API_KEY) {
    return sendJson(response, 503, { error: "Email delivery tracking is not configured." });
  }

  try {
    const eventId = header(request, "svix-id");
    const timestamp = header(request, "svix-timestamp");
    const signature = header(request, "svix-signature");
    if (!eventId || !timestamp || !signature) {
      return sendJson(response, 400, { error: "Webhook signature is missing." });
    }

    const event = getResendClient().webhooks.verify({
      payload: await rawBody(request),
      headers: { id: eventId, timestamp, signature },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
    });

    await recordEmailDeliveryEvent({
      eventId,
      providerId: event?.data?.email_id ?? null,
      eventType: event?.type ?? "unknown",
      occurredAt: event?.created_at ?? new Date().toISOString(),
    });
    return sendJson(response, 200, { received: true });
  } catch {
    return sendJson(response, 400, { error: "Invalid webhook." });
  }
}
