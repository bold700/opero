import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { UserRole } from "@opero/shared";
import { env } from "../../env.js";
import { prisma } from "../../db/client.js";
import { audit } from "../../lib/audit.js";
import { sendEmail } from "../../lib/email.js";
import { hashPassword } from "../../auth/service.js";
import { issueInvite } from "../../auth/tokens.js";
import type { AuthUser } from "../../auth/types.js";

// Login provisioning, shared by the explicit admin flow (POST /users/invite)
// and the automatic one (creating an Employee with an email address).
//
// "Login" (User) stays a separate record from the domain person (Employee /
// Customer) — see shared/src/permissions.ts. This module owns the bit both
// callers need: create the User row, issue an invite token, send the email.

// A password that can never match any input — invited users have no real
// password until they activate. bcrypt of a random value.
export async function unusablePassword(): Promise<string> {
  return hashPassword(randomBytes(32).toString("hex"));
}

export async function sendInviteEmail(email: string, name: string, token: string) {
  const url = `${env.APP_URL.replace(/\/$/, "")}/reset-password?token=${token}&invite=1`;
  await sendEmail({
    to: email,
    subject: "Opero — je bent uitgenodigd / you've been invited",
    text:
      `Hallo ${name},\n\nJe hebt toegang gekregen tot Opero. Stel je wachtwoord in via deze link (verloopt over 7 dagen):\n${url}\n\n` +
      `Hi ${name},\n\nYou've been given access to Opero. Set your password using this link (expires in 7 days):\n${url}`,
  });
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
export async function deliverInvite(userId: string, email: string, name: string) {
  const token = await issueInvite(userId);
  await sendInviteEmail(email, name, token);
}

// Auto-provision a login for a newly created Employee.
//
// WHY THIS IS BEST-EFFORT: the client asked that "when an employee is created,
// an account should automatically be created for them". But employee creation
// must not fail because e.g. the address is already used by another login, or
// the mail provider is down — the employee record is the primary thing being
// created, and an admin can always invite manually afterwards from the
// Employees list. So every failure path here returns a reason instead of
// throwing, and the caller reports it back in the response.
export type AutoInviteResult =
  | { invited: true; userId: string }
  | { invited: false; reason: "no_email" | "email_taken" | "send_failed" };

export async function autoInviteEmployee(
  admin: AuthUser,
  employee: { id: string; name: string; email: string | null },
  // Auto-provisioning on employee create always makes a technician; office and
  // admin logins are granted deliberately, never by creating a record.
  role: UserRole = "technician",
): Promise<AutoInviteResult> {
  const email = employee.email?.trim().toLowerCase();
  if (!email) return { invited: false, reason: "no_email" };

  // Email is the unique login id across ALL orgs — never silently attach a new
  // employee to someone else's existing account.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { invited: false, reason: "email_taken" };

  try {
    const user = await prisma.$transaction((tx) =>
      createInvitedUser(tx, admin, {
        email,
        name: employee.name,
        role,
        link: { kind: "employee", employeeId: employee.id },
      }),
    );
    await deliverInvite(user.id, email, user.name);
    return { invited: true, userId: user.id };
  } catch {
    // Losing a race on the unique email, or a mail-send failure. The employee
    // still exists; the admin can retry via the Invite action.
    return { invited: false, reason: "send_failed" };
  }
}
