import { Router } from "express";
import {
  loginSchema,
  login2faSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema as forgotSchema,
  resetPasswordSchema as resetSchema,
  enable2faSchema,
  disable2faSchema,
  updateProfileSchema,
  updatePreferencesSchema,
} from "@opero/shared";
import { prisma } from "../db/client.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";
import { BadRequest, Unauthorized } from "../lib/httpError.js";
import { authRateLimit } from "../lib/rateLimit.js";
import { sendEmail } from "../lib/email.js";
import { hashPassword, toAuthUser, verifyPassword, mergePreferences } from "./service.js";
import { storeUpload, deleteStored } from "../lib/attachUpload.js";
import { uploadSingle } from "../lib/upload.js";
import {
  consumePasswordReset,
  consumeRefreshToken,
  issuePasswordReset,
  issueRefreshToken,
  revokeRefreshToken,
  signAccessToken,
  signMfaToken,
  verifyMfaToken,
} from "./tokens.js";
import {
  buildOtpAuthUrl,
  generateTotpSecret,
  otpAuthQrDataUrl,
  verifyTotp,
} from "./totp.js";
import { requireAuth } from "./middleware.js";

export const authRouter = Router();

// Request schemas live in @opero/shared (imported above) so the client can
// reuse them for forms/typing.

// Helper: mint the access+refresh pair and the public user DTO.
async function issueSession(userId: string, role: string, orgId: string) {
  const accessToken = signAccessToken({ sub: userId, role, orgId });
  const refreshToken = await issueRefreshToken(userId);
  return { accessToken, refreshToken };
}

// --- POST /login ----------------------------------------------------------
authRouter.post(
  "/login",
  authRateLimit,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Generic failure — no user enumeration.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw Unauthorized("Invalid credentials");
    }
    if (user.totpEnabled) {
      res.json({ mfaRequired: true, mfaToken: signMfaToken(user.id) });
      return;
    }
    const tokens = await issueSession(user.id, user.role, user.orgId);
    res.json({ ...tokens, user: await toAuthUser(user) });
  }),
);

// --- POST /login/2fa ------------------------------------------------------
authRouter.post(
  "/login/2fa",
  authRateLimit,
  asyncHandler(async (req, res) => {
    const { mfaToken, code } = login2faSchema.parse(req.body);
    let userId: string;
    try {
      userId = verifyMfaToken(mfaToken);
    } catch {
      throw Unauthorized("Invalid or expired MFA token");
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      throw Unauthorized("2FA not available for this account");
    }
    if (!verifyTotp(code, user.totpSecret)) {
      throw Unauthorized("Invalid 2FA code");
    }
    const tokens = await issueSession(user.id, user.role, user.orgId);
    res.json({ ...tokens, user: await toAuthUser(user) });
  }),
);

// --- POST /refresh (rotation) ---------------------------------------------
authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const consumed = await consumeRefreshToken(refreshToken);
    if (!consumed) throw Unauthorized("Invalid refresh token");
    const user = await prisma.user.findUnique({ where: { id: consumed.userId } });
    if (!user) throw Unauthorized("User no longer exists");
    const tokens = await issueSession(user.id, user.role, user.orgId);
    res.json(tokens);
  }),
);

// --- POST /logout ---------------------------------------------------------
authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken } = logoutSchema.parse(req.body);
    await revokeRefreshToken(refreshToken);
    res.status(204).end();
  }),
);

// --- GET /me --------------------------------------------------------------
// Read fresh from the DB (the JWT payload can be stale after a profile edit).
authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw Unauthorized();
    res.json({ user: await toAuthUser(user) });
  }),
);

// --- PATCH /profile — the logged-in user edits their own name/email/phone ---
authRouter.patch(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = updateProfileSchema.parse(req.body);
    const userId = req.user!.id;

    const data: { name?: string; email?: string; phone?: string | null } = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw BadRequest("Name is required");
      data.name = name;
    }
    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      // Email is the unique login id — reject if another user already has it.
      const taken = await prisma.user.findFirst({
        where: { email, NOT: { id: userId } },
      });
      if (taken) throw BadRequest("Email already in use");
      data.email = email;
    }
    if (input.phone !== undefined) {
      data.phone = input.phone.trim() || null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: userId }, data });
      await audit(tx, req.user!, "user.profile.update", "user", u.id, input);
      return u;
    });
    res.json({ user: await toAuthUser(updated) });
  }),
);

// --- PATCH /preferences — own language + notification toggles --------------
authRouter.patch(
  "/preferences",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = updatePreferencesSchema.parse(req.body);
    const userId = req.user!.id;

    // Merge the partial onto the user's current (defaulted) prefs.
    const current = mergePreferences(req.user!.preferences);
    const next = {
      language: input.language ?? current.language,
      notifications: { ...current.notifications, ...(input.notifications ?? {}) },
    };

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { preferences: next },
      });
      await audit(tx, req.user!, "user.preferences.update", "user", u.id, input);
      return u;
    });
    res.json({ user: await toAuthUser(updated) });
  }),
);

// --- POST /avatar — upload the logged-in user's profile photo (multipart) ---
authRouter.post(
  "/avatar",
  requireAuth,
  uploadSingle,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const key = await storeUpload(user, req.file, "user-avatar", user.id);
    // Remove the previous avatar object (best-effort) so we don't leak storage.
    const previous = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatar: true },
    });
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: user.id }, data: { avatar: key } });
      await audit(tx, user, "user.avatar.update", "user", u.id);
      return u;
    });
    if (previous?.avatar && previous.avatar !== key) await deleteStored(previous.avatar);
    res.json({ user: await toAuthUser(updated) });
  }),
);

// --- DELETE /avatar — remove the logged-in user's profile photo -----------
authRouter.delete(
  "/avatar",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatar: true },
    });
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: user.id }, data: { avatar: null } });
      await audit(tx, user, "user.avatar.remove", "user", u.id);
      return u;
    });
    if (existing?.avatar) await deleteStored(existing.avatar);
    res.json({ user: await toAuthUser(updated) });
  }),
);

// --- POST /forgot-password (always 204, no enumeration) -------------------
authRouter.post(
  "/forgot-password",
  authRateLimit,
  asyncHandler(async (req, res) => {
    const { email } = forgotSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = await issuePasswordReset(user.id);
      await sendEmail({
        to: email,
        subject: "Opero — wachtwoord resetten",
        text: `Gebruik deze token om je wachtwoord te resetten: ${token}`,
      });
    }
    res.status(204).end();
  }),
);

// --- POST /reset-password -------------------------------------------------
authRouter.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const { token, newPassword } = resetSchema.parse(req.body);
    const consumed = await consumePasswordReset(token);
    if (!consumed) throw BadRequest("Invalid or expired reset token");
    await prisma.user.update({
      where: { id: consumed.userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    // Revoke all existing sessions after a password reset.
    await prisma.authSession.updateMany({
      where: { userId: consumed.userId, revoked: false },
      data: { revoked: true },
    });
    res.status(204).end();
  }),
);

// --- POST /2fa/setup ------------------------------------------------------
authRouter.post(
  "/2fa/setup",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const secret = generateTotpSecret();
    // Stash as pending until confirmed via /2fa/enable.
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingTotpSecret: secret },
    });
    const otpauthUrl = buildOtpAuthUrl({ secret, account: user.email });
    const qrDataUrl = await otpAuthQrDataUrl(otpauthUrl);
    res.json({ secret, otpauthUrl, qrDataUrl });
  }),
);

// --- POST /2fa/enable -----------------------------------------------------
authRouter.post(
  "/2fa/enable",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { code } = enable2faSchema.parse(req.body);
    const dbUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!dbUser?.pendingTotpSecret) {
      throw BadRequest("No pending 2FA setup; call /2fa/setup first");
    }
    if (!verifyTotp(code, dbUser.pendingTotpSecret)) {
      throw BadRequest("Invalid 2FA code");
    }
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        totpSecret: dbUser.pendingTotpSecret,
        pendingTotpSecret: null,
        totpEnabled: true,
      },
    });
    res.status(204).end();
  }),
);

// --- POST /2fa/disable ----------------------------------------------------
authRouter.post(
  "/2fa/disable",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { password } = disable2faSchema.parse(req.body);
    const dbUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!dbUser || !(await verifyPassword(password, dbUser.passwordHash))) {
      throw Unauthorized("Invalid password");
    }
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { totpEnabled: false, totpSecret: null, pendingTotpSecret: null },
    });
    res.status(204).end();
  }),
);
