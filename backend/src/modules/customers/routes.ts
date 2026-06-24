import { Router } from "express";
import {
  createCustomerSchema,
  updateCustomerSchema,
  contactPersonSchema,
  locationSchema,
} from "@opero/shared";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { Forbidden, NotFound } from "../../lib/httpError.js";
import { clampText } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import { contactPersonDto, customerDto, customerListDto, locationDto } from "./dto.js";

export const customersRouter = Router();

// All customer routes require auth.
customersRouter.use(requireAuth);

// A client may only touch their own linked customer. Admins: any. Technician: read
// only (customer info on their own work order — handled in work-orders module;
// here we keep customers admin/client-scoped for list/detail/manage).
function assertCanAccessCustomer(
  user: { role: string; customerId: string | null },
  customerId: string,
) {
  if (user.role === "admin") return;
  if (user.role === "client" && user.customerId === customerId) return;
  throw Forbidden("Not allowed for this customer");
}

// GET /customers — admin: all; client: only their own; technician: none here.
customersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.role === "technician") throw Forbidden("Not available");
    const where =
      user.role === "client"
        ? { orgId: user.orgId, deletedAt: null, id: user.customerId ?? "__none__" }
        : { orgId: user.orgId, deletedAt: null };

    // The list view (per the design) needs each customer's work-order count and
    // last-contact date, so include their projects + workOrders + latest activity.
    const rows = await prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        projects: {
          where: { deletedAt: null },
          select: {
            _count: { select: { workOrders: true } },
            activity: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
          },
        },
      },
    });

    res.json(rows.map(customerListDto));
  }),
);

// GET /customers/:id
customersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanAccessCustomer(user, req.params.id);
    const row = await prisma.customer.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!row) throw NotFound("Customer not found");
    res.json(customerDto(row));
  }),
);

// POST /customers — admin only.
customersRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createCustomerSchema.parse(req.body);
    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.customer.create({
        data: {
          orgId: user.orgId,
          name: clampText(input.name),
          contactName: clampText(input.contactName),
          email: clampText(input.email),
          phone: clampText(input.phone),
          address: clampText(input.address),
          postalCode: clampText(input.postalCode),
          city: clampText(input.city),
          notes: input.notes ? clampText(input.notes) : null,
        },
      });
      await audit(tx, user, "customer.create", "customer", c.id, { name: c.name });
      return c;
    });
    res.status(201).json(customerDto(created));
  }),
);

// PATCH /customers/:id — admin: any; client: own only.
customersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanAccessCustomer(user, req.params.id);
    const input = updateCustomerSchema.parse(req.body);
    const existing = await prisma.customer.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!existing) throw NotFound("Customer not found");
    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.customer.update({
        where: { id: existing.id },
        data: {
          name: input.name !== undefined ? clampText(input.name) : undefined,
          contactName:
            input.contactName !== undefined ? clampText(input.contactName) : undefined,
          email: input.email !== undefined ? clampText(input.email) : undefined,
          phone: input.phone !== undefined ? clampText(input.phone) : undefined,
          address: input.address !== undefined ? clampText(input.address) : undefined,
          postalCode:
            input.postalCode !== undefined ? clampText(input.postalCode) : undefined,
          city: input.city !== undefined ? clampText(input.city) : undefined,
          notes: input.notes !== undefined ? clampText(input.notes) : undefined,
        },
      });
      await audit(tx, user, "customer.update", "customer", c.id, input);
      return c;
    });
    res.json(customerDto(updated));
  }),
);

// DELETE /customers/:id — admin only, soft delete.
customersRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.customer.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!existing) throw NotFound("Customer not found");
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
      await audit(tx, user, "customer.delete", "customer", existing.id);
    });
    res.status(204).end();
  }),
);

// --- Contact persons ------------------------------------------------------

customersRouter.get(
  "/:id/contacts",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanAccessCustomer(user, req.params.id);
    const rows = await prisma.contactPerson.findMany({
      where: { customerId: req.params.id },
      orderBy: { name: "asc" },
    });
    res.json(rows.map(contactPersonDto));
  }),
);

customersRouter.post(
  "/:id/contacts",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = contactPersonSchema.parse(req.body);
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!customer) throw NotFound("Customer not found");
    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.contactPerson.create({
        data: {
          customerId: customer.id,
          name: clampText(input.name),
          email: input.email ? clampText(input.email) : null,
          phone: input.phone ? clampText(input.phone) : null,
          role: input.role ? clampText(input.role) : null,
        },
      });
      await audit(tx, user, "contact.create", "contactPerson", c.id);
      return c;
    });
    res.status(201).json(contactPersonDto(created));
  }),
);

customersRouter.patch(
  "/:id/contacts/:contactId",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = contactPersonSchema.partial().parse(req.body);
    const existing = await prisma.contactPerson.findFirst({
      where: { id: req.params.contactId, customerId: req.params.id },
    });
    if (!existing) throw NotFound("Contact not found");
    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.contactPerson.update({
        where: { id: existing.id },
        data: {
          name: input.name !== undefined ? clampText(input.name) : undefined,
          email: input.email !== undefined ? clampText(input.email) : undefined,
          phone: input.phone !== undefined ? clampText(input.phone) : undefined,
          role: input.role !== undefined ? clampText(input.role) : undefined,
        },
      });
      await audit(tx, user, "contact.update", "contactPerson", c.id);
      return c;
    });
    res.json(contactPersonDto(updated));
  }),
);

customersRouter.delete(
  "/:id/contacts/:contactId",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.contactPerson.findFirst({
      where: { id: req.params.contactId, customerId: req.params.id },
    });
    if (!existing) throw NotFound("Contact not found");
    await prisma.$transaction(async (tx) => {
      await tx.contactPerson.delete({ where: { id: existing.id } });
      await audit(tx, user, "contact.delete", "contactPerson", existing.id);
    });
    res.status(204).end();
  }),
);

// --- Locations ------------------------------------------------------------

customersRouter.get(
  "/:id/locations",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanAccessCustomer(user, req.params.id);
    const rows = await prisma.location.findMany({
      where: { customerId: req.params.id },
      orderBy: { address: "asc" },
    });
    res.json(rows.map(locationDto));
  }),
);

customersRouter.post(
  "/:id/locations",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = locationSchema.parse(req.body);
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!customer) throw NotFound("Customer not found");
    const created = await prisma.$transaction(async (tx) => {
      const l = await tx.location.create({
        data: {
          customerId: customer.id,
          label: input.label ? clampText(input.label) : null,
          address: clampText(input.address),
          postalCode: clampText(input.postalCode),
          city: clampText(input.city),
        },
      });
      await audit(tx, user, "location.create", "location", l.id);
      return l;
    });
    res.status(201).json(locationDto(created));
  }),
);

customersRouter.patch(
  "/:id/locations/:locationId",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = locationSchema.partial().parse(req.body);
    const existing = await prisma.location.findFirst({
      where: { id: req.params.locationId, customerId: req.params.id },
    });
    if (!existing) throw NotFound("Location not found");
    const updated = await prisma.$transaction(async (tx) => {
      const l = await tx.location.update({
        where: { id: existing.id },
        data: {
          label: input.label !== undefined ? clampText(input.label) : undefined,
          address: input.address !== undefined ? clampText(input.address) : undefined,
          postalCode:
            input.postalCode !== undefined ? clampText(input.postalCode) : undefined,
          city: input.city !== undefined ? clampText(input.city) : undefined,
        },
      });
      await audit(tx, user, "location.update", "location", l.id);
      return l;
    });
    res.json(locationDto(updated));
  }),
);

customersRouter.delete(
  "/:id/locations/:locationId",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.location.findFirst({
      where: { id: req.params.locationId, customerId: req.params.id },
    });
    if (!existing) throw NotFound("Location not found");
    await prisma.$transaction(async (tx) => {
      await tx.location.delete({ where: { id: existing.id } });
      await audit(tx, user, "location.delete", "location", existing.id);
    });
    res.status(204).end();
  }),
);
