import { requireAdminUser } from "../_lib/auth.js";
import {
  getDatabaseReadiness,
  globalDailyLimitCents,
  maxActiveGenerations,
  userDailyLimitCents,
} from "../_lib/db.js";
import { methodNotAllowed, sendJson } from "../_lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);

  try {
    await requireAdminUser(request);
    const database = await getDatabaseReadiness();
    const services = {
      falKeyConfigured: Boolean(process.env.FAL_KEY),
      paidGenerationsEnabled: process.env.LMIERE_ENABLE_PAID_GENERATIONS === "true",
      durableMediaConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      transactionalEmailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.LMIERE_EMAIL_FROM),
      emailWebhookConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
      privateBetaAllowlistConfigured: Boolean(process.env.LMIERE_ALLOWED_EMAILS?.trim()),
      billingConfigured: Boolean(process.env.STRIPE_RESTRICTED_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    };
    const safeguards = {
      userDailyLimitCents: userDailyLimitCents(),
      globalDailyLimitCents: globalDailyLimitCents(),
      maxActiveGenerations: maxActiveGenerations(),
    };
    const readyToEnablePaidBeta = Boolean(
      database.auth.requireEmailVerification
      && database.schema?.guarded_reservations
      && database.schema?.account_grants
      && database.schema?.grant_acknowledgement
      && services.falKeyConfigured
      && services.durableMediaConfigured
      && services.transactionalEmailConfigured
      && services.emailWebhookConfigured
      && services.privateBetaAllowlistConfigured
      && safeguards.userDailyLimitCents > 0
      && safeguards.globalDailyLimitCents > 0
      && safeguards.maxActiveGenerations > 0
    );

    return sendJson(response, 200, {
      readyToEnablePaidBeta,
      database,
      services,
      safeguards,
    });
  } catch (error) {
    return sendJson(response, error.statusCode ?? 500, {
      error: error.statusCode && error.statusCode < 500 ? error.message : "Readiness could not be checked.",
    });
  }
}
