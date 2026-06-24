import { authenticator } from "otplib";
import QRCode from "qrcode";

// TOTP (Google Authenticator-compatible) via otplib. Default 30s step, 6 digits.
authenticator.options = { window: 1 }; // allow ±1 step for clock drift

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: token.trim(), secret });
  } catch {
    return false;
  }
}

export function buildOtpAuthUrl(opts: {
  secret: string;
  account: string;
  issuer?: string;
}): string {
  return authenticator.keyuri(
    opts.account,
    opts.issuer ?? "Opero",
    opts.secret,
  );
}

export async function otpAuthQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}
