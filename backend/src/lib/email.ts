import { env } from "../env.js";

// Email abstraction. In dev/test we log to console so the reset/2FA flows are
// testable without an SMTP provider.
//
// TODO(prod): wire a real provider (e.g. Postmark/SES/Resend) behind this same
// interface. Auth flows depend only on sendEmail(); nothing else changes.
export type Email = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail(email: Email): Promise<void> {
  if (env.NODE_ENV === "production") {
    // Intentionally a hard signal until a provider is configured.
    throw new Error(
      "sendEmail: no email provider configured for production. Wire one in lib/email.ts.",
    );
  }
  // dev/test: log the message so links/codes are visible.
  // eslint-disable-next-line no-console
  console.log(
    `\n[email] to=${email.to}\n[email] subject=${email.subject}\n[email] ${email.text}\n`,
  );
}
