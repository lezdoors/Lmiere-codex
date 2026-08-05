import {
  passwordResetEmail,
  secureLinkEmail,
  sendAuthDeliveryEmail,
  verificationCodeEmail,
} from "../_lib/email.js";
import {
  lmiereResetUrl,
  verifyNeonAuthWebhook,
} from "../_lib/neon-auth-webhook.js";
import { methodNotAllowed, sendJson } from "../_lib/http.js";

export const config = {
  api: { bodyParser: false },
};

async function rawBody(request) {
  if (typeof request.text === "function") return request.text();
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function deliveryContent(event) {
  const user = event?.user ?? {};
  const data = event?.event_data ?? {};
  if (!user.email) throw new Error("Auth email recipient is missing.");

  if (event.event_type === "send.otp") {
    if (data.delivery_preference === "sms") {
      const error = new Error("SMS auth delivery is not configured.");
      error.statusCode = 422;
      throw error;
    }
    if (!data.otp_code) throw new Error("Auth verification code is missing.");
    return {
      to: user.email,
      content: verificationCodeEmail({
        name: user.name,
        code: data.otp_code,
        expiresAt: data.expires_at,
        purpose: data.otp_type,
      }),
    };
  }

  if (event.event_type === "send.magic_link") {
    const actionUrl = data.link_type === "forget-password"
      ? lmiereResetUrl(data.token)
      : data.link_url;
    if (!actionUrl) throw new Error("Auth delivery link is missing.");
    return {
      to: user.email,
      content: data.link_type === "forget-password"
        ? passwordResetEmail({
            name: user.name,
            actionUrl,
            expiresAt: data.expires_at,
          })
        : secureLinkEmail({
            name: user.name,
            actionUrl,
            linkType: data.link_type,
            expiresAt: data.expires_at,
          }),
    };
  }

  const error = new Error("Unsupported Neon Auth email event.");
  error.statusCode = 422;
  throw error;
}

export default async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  if (!process.env.NEON_AUTH_JWKS_URL) {
    return sendJson(response, 503, { error: "Auth webhook verification is not configured." });
  }
  if (!process.env.RESEND_API_KEY || !process.env.LMIERE_EMAIL_FROM) {
    return sendJson(response, 503, { error: "Auth email delivery is not configured." });
  }

  let event;
  try {
    event = await verifyNeonAuthWebhook(
      await rawBody(request),
      request.headers,
    );
  } catch {
    return sendJson(response, 400, { error: "Invalid auth webhook." });
  }

  try {
    const delivery = deliveryContent(event);
    await sendAuthDeliveryEmail({
      eventId: event.event_id,
      eventType: event.event_type,
      ...delivery,
    });
    return sendJson(response, 200, { received: true });
  } catch (error) {
    if (error?.statusCode === 422) {
      return sendJson(response, 422, { error: "This auth delivery channel is not supported." });
    }
    return sendJson(response, 500, { error: "Auth email could not be delivered." });
  }
}
