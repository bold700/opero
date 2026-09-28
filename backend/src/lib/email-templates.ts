import { env } from "../env.js";
import type { Email } from "./email.js";

// Transactional email bodies.
//
// LANGUAGE: these are the one place where Dutch is authored in the backend. The
// recipient is not logged in — there is no i18n runtime and no stored locale to
// read — so the copy ships with the template. Per the project rule, Dutch is
// display-only: every identifier, key and builder name here stays English, and
// the Dutch lives strictly inside the string values. Bodies are single-language
// (Dutch, the product's audience) rather than the previous NL+EN concatenation,
// which arrived looking like the same mail pasted twice.
//
// Every message is sent as HTML with a plain-text alternative. Clients that
// can't render HTML get the text part; both carry the same link, since a mail
// whose only call to action is a button is unusable the moment images or styles
// are stripped.

const BRAND = "Opero";

// Inline styles only: mail clients discard <style> blocks and every external
// stylesheet, so anything not inlined is simply not applied.
const COLORS = {
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  background: "#f3f4f6",
  surface: "#ffffff",
  primary: "#1d4ed8",
  primaryText: "#ffffff",
};

function appUrl(path: string, baseUrl?: string): string {
  return `${(baseUrl ?? env.APP_URL).replace(/\/$/, "")}${path}`;
}

// Escape anything interpolated into the HTML part. Names and email addresses
// come from user input, and a stray "<" would otherwise break the markup.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Layout = {
  heading: string;
  // Paragraphs above the button.
  intro: string[];
  buttonLabel: string;
  url: string;
  // Small print below the button — expiry, "ignore this" reassurance.
  footnotes: string[];
};

// One shared shell so every message looks like it came from the same product.
function renderHtml({ heading, intro, buttonLabel, url, footnotes }: Layout): string {
  const paragraphs = intro
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text};">${line}</p>`,
    )
    .join("");

  const notes = footnotes
    .map(
      (line) =>
        `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${COLORS.muted};">${line}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="nl">
<body style="margin:0;padding:24px 12px;background:${COLORS.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:12px;">
    <tr>
      <td style="padding:32px 32px 8px;">
        <div style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${COLORS.text};">${BRAND}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 32px 0;">
        <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;font-weight:700;color:${COLORS.text};">${heading}</h1>
        ${paragraphs}
      </td>
    </tr>
    <tr>
      <td style="padding:8px 32px 24px;">
        <a href="${url}" style="display:inline-block;padding:12px 20px;background:${COLORS.primary};color:${COLORS.primaryText};font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${buttonLabel}</a>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 24px;">
        <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${COLORS.muted};">Werkt de knop niet? Kopieer deze link naar je browser:</p>
        <p style="margin:0 0 16px;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${url}" style="color:${COLORS.primary};">${url}</a></p>
        ${notes}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderText({ heading, intro, url, footnotes }: Layout): string {
  // Strip the few inline tags the HTML paragraphs may carry (<strong>) so the
  // text part never shows markup.
  const plain = (line: string) => line.replace(/<[^>]+>/g, "");
  return [
    heading,
    "",
    ...intro.map(plain),
    "",
    url,
    "",
    ...footnotes.map(plain),
    "",
    BRAND,
  ].join("\n");
}

// Invite: the recipient has no account yet and did not ask for this mail, so it
// has to say who they are to us and who sent it, or it reads as phishing.
export function inviteEmail(params: {
  to: string;
  name: string;
  token: string;
  organizationName: string;
  invitedByName: string;
  baseUrl?: string;
}): Email {
  const layout: Layout = {
    heading: `Je bent uitgenodigd voor ${BRAND}`,
    intro: [
      `Hallo ${escapeHtml(params.name)},`,
      `<strong>${escapeHtml(params.invitedByName)}</strong> heeft een account voor je aangemaakt bij <strong>${escapeHtml(params.organizationName)}</strong>.`,
      "Kies hieronder een wachtwoord om je account te activeren.",
    ],
    buttonLabel: "Account activeren",
    url: appUrl(`/accept-invite?token=${params.token}`, params.baseUrl),
    footnotes: [
      "Deze uitnodiging verloopt over 7 dagen.",
      "Verwacht je deze uitnodiging niet? Dan kun je deze e-mail negeren; zonder activatie gebeurt er niets.",
    ],
  };
  return {
    to: params.to,
    subject: `Je bent uitgenodigd voor ${BRAND}`,
    text: renderText(layout),
    html: renderHtml(layout),
  };
}

// Reset: user-initiated, so it stays short and leads with the expiry.
export function passwordResetEmail(params: {
  to: string;
  token: string;
  baseUrl?: string;
}): Email {
  const layout: Layout = {
    heading: "Wachtwoord opnieuw instellen",
    intro: [
      `Je hebt gevraagd om je ${BRAND}-wachtwoord opnieuw in te stellen. Kies hieronder een nieuw wachtwoord.`,
    ],
    buttonLabel: "Nieuw wachtwoord instellen",
    url: appUrl(`/reset-password?token=${params.token}`, params.baseUrl),
    footnotes: [
      "Deze link verloopt over 1 uur en kan één keer worden gebruikt.",
      "Heb je dit niet aangevraagd? Negeer deze e-mail — je wachtwoord blijft ongewijzigd.",
    ],
  };
  return {
    to: params.to,
    subject: `${BRAND} — wachtwoord opnieuw instellen`,
    text: renderText(layout),
    html: renderHtml(layout),
  };
}

// Email change confirmation, sent to the NEW address.
export function verifyEmailChangeEmail(params: {
  to: string;
  token: string;
  baseUrl?: string;
}): Email {
  const layout: Layout = {
    heading: "Bevestig je nieuwe e-mailadres",
    intro: [
      `Je hebt dit adres ingesteld als nieuw e-mailadres voor je ${BRAND}-account. Bevestig hieronder om de wijziging door te voeren.`,
      "Tot je bevestigt blijf je inloggen met je huidige adres.",
    ],
    buttonLabel: "E-mailadres bevestigen",
    url: appUrl(`/verify-email?token=${params.token}`, params.baseUrl),
    footnotes: [
      "Deze link verloopt over 1 uur.",
      "Heb je dit niet aangevraagd? Negeer deze e-mail — er verandert dan niets aan je account.",
    ],
  };
  return {
    to: params.to,
    subject: `${BRAND} — bevestig je nieuwe e-mailadres`,
    text: renderText(layout),
    html: renderHtml(layout),
  };
}
