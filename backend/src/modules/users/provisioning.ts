import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
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
// Customer) — see docs/roles-and-permissions.md. This module owns the bit both
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

// Create the User row for an already-resolved person. Runs inside the caller's
// transaction so an auto-invite cannot leave a login behind if the surrounding
// create rolls back.
export async function createInvitedUser(
  tx: Prisma.TransactionClient,
  admin: AuthUser,
  input: {
    email: string;
    name: string;
    role: "admin" | "technician" | "client";
    employeeId?: string | null;
    customerId?: string | null;
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
      employeeId: input.employeeId ?? null,
      customerId: input.customerId ?? null,
    },
  });
  await audit(tx, admin, "user.invite", "user", user.id, {
    email: input.email,
    role: input.role,
  });
  return user;
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
  role: "admin" | "technician" = "technician",
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
        employeeId: employee.id,
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
