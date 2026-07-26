import { Router } from "express";
import {
  canActOnAccount,
  canGrantRole,
  inviteUserSchema,
  type UserRole,
} from "@opero/shared";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, Conflict, Forbidden, NotFound } from "../../lib/httpError.js";
import { audit } from "../../lib/audit.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import { issueInvite } from "../../auth/tokens.js";
import {
  createInvitedUser,
  deliverInvite,
  sendInviteEmail,
  type LinkTarget,
} from "./provisioning.js";

// User provisioning — the office creates login accounts and invites people to
// activate them. Org-scoped. "Login" (User) is separate from the domain record
// (Employee/Customer) but ALWAYS links to one, so every account is reachable
// from Werknemers / Klanten — the only screens that manage access.
//
// Admin AND office, gated per-target rather than at the door: the rule is that
// you can never act on an account at or above your own level, so office invites
// and revokes technicians and clients but never an admin or another office
// user. That mirrors the guard on deleting an employee who holds a login
// (employees/routes.ts) — an account action is the other way to revoke access,
// so it must not be a way around that rule. See canActOnAccount in @opero/shared.
//
// There is no list endpoint: these four act on one account at a time, and the
// lists come from /employees and /customers, which embed each record's account.
export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole("admin", "office"));

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  employeeId: string | null;
  customerId: string | null;
  createdAt: Date;
  activatedAt: Date | null;
};

function userDto(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    employeeId: u.employeeId ?? undefined,
    customerId: u.customerId ?? undefined,
    createdAt: u.createdAt.toISOString(),
    activatedAt: u.activatedAt ? u.activatedAt.toISOString() : undefined,
  };
}

// Load the target account and apply the level rule. Every route that acts on an
// existing account goes through here, so the guard can't be forgotten on one of
// them. 404 for a wrong/foreign id, 403 for a real account the actor outranks —
// deliberately distinct, since the id came from a list the actor can already see.
async function loadActionableUser(
  actor: { id: string; orgId: string; role: UserRole },
  id: string,
) {
  const user = await prisma.user.findFirst({ where: { id, orgId: actor.orgId } });
  if (!user) throw NotFound("User not found");
  if (!canActOnAccount(actor.role, user.role as UserRole)) {
    throw Forbidden("You can't manage an account at or above your own level");
  }
  return user;
}

// POST /users/invite — provision a login for an EXISTING person (Employee or
// Customer) and send the activation email. The email + name come from that
// record; a login is never created for a free-typed address.
usersRouter.post(
  "/invite",
  asyncHandler(async (req, res) => {
    const admin = req.user!;
    const input = inviteUserSchema.parse(req.body);

    // Authorization FIRST, before any lookup or data-shape validation. The role
    // being granted is known from the request alone, and checking it here means
    // an office user asking for an admin login gets a flat 403 — never a 404 or
    // a "this employee has no email" that would confirm the record exists and
    // hint the request was otherwise acceptable.
    //
    // A customer login is always `client`, which is below everyone who can
    // reach this route, so only the employee branch can fail this.
    const requestedRole: UserRole = input.kind === "employee" ? input.role : "client";
    if (!canGrantRole(admin.role as UserRole, requestedRole)) {
      throw Forbidden("You can't create an account at or above your own level");
    }

    // Resolve the linked person → derive email, name, role. Guard: the record
    // must exist (org-scoped), have an email, and not already have a login.
    let email: string;
    let name: string;
    let role: UserRole;
    let link: LinkTarget;

    if (input.kind === "employee") {
      const emp = await prisma.employee.findFirst({
        where: { id: input.employeeId, orgId: admin.orgId, deletedAt: null },
        include: { users: { select: { id: true } } },
      });
      if (!emp) throw NotFound("Employee not found");
      if (!emp.email) throw BadRequest("This employee has no email address; add one first.");
      if (emp.users.length > 0) throw Conflict("This employee already has a login");
      email = emp.email.trim().toLowerCase();
      name = emp.name;
      role = input.role;
      link = { kind: "employee", employeeId: emp.id };
    } else {
      const cust = await prisma.customer.findFirst({
        where: { id: input.customerId, orgId: admin.orgId, deletedAt: null },
        include: { users: { select: { id: true } } },
      });
      if (!cust) throw NotFound("Customer not found");
      if (!cust.email) throw BadRequest("This customer has no email address; add one first.");
      if (cust.users.length > 0) throw Conflict("This customer already has a login");
      email = cust.email.trim().toLowerCase();
      // Prefer the contact person for the login name; fall back to company name.
      name = cust.contactName || cust.name;
      role = "client";
      link = { kind: "customer", customerId: cust.id };
    }

    // Email is the unique login id — reject if it already exists (any org).
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw Conflict("A user with this email already exists");

    const created = await prisma.$transaction((tx) =>
      createInvitedUser(tx, admin, { email, name, role, link }),
    );

    await deliverInvite(created.id, email, created.name);

    res.status(201).json(userDto(created));
  }),
);

// POST /users/:id/resend-invite — reissue a token + email (invited users only).
usersRouter.post(
  "/:id/resend-invite",
  asyncHandler(async (req, res) => {
    const admin = req.user!;
    const user = await loadActionableUser(admin, req.params.id);
    if (user.status !== "invited") throw BadRequest("This user is already active");
    const token = await issueInvite(user.id);
    await sendInviteEmail(user.email, user.name, token);
    await audit(prisma, admin, "user.invite.resend", "user", user.id);
    res.status(204).end();
  }),
);

// POST /users/:id/disable — revoke access (kept for history). Guards the last admin.
usersRouter.post(
  "/:id/disable",
  asyncHandler(async (req, res) => {
    const admin = req.user!;
    const user = await loadActionableUser(admin, req.params.id);
    // An admin can't disable their own account — that would instantly revoke
    // their own session. Removing your own access isn't a self-service action.
    // (This also prevents the last admin locking the org out: an admin can only
    // disable OTHER users, so at least one active admin — the actor — remains.)
    if (user.id === admin.id) throw BadRequest("You can't disable your own account");
    if (user.status === "disabled") {
      res.json(userDto(user));
      return;
    }
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: user.id }, data: { status: "disabled" } });
      // Kill their sessions immediately.
      await tx.authSession.updateMany({ where: { userId: user.id, revoked: false }, data: { revoked: true } });
      await audit(tx, admin, "user.disable", "user", user.id);
      return u;
    });
    res.json(userDto(updated));
  }),
);

// POST /users/:id/enable — restore a disabled user (back to active).
usersRouter.post(
  "/:id/enable",
  asyncHandler(async (req, res) => {
    const admin = req.user!;
    const user = await loadActionableUser(admin, req.params.id);
    if (user.status !== "disabled") {
      res.json(userDto(user));
      return;
    }
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: user.id }, data: { status: "active" } });
      await audit(tx, admin, "user.enable", "user", user.id);
      return u;
    });
    res.json(userDto(updated));
  }),
);
