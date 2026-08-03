import { Resend } from "resend";
import {
  claimEmailEvent,
  markEmailEventFailed,
  markEmailEventSent,
} from "./db.js";

let resendClient;

export function isTransactionalEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.LMIERE_EMAIL_FROM);
}

export function getResendClient() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured.");
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstName(name = "") {
  return name.trim().split(/\s+/)[0] || "there";
}

function emailShell({ eyebrow, heading, copy, actionLabel, actionUrl, footer }) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f2efe5;color:#111826;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(copy)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2efe5;padding:32px 14px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border:1px solid #111826;background:#fffdf6;">
          <tr>
            <td style="padding:18px 24px;border-bottom:1px solid #111826;font-family:Courier New,monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">
              Lmiere <span style="float:right;color:#3446ff;">Signal / verified</span>
            </td>
          </tr>
          <tr>
            <td style="padding:44px 34px 36px;">
              <p style="margin:0 0 22px;color:#3446ff;font-family:Courier New,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;">${escapeHtml(eyebrow)}</p>
              <h1 style="margin:0 0 22px;font-family:Georgia,Times New Roman,serif;font-size:42px;font-weight:400;line-height:1.04;">${escapeHtml(heading)}</h1>
              <p style="margin:0 0 30px;color:#4a5260;font-size:16px;line-height:1.7;">${escapeHtml(copy)}</p>
              <a href="${escapeHtml(actionUrl)}" style="display:inline-block;border:1px solid #111826;padding:15px 21px;color:#fff;text-decoration:none;background:#111826;font-family:Courier New,monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(actionLabel)} →</a>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px;border-top:1px solid #111826;color:#6a7079;font-family:Courier New,monospace;font-size:10px;line-height:1.6;">
              ${escapeHtml(footer)}<br />Lmiere · Pay only when you generate
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function formatCredit(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function welcomeEmail({ name, gift = null }) {
  const greeting = firstName(name);
  const giftLine = gift
    ? `${gift.fromName} left ${formatCredit(gift.creditCents)} in your private wallet. ${gift.message}`
    : null;
  return {
    subject: gift ? `${gift.fromName} left you a Lmiere founder gift` : "Your Lmiere account is verified",
    text: `Welcome to Lmiere, ${greeting}. ${giftLine || "Your private wallet and generation archive are ready."} Open the studio: https://lmiere.com/studio\n\nQuestions? Reply to this email.`,
    html: emailShell({
      eyebrow: gift ? "Founder transmission" : "Account confirmed",
      heading: gift ? `A signal for you, ${greeting}.` : `Welcome to the field, ${greeting}.`,
      copy: giftLine || "Your private wallet and generation archive are ready. Every run, result, and credit movement now stays attached to this verified account.",
      actionLabel: "Open the studio",
      actionUrl: "https://lmiere.com/studio",
      footer: "Questions or something unexpected? Reply to this email and a human will read it.",
    }),
  };
}

export function founderSignupEmail({ name, email }) {
  return {
    subject: `New verified Lmiere account: ${email}`,
    text: `${name || "A new member"} verified ${email} and opened a private Lmiere account. Review beta readiness: https://lmiere.com/account`,
    html: emailShell({
      eyebrow: "Private beta signal",
      heading: "A new account is verified.",
      copy: `${name || "A new member"} confirmed ${email} and can now open an isolated wallet.`,
      actionLabel: "Open Lmiere",
      actionUrl: "https://lmiere.com/account",
      footer: "Internal founder notification. Do not forward outside the Lmiere team.",
    }),
  };
}

function founderRecipients() {
  return (process.env.LMIERE_FOUNDER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function sendClaimedEmail({ userId, kind, to, content }) {
  const recipients = Array.isArray(to) ? to : [to];
  const claim = await claimEmailEvent({
    userId,
    kind,
    recipient: recipients.join(","),
  });
  if (!claim) return { sent: false, reason: "already_processed" };

  try {
    const { data, error } = await getResendClient().emails.send({
      from: process.env.LMIERE_EMAIL_FROM,
      to: recipients,
      replyTo: process.env.LMIERE_EMAIL_REPLY_TO || "support@lmiere.com",
      subject: content.subject,
      text: content.text,
      html: content.html,
      tags: [
        { name: "category", value: kind },
        { name: "user_id", value: userId },
      ],
    }, {
      idempotencyKey: `lmiere-${kind}/${userId}`,
    });

    if (error || !data?.id) throw new Error(error?.message || "Resend returned no email identifier.");
    await markEmailEventSent(claim.id, data.id);
    return { sent: true, providerId: data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transactional email failed.";
    await markEmailEventFailed(claim.id, message);
    return { sent: false, reason: "provider_error" };
  }
}

export async function sendVerifiedAccountEmails(user, { gift = null } = {}) {
  if (!isTransactionalEmailConfigured()) return { configured: false };

  const results = [];
  results.push(await sendClaimedEmail({
    userId: user.id,
    kind: "welcome",
    to: user.email,
    content: welcomeEmail({ ...user, gift }),
  }));

  const founders = founderRecipients();
  if (founders.length > 0) {
    results.push(await sendClaimedEmail({
      userId: user.id,
      kind: "founder_signup",
      to: founders,
      content: founderSignupEmail(user),
    }));
  }
  return { configured: true, results };
}
