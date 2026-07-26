import { Router } from "express";
import type { Prisma } from "@prisma/client";
import {
  createCustomerSchema,
  updateCustomerSchema,
  contactPersonSchema,
  locationSchema,
} from "@opero/shared";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, Forbidden, NotFound } from "../../lib/httpError.js";
import { clampText } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { parsePageParams, paginate } from "../../lib/pagination.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import { uploadSingle } from "../../lib/upload.js";
import { contactPersonDto, customerDto, customerListDto, locationDto } from "./dto.js";
import { parseSilvasoftCustomers, type ParsedCustomer } from "./silvasoftImport.js";
import { revokeLoginsFor } from "../users/provisioning.js";
import { accountInclude } from "../users/dto.js";
import { canSeeAllProjects, type UserRole } from "@opero/shared";

export const customersRouter = Router();

// Default customer type from the name when the user doesn't pick one: a
// company-looking name → business, otherwise private. Only a default — an
// explicit `type` from the request always wins.
function deriveCustomerType(name: string): "business" | "private" {
  return /\b(bv|b\.v\.|vve|vastgoed|beheer|holding|groep|&|zn|nv|n\.v\.)\b/i.test(name)
    ? "business"
    : "private";
}

// All customer routes require auth.
customersRouter.use(requireAuth);

// A client may only touch their own linked customer. Office staff (admin +
// office): any. Technician: read only (customer info on their own work order —
// handled in the work-orders module; here we keep customers office/client-scoped
// for list/detail/manage).
function assertCanAccessCustomer(
  user: { role: UserRole; customerId: string | null },
  customerId: string,
) {
  if (canSeeAllProjects(user.role)) return;
  if (user.role === "client" && user.customerId === customerId) return;
  throw Forbidden("Not allowed for this customer");
}

// The customer types shown as filter chips + count pills on the list.
const CUSTOMER_TYPES = ["business", "private"] as const;

// GET /customers?cursor=&limit=&search=&filter= — cursor-paginated,
// server-searched (name/city/contactName/email) and server-filtered by type.
// admin: all; client: only their own; technician: none here. Returns
// { items, nextCursor, counts } where counts (total/business/private) are the
// per-type totals across the WHOLE (visibility-scoped) set, so the count pills
// stay accurate no matter how many pages are loaded.
customersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.role === "technician") throw Forbidden("Not available");
    const { limit, cursor, search } = parsePageParams(req);
    const typeFilter =
      typeof req.query.filter === "string" &&
      (CUSTOMER_TYPES as readonly string[]).includes(req.query.filter)
        ? (req.query.filter as (typeof CUSTOMER_TYPES)[number])
        : undefined;

    // Base visibility filter (shared by counts + the page query). The role where
    // uses plain fields + an optional id, no OR of its own, so search's OR-clause
    // can be attached directly.
    const baseWhere: Prisma.CustomerWhereInput =
      user.role === "client"
        ? { orgId: user.orgId, deletedAt: null, id: user.customerId ?? "__none__" }
        : { orgId: user.orgId, deletedAt: null };
    if (search) {
      const ci = { contains: search, mode: "insensitive" as const };
      baseWhere.OR = [
        { name: ci },
        { city: ci },
        { contactName: ci },
        { email: ci },
      ];
    }

    // Per-type counts across the whole scoped+searched set (not just the page).
    const grouped = await prisma.customer.groupBy({
      by: ["type"],
      where: baseWhere,
      _count: { _all: true },
    });
    const counts: Record<string, number> = { total: 0, business: 0, private: 0 };
    for (const g of grouped) {
      counts[g.type] = g._count._all;
      counts.total += g._count._all;
    }

    // The page itself: apply the type filter on top of the base filter.
    const pageWhere: Prisma.CustomerWhereInput = typeFilter
      ? { AND: [baseWhere, { type: typeFilter }] }
      : baseWhere;

    // The list view (per the design) needs each customer's work-order count and
    // last-contact date, so include their projects + workOrders + latest activity.
    const page = await paginate({ limit, cursor, search }, (args) =>
      prisma.customer.findMany({
        where: pageWhere,
        include: {
          users: accountInclude,
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
        orderBy: [{ name: "asc" }, { id: "asc" }],
        ...args,
      }),
    );

    res.json({
      items: page.items.map(customerListDto),
      nextCursor: page.nextCursor,
      counts,
    });
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
      include: { users: accountInclude },
    });
    if (!row) throw NotFound("Customer not found");
    res.json(customerDto(row));
  }),
);

// POST /customers — admin only.
customersRouter.post(
  "/",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createCustomerSchema.parse(req.body);
    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.customer.create({
        data: {
          orgId: user.orgId,
          name: clampText(input.name),
          // User's choice wins; else derive from the name (company-ish → business).
          type: input.type ?? deriveCustomerType(input.name),
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

// --- Silvasoft Excel import ------------------------------------------------
//
// The client's customer list lives in Silvasoft (their accounting software).
// Rather than retype it, they export it to .xlsx and upload it here. Two-step,
// so nothing is written until they've seen what will happen:
//   POST /customers/import/preview  → parse + report (no DB writes)
//   POST /customers/import/commit   → parse + upsert in a transaction
// Re-import matches on Silvasoft's "Nummer" (silvasoftId) per org, so uploading
// the same file twice UPDATES rather than duplicates.

// Turn a parsed row into the create/update payload, clamping text lengths.
function silvasoftToData(c: ParsedCustomer, orgId: string) {
  return {
    orgId,
    name: clampText(c.name),
    type: c.type,
    contactName: clampText(c.contactName),
    email: clampText(c.email),
    phone: clampText(c.phone),
    address: clampText(c.address),
    postalCode: clampText(c.postalCode),
    city: clampText(c.city),
    silvasoftId: c.silvasoftId,
    kvkNumber: c.kvkNumber,
    vatNumber: c.vatNumber,
  };
}

// A stable key for de-duping a row that has NO Silvasoft number: name + address
// + postcode, normalised (lowercased, whitespace-collapsed). Not perfect, but it
// stops the common case — the same numberless customer being re-created on every
// import (e.g. "Guts Installatietechniek B.v., Mijlstraat 20"). Silvasoft's own
// export contains such rows.
function fallbackKey(c: {
  name: string;
  address: string;
  postalCode: string;
}): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return `${norm(c.name)}|${norm(c.address)}|${norm(c.postalCode)}`;
}

// Classify each parsed row against what's already in the DB, so preview and
// commit agree on the create/update split. A row matches an existing customer
// by Silvasoft number when it has one; otherwise it falls back to name+address
// so numberless rows don't duplicate on every re-import.
async function classifySilvasoft(orgId: string, customers: ParsedCustomer[]) {
  const numbered = customers.map((c) => c.silvasoftId).filter((v): v is string => Boolean(v));
  const hasNumberless = customers.some((c) => !c.silvasoftId);

  // Existing rows we might match: by number, or (for numberless imports) the
  // whole org's customers so we can build fallback keys. Only pull the wider set
  // when the file actually has numberless rows.
  const existing = await prisma.customer.findMany({
    where: {
      orgId,
      deletedAt: null,
      ...(hasNumberless ? {} : { silvasoftId: { in: numbered } }),
    },
    select: { id: true, silvasoftId: true, name: true, address: true, postalCode: true },
  });

  const byNumber = new Map<string, string>();
  const byFallback = new Map<string, string>();
  for (const e of existing) {
    if (e.silvasoftId) byNumber.set(e.silvasoftId, e.id);
    // Build a fallback key for every existing row so a previously-imported
    // numberless customer is found on the next import.
    byFallback.set(fallbackKey(e), e.id);
  }

  const toCreate: ParsedCustomer[] = [];
  const toUpdate: { id: string; parsed: ParsedCustomer }[] = [];
  // Guard against the SAME file listing a customer twice. The real export does
  // exactly this: one row with a number, one without, same company. We track
  // the fallback key AND number of everything queued this run so the second
  // mention collapses onto the first instead of creating a duplicate.
  const seenFallback = new Set<string>();
  const seenNumber = new Set<string>();

  for (const c of customers) {
    // 1. Existing DB match (number first, then name+address).
    const dbMatch = c.silvasoftId
      ? byNumber.get(c.silvasoftId)
      : byFallback.get(fallbackKey(c));
    if (dbMatch) {
      toUpdate.push({ id: dbMatch, parsed: c });
      continue;
    }

    // 2. Already seen earlier in THIS file (either by number or name+address).
    const key = fallbackKey(c);
    if ((c.silvasoftId && seenNumber.has(c.silvasoftId)) || seenFallback.has(key)) {
      continue; // same customer twice in one file → import once
    }

    // 3. Genuinely new — queue it and remember both keys for later rows.
    if (c.silvasoftId) seenNumber.add(c.silvasoftId);
    seenFallback.add(key);
    toCreate.push(c);
  }
  return { toCreate, toUpdate };
}

// POST /customers/import/preview — dry run. Returns counts + a sample, writes
// nothing. Admin only.
customersRouter.post(
  "/import/preview",
  requireRole("admin", "office"),
  uploadSingle,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const file = req.file;
    if (!file) throw BadRequest("No file uploaded");

    let parsed;
    try {
      parsed = await parseSilvasoftCustomers(file.buffer);
    } catch (e) {
      throw BadRequest(e instanceof Error ? e.message : "Could not read the file");
    }

    const { toCreate, toUpdate } = await classifySilvasoft(user.orgId, parsed.customers);

    res.json({
      willCreate: toCreate.length,
      willUpdate: toUpdate.length,
      skipped: parsed.skipped,
      unmappedColumns: parsed.unmappedColumns,
      // A short sample so the office can eyeball the mapping before committing.
      sample: parsed.customers.slice(0, 8).map((c) => ({
        silvasoftId: c.silvasoftId,
        name: c.name,
        city: c.city,
        email: c.email,
        type: c.type,
      })),
    });
  }),
);

// POST /customers/import/commit — parse + upsert. Admin only. All-or-nothing
// in one transaction, so a mid-file failure never leaves a half-import.
customersRouter.post(
  "/import/commit",
  requireRole("admin", "office"),
  uploadSingle,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const file = req.file;
    if (!file) throw BadRequest("No file uploaded");

    let parsed;
    try {
      parsed = await parseSilvasoftCustomers(file.buffer);
    } catch (e) {
      throw BadRequest(e instanceof Error ? e.message : "Could not read the file");
    }

    const { toCreate, toUpdate } = await classifySilvasoft(user.orgId, parsed.customers);

    await prisma.$transaction(async (tx) => {
      for (const c of toCreate) {
        const created = await tx.customer.create({ data: silvasoftToData(c, user.orgId) });
        await audit(tx, user, "customer.import.create", "customer", created.id, {
          name: created.name,
          silvasoftId: c.silvasoftId,
        });
      }
      for (const { id, parsed: c } of toUpdate) {
        // Don't overwrite a field the export left blank with an empty string —
        // keep whatever the office may have filled in since the last import.
        const data = silvasoftToData(c, user.orgId);
        await tx.customer.update({
          where: { id },
          data: {
            name: data.name,
            type: data.type,
            ...(data.contactName ? { contactName: data.contactName } : {}),
            ...(data.email ? { email: data.email } : {}),
            ...(data.phone ? { phone: data.phone } : {}),
            ...(data.address ? { address: data.address } : {}),
            ...(data.postalCode ? { postalCode: data.postalCode } : {}),
            ...(data.city ? { city: data.city } : {}),
            ...(data.kvkNumber ? { kvkNumber: data.kvkNumber } : {}),
            ...(data.vatNumber ? { vatNumber: data.vatNumber } : {}),
            // If this row carries a Silvasoft number, stamp it — so a row first
            // imported without one (matched by name+address) upgrades to the
            // stronger number key for future imports. Never clears it.
            ...(data.silvasoftId ? { silvasoftId: data.silvasoftId } : {}),
          },
        });
        await audit(tx, user, "customer.import.update", "customer", id, {
          silvasoftId: c.silvasoftId,
        });
      }
    });

    res.json({
      created: toCreate.length,
      updated: toUpdate.length,
      skipped: parsed.skipped.length,
    });
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
          type: input.type !== undefined ? input.type : undefined,
          notes: input.notes !== undefined ? clampText(input.notes) : undefined,
        },
      });
      // Project.customerName is a denormalized copy (set at project creation)
      // that search, the work-order/project list filters, planning, the
      // dashboard and BOTH PDFs read. Without this fan-out a rename left every
      // existing project — and every reprinted document — showing the old name.
      if (input.name !== undefined && c.name !== existing.name) {
        await tx.project.updateMany({
          where: { customerId: c.id },
          data: { customerName: c.name },
        });
      }
      await audit(tx, user, "customer.update", "customer", c.id, input);
      return c;
    });
    res.json(customerDto(updated));
  }),
);

// DELETE /customers/:id — admin only, soft delete.
customersRouter.delete(
  "/:id",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.customer.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!existing) throw NotFound("Customer not found");
    // Symmetrical with the employee guard. Only an admin reaches this route and
    // customer logins are `client`, so this is unreachable today — it stays so
    // the rule holds if that ever changes.
    if (user.customerId === existing.id) {
      throw BadRequest("You can't delete your own customer record");
    }
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
      // A portal login left behind would be invisible (the record is filtered
      // out of every list) AND still valid.
      const accountsDisabled = await revokeLoginsFor(tx, {
        kind: "customer",
        customerId: existing.id,
      });
      await audit(tx, user, "customer.delete", "customer", existing.id, {
        accountsDisabled,
      });
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
  requireRole("admin", "office"),
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
  requireRole("admin", "office"),
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
  requireRole("admin", "office"),
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
  requireRole("admin", "office"),
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
  requireRole("admin", "office"),
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
  requireRole("admin", "office"),
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
