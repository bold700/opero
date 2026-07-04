import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { inviteUserSchema } from "@opero/shared";
import { parsePageParams, paginate } from "../../lib/pagination.js";
import { env } from "../../env.js";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, Conflict, NotFound } from "../../lib/httpError.js";
import { audit } from "../../lib/audit.js";
import { sendEmail } from "../../lib/email.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import { hashPassword } from "../../auth/service.js";
import { issueInvite } from "../../auth/tokens.js";

// User provisioning — admins create login accounts and invite people to activate
// them. All admin-only, org-scoped. "Login" (User) is separate from the domain
// records (Employee/Customer) but links to them via role-specific ids.
export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole("admin"));

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

// A password that can never match any input — invited users have no real
// password until they activate. bcrypt of a random value.
async function unusablePassword(): Promise<string> {
  return hashPassword(randomBytes(32).toString("hex"));
}

async function sendInviteEmail(email: string, name: string, token: string) {
  const url = `${env.APP_URL.replace(/\/$/, "")}/reset-password?token=${token}&invite=1`;
  await sendEmail({
    to: email,
    subject: "Opero — je bent uitgenodigd / you've been invited",
    text:
      `Hallo ${name},\n\nJe hebt toegang gekregen tot Opero. Stel je wachtwoord in via deze link (verloopt over 7 dagen):\n${url}\n\n` +
      `Hi ${name},\n\nYou've been given access to Opero. Set your password using this link (expires in 7 days):\n${url}`,
  });
}

const ACCOUNT_STATUSES = ["invited", "active", "disabled"] as const;

// GET /users?cursor=&limit=&search=&filter= — cursor-paginated, server-searched
// (name/email) list of the org's login accounts. `filter` narrows to a single
// account status (matching the screen's status chips). No count pills, so no
// counts are returned.
usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { limit, cursor, search } = parsePageParams(req);
    const statusFilter =
      typeof req.query.filter === "string" &&
      (ACCOUNT_STATUSES as readonly string[]).includes(req.query.filter)
        ? req.query.filter
        : undefined;

    // Base org scope + optional search over name/email.
    const baseWhere: Prisma.UserWhereInput = { orgId: req.user!.orgId };
    if (search) {
      const ci = { contains: search, mode: "insensitive" as const };
      baseWhere.OR = [{ name: ci }, { email: ci }];
    }

    // The page: apply the status filter on top of the base filter.
    const pageWhere: Prisma.UserWhereInput = statusFilter
      ? { AND: [baseWhere, { status: statusFilter as Prisma.UserWhereInput["status"] }] }
      : baseWhere;

    const page = await paginate({ limit, cursor, search }, (args) =>
      prisma.user.findMany({
        where: pageWhere,
        orderBy: [{ status: "asc" }, { name: "asc" }, { id: "asc" }],
        select: {
          id: true, email: true, name: true, role: true, status: true,
          employeeId: true, customerId: true, createdAt: true, activatedAt: true,
        },
        ...args,
      }),
    );

    res.json({
      items: page.items.map(userDto),
      nextCursor: page.nextCursor,
    });
  }),
);

// GET /users/invitable — people who can be given a login: an Employee or
// Customer that has an email and doesn't already have a login. Feeds the
// invite picker so a login is always tied to a real person.
usersRouter.get(
  "/invitable",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const [employees, customers] = await Promise.all([
      prisma.employee.findMany({
        where: { orgId, deletedAt: null, email: { not: null }, users: { none: {} } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, roles: true },
      }),
      prisma.customer.findMany({
        where: { orgId, deletedAt: null, email: { not: "" }, users: { none: {} } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, contactName: true, email: true },
      }),
    ]);
    res.json([
      ...employees.map((e) => ({
        kind: "employee" as const,
        id: e.id,
        name: e.name,
        email: e.email!,
        roles: e.roles,
      })),
      ...customers.map((c) => ({
        kind: "customer" as const,
        id: c.id,
        name: c.name,
        email: c.email,
        contactName: c.contactName,
      })),
    ]);
  }),
);

// POST /users/invite — provision a login for an EXISTING person (Employee or
// Customer) and send the activation email. The email + name come from that
// record; a login is never created for a free-typed address.
usersRouter.post(
  "/invite",
  asyncHandler(async (req, res) => {
    const admin = req.user!;
    const input = inviteUserSchema.parse(req.body);

    // Resolve the linked person → derive email, name, role. Guard: the record
    // must exist (org-scoped), have an email, and not already have a login.
    let email: string;
    let name: string;
    let role: "admin" | "technician" | "client";
    const link: { employeeId?: string; customerId?: string } = {};

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
      link.employeeId = emp.id;
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
      link.customerId = cust.id;
    }

    // Email is the unique login id — reject if it already exists (any org).
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw Conflict("A user with this email already exists");

    const created = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          orgId: admin.orgId,
          email,
          name,
          passwordHash: await unusablePassword(),
          role,
          status: "invited",
          invitedById: admin.id,
          employeeId: link.employeeId ?? null,
          customerId: link.customerId ?? null,
        },
      });
      await audit(tx, admin, "user.invite", "user", u.id, { email, role });
      return u;
    });

    const token = await issueInvite(created.id);
    await sendInviteEmail(email, created.name, token);

    res.status(201).json(userDto(created));
  }),
);

// POST /users/:id/resend-invite — reissue a token + email (invited users only).
usersRouter.post(
  "/:id/resend-invite",
  asyncHandler(async (req, res) => {
    const admin = req.user!;
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, orgId: admin.orgId },
    });
    if (!user) throw NotFound("User not found");
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
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, orgId: admin.orgId },
    });
    if (!user) throw NotFound("User not found");
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
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, orgId: admin.orgId },
    });
    if (!user) throw NotFound("User not found");
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
