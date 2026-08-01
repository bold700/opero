import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { UserRole } from "@opero/shared";
import { prisma } from "../../db/client.js";
import { audit } from "../../lib/audit.js";
import { sendEmail } from "../../lib/email.js";
import { inviteEmail } from "../../lib/email-templates.js";
import { hashPassword } from "../../auth/service.js";
import { issueInvite } from "../../auth/tokens.js";
import type { AuthUser } from "../../auth/types.js";

// Login provisioning for the invite flow (POST /users/invite and its resend).
//
// "Login" (User) stays a separate record from the domain person (Employee /
// Customer) — see shared/src/permissions.ts. This module owns the bit the
// invite routes need: create the User row, issue an invite token, send the mail.

// A password that can never match any input — invited users have no real
// password until they activate. bcrypt of a random value.
export async function unusablePassword(): Promise<string> {
  return hashPassword(randomBytes(32).toString("hex"));
}

// The recipient has no account yet and never asked for this mail, so it names
// the organisation and the person who invited them — without that it is
// indistinguishable from phishing. Both are read here rather than passed in, so
// no caller can send a nameless invite by forgetting an argument.
export async function sendInviteEmail(
  email: string,
  name: string,
  token: string,
  context: { orgId: string; invitedById: string | null },
) {
  const [org, invitedBy] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: context.orgId },
      select: { name: true },
    }),
    context.invitedById
      ? prisma.user.findUnique({
          where: { id: context.invitedById },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  await sendEmail(
    inviteEmail({
      to: email,
      name,
      token,
      organizationName: org?.name ?? "Opero",
      invitedByName: invitedBy?.name ?? "Een beheerder",
    }),
  );
}

// THE INVARIANT: every login belongs to a domain record. Access is managed from
// the Werknemers / Klanten screens, so a login with neither link would be
// invisible there — and therefore impossible to revoke through the UI. Modelling
// the link as a discriminated union makes such a login *unconstructible*: the
// compiler rejects it at every call site, which is why this needs no CHECK
// constraint in Postgres.
export type LinkTarget =
  | { kind: "employee"; employeeId: string }
  | { kind: "customer"; customerId: string };

// Create the User row for an already-resolved person. Runs inside the caller's
// transaction so an auto-invite cannot leave a login behind if the surrounding
// create rolls back.
export async function createInvitedUser(
  tx: Prisma.TransactionClient,
  admin: AuthUser,
  input: {
    email: string;
    name: string;
    role: UserRole;
    link: LinkTarget;
  },
) {
  const user = await tx.user.create({
    data: {
      orgId: admin.orgId,
      email: input.email,
      name: input.name,
      passwordHash: await unusablePassword(),
      role: input.role,
      status: "invited",
      invitedById: admin.id,
      employeeId: input.link.kind === "employee" ? input.link.employeeId : null,
      customerId: input.link.kind === "customer" ? input.link.customerId : null,
    },
  });
  await audit(tx, admin, "user.invite", "user", user.id, {
    email: input.email,
    role: input.role,
  });
  return user;
}

// Revoke every login belonging to a domain record, and kill its sessions.
//
// Called when an Employee / Customer is soft-deleted. Without this the person
// keeps working credentials while their record disappears from every list
// (filtered by `deletedAt: null`) — an account that is both invisible and still
// valid. Runs inside the caller's transaction so the record and its access are
// revoked atomically.
//
// NOTE (deliberate, one-directional): restoring a soft-deleted record must NOT
// re-enable the login. Un-deleting is usually mistake-correction, and silently
// handing credentials back to someone who left is the exact failure this
// closes. The admin has an explicit "Inschakelen" action for that.
export async function revokeLoginsFor(
  tx: Prisma.TransactionClient,
  link: LinkTarget,
): Promise<number> {
  const where =
    link.kind === "employee"
      ? { employeeId: link.employeeId }
      : { customerId: link.customerId };

  const { count } = await tx.user.updateMany({
    where: { ...where, status: { not: "disabled" as const } },
    data: { status: "disabled" },
  });
  // Sessions die with the account. The status check in requireAuth covers the
  // stateless access token; this closes the refresh path.
  await tx.authSession.updateMany({
    where: { user: where, revoked: false },
    data: { revoked: true },
  });
  return count;
}

// Issue the token + send the mail. Deliberately POST-transaction: sending is a
// side effect on the outside world and must not run inside a transaction that
// might still roll back.
export async function deliverInvite(
  userId: string,
  email: string,
  name: string,
  context: { orgId: string; invitedById: string | null },
) {
  const token = await issueInvite(userId);
  await sendInviteEmail(email, name, token, context);
}

// NOTE: there is deliberately no auto-invite here. Creating an Employee or
// Customer with an email address must never provision a login or send mail —
// an address on a record is a contact detail, not a request for access and not
// consent to be emailed. Access is granted only through POST /users/invite
// (the Invite action on the person), where the role is chosen explicitly and
// the caller's authority to grant it is checked.
