import { Resend } from "resend";
import { env } from "../env.js";

// Email abstraction. Everything that sends mail goes through sendEmail(), so the
// provider is swappable in one place.
//
// Behaviour:
//   - Resend configured (RESEND_API_KEY + EMAIL_FROM) → send for real, any env.
//   - Not configured, dev/test → log to console (links/codes visible locally).
//   - Not configured, production → throw (fail loud: a misconfigured deploy must
//     not silently drop password-reset emails).
export type Email = {
  to: string;
  subject: string;
  text: string;
};

const resendConfigured = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

// One shared client, only constructed when configured.
const resend = resendConfigured ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail(email: Email): Promise<void> {
  if (resend) {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      text: email.text,
    });
    if (error) {
      // Surface the failure to logs + caller. Callers that must not leak account
      // existence (e.g. forgot-password) already return 204 regardless.
      // eslint-disable-next-line no-console
      console.error("[email] Resend send failed:", error);
      throw new Error(`Email send failed: ${error.message ?? "unknown error"}`);
    }
    return;
  }

  if (env.NODE_ENV === "production") {
    // Intentionally a hard signal until a provider is configured.
    throw new Error(
      "sendEmail: no email provider configured for production. Set RESEND_API_KEY + EMAIL_FROM.",
    );
  }

  // dev/test: log the message so links/codes are visible.
  // eslint-disable-next-line no-console
  console.log(
    `\n[email] to=${email.to}\n[email] subject=${email.subject}\n[email] ${email.text}\n`,
  );
}
