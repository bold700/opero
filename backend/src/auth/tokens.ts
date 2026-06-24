import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../env.js";
import { prisma } from "../db/client.js";

// --- Access token (JWT) ---------------------------------------------------

export type AccessTokenPayload = {
  sub: string; // userId
  role: string;
  orgId: string;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }
  return decoded as AccessTokenPayload;
}

// Short-lived MFA token: proves password step passed, gates the 2FA step.
type MfaTokenPayload = { sub: string; mfa: true };

export function signMfaToken(userId: string): string {
  return jwt.sign({ sub: userId, mfa: true } satisfies MfaTokenPayload, env.JWT_SECRET, {
    expiresIn: "5m",
  });
}

export function verifyMfaToken(token: string): string {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === "string" || (decoded as MfaTokenPayload).mfa !== true) {
    throw new Error("Invalid MFA token");
  }
  return (decoded as MfaTokenPayload).sub;
}

// --- Refresh tokens (opaque, hashed at rest, single-use rotation) ---------

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Mint a new refresh token, persist its hash, return the raw value (shown once).
export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = randomToken();
  const expiresAt = new Date(
    Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  await prisma.authSession.create({
    data: { userId, tokenHash: hashToken(raw), expiresAt },
  });
  return raw;
}

// Validate a refresh token; return the userId if valid & not revoked/expired.
export async function consumeRefreshToken(
  raw: string,
): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(raw);
  const session = await prisma.authSession.findUnique({ where: { tokenHash } });
  if (!session || session.revoked || session.expiresAt < new Date()) {
    return null;
  }
  // Single-use: revoke on consume (caller issues a fresh one — rotation).
  await prisma.authSession.update({
    where: { id: session.id },
    data: { revoked: true },
  });
  return { userId: session.userId };
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  const tokenHash = hashToken(raw);
  await prisma.authSession.updateMany({
    where: { tokenHash },
    data: { revoked: true },
  });
}

// --- Password reset tokens (opaque, hashed) -------------------------------

export async function issuePasswordReset(userId: string): Promise<string> {
  const raw = randomToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
  await prisma.passwordReset.create({
    data: { userId, tokenHash: hashToken(raw), expiresAt },
  });
  return raw;
}

export async function consumePasswordReset(
  raw: string,
): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(raw);
  const row = await prisma.passwordReset.findUnique({ where: { tokenHash } });
  if (!row || row.used || row.expiresAt < new Date()) return null;
  await prisma.passwordReset.update({
    where: { id: row.id },
    data: { used: true },
  });
  return { userId: row.userId };
}
