import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, Conflict, Forbidden, NotFound } from "../../lib/httpError.js";
import { clampText, clampNumber } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { resolveHidePrices } from "../../lib/orgPricing.js";
import { parsePageParams, paginate } from "../../lib/pagination.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import { canSeePrices, materialCategories, type UserRole } from "@opero/shared";
import {
  createMaterialSchema,
  updateMaterialSchema,
  updateInventorySchema,
  createArticleSchema,
  updateArticleSchema,
  createWorkTypeSchema,
  renameWorkTypeSchema,
  createMaterialOrderSchema,
} from "./schema.js";
import {
  materialDto,
  materialListDto,
  inventoryDto,
  articleDto,
  workTypeDto,
  materialOrderDto,
} from "./dto.js";
import { recomputeMaterialStock } from "./status.js";

export const materialsRouter = Router();

// All materials routes require auth.
materialsRouter.use(requireAuth);

// Spec matrix: Materials = admin full, technician limited (read — they register
// usage), client none. Reads allow admin + technician; client → 403. Writes are
// gated to admin via requireRole("admin").
function assertCanRead(user: { role: string }) {
  if (user.role === "admin" || user.role === "technician") return;
  throw Forbidden("Not available");
}

// Category must be one of the ORG's managed categories (or omitted → DB default).
// Case-insensitive match against the org's MaterialCategory list.
async function assertValidCategory(orgId: string, category: string | undefined) {
  if (category === undefined || category === "") return;
  const exists = await prisma.materialCategory.findFirst({
    where: { orgId, name: { equals: category, mode: "insensitive" } },
    select: { id: true },
  });
  if (!exists) throw BadRequest("Invalid material category");
}

// ===========================================================================
// IMPORTANT — Express route ordering:
// The literal sub-resource paths (/articles, /work-types, /orders) MUST be
// registered BEFORE the parameterized /:id routes, otherwise a request to
// e.g. GET /articles would match GET /:id with id="articles". Sub-resources
// come first below.
// ===========================================================================

// GET /categories — the org's managed material categories (admin + technician).
// Returns { id, name, count } (count = materials using it), sorted by sortOrder
// then name. `count` powers the manager's in-use guard.
materialsRouter.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const [rows, usage] = await Promise.all([
      prisma.materialCategory.findMany({
        where: { orgId: user.orgId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.material.groupBy({
        by: ["category"],
        where: { orgId: user.orgId, deletedAt: null },
        _count: { _all: true },
      }),
    ]);
    const countByName = new Map(usage.map((u) => [u.category, u._count._all]));
    res.json(rows.map((r) => ({ ...r, count: countByName.get(r.name) ?? 0 })));
  }),
);

// POST /categories — admin. Create a category. Case-insensitive dedupe → 409.
materialsRouter.post(
  "/categories",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const name = clampText(String(req.body?.name ?? "")).trim();
    if (!name) throw BadRequest("Category name is required");
    const existing = await prisma.materialCategory.findFirst({
      where: { orgId: user.orgId, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) throw Conflict("A category with this name already exists");
    const created = await prisma.$transaction(async (tx) => {
      const max = await tx.materialCategory.aggregate({
        where: { orgId: user.orgId },
        _max: { sortOrder: true },
      });
      const cat = await tx.materialCategory.create({
        data: { orgId: user.orgId, name, sortOrder: (max._max.sortOrder ?? -1) + 1 },
      });
      await audit(tx, user, "materialCategory.create", "materialCategory", cat.id, { name });
      return cat;
    });
    res.status(201).json({ id: created.id, name: created.name });
  }),
);

// PATCH /categories/:id — admin. Rename. Materials store the category NAME, so a
// rename bulk-updates every material using the old name (same transaction).
materialsRouter.patch(
  "/categories/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const name = clampText(String(req.body?.name ?? "")).trim();
    if (!name) throw BadRequest("Category name is required");
    const cat = await prisma.materialCategory.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!cat) throw NotFound("Category not found");
    // Dedupe against OTHER categories (allow renaming to the same casing).
    const clash = await prisma.materialCategory.findFirst({
      where: {
        orgId: user.orgId,
        name: { equals: name, mode: "insensitive" },
        NOT: { id: cat.id },
      },
      select: { id: true },
    });
    if (clash) throw Conflict("A category with this name already exists");
    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.materialCategory.update({
        where: { id: cat.id },
        data: { name },
      });
      // Cascade the rename to materials that reference the old name.
      if (cat.name !== name) {
        await tx.material.updateMany({
          where: { orgId: user.orgId, category: cat.name },
          data: { category: name },
        });
      }
      await audit(tx, user, "materialCategory.rename", "materialCategory", c.id, {
        from: cat.name,
        to: name,
      });
      return c;
    });
    res.json({ id: updated.id, name: updated.name });
  }),
);

// DELETE /categories/:id — admin. Blocked (409) if any material uses it; the
// response carries the in-use count so the UI can explain / prompt reassignment.
materialsRouter.delete(
  "/categories/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const cat = await prisma.materialCategory.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!cat) throw NotFound("Category not found");
    const inUse = await prisma.material.count({
      where: { orgId: user.orgId, category: cat.name, deletedAt: null },
    });
    if (inUse > 0) {
      throw Conflict(`Category is used by ${inUse} material(s)`);
    }
    await prisma.$transaction(async (tx) => {
      await tx.materialCategory.delete({ where: { id: cat.id } });
      await audit(tx, user, "materialCategory.delete", "materialCategory", cat.id, {
        name: cat.name,
      });
    });
    res.status(204).end();
  }),
);

// --- Articles (catalog) ---------------------------------------------------

// GET /articles — admin + technician read; client 403.
materialsRouter.get(
  "/articles",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const rows = await prisma.article.findMany({
      where: { orgId: user.orgId },
      orderBy: { name: "asc" },
    });
    const hidePrices = await resolveHidePrices(user.role as UserRole, user.orgId);
    const showPrices = canSeePrices(user.role as UserRole, hidePrices);
    res.json(rows.map((a) => articleDto(a, showPrices)));
  }),
);

// POST /articles — admin only.
materialsRouter.post(
  "/articles",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createArticleSchema.parse(req.body);
    const created = await prisma.$transaction(async (tx) => {
      const a = await tx.article.create({
        data: {
          orgId: user.orgId,
          category: input.category,
          name: clampText(input.name),
          unit: clampText(input.unit),
          unitPrice: clampNumber(input.unitPrice),
          defaultQuantity: clampNumber(input.defaultQuantity),
        },
      });
      await audit(tx, user, "article.create", "article", a.id, { name: a.name });
      return a;
    });
    res.status(201).json(articleDto(created));
  }),
);

// PATCH /articles/:id — admin only.
materialsRouter.patch(
  "/articles/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateArticleSchema.parse(req.body);
    const existing = await prisma.article.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!existing) throw NotFound("Article not found");
    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.article.update({
        where: { id: existing.id },
        data: {
          category: input.category !== undefined ? input.category : undefined,
          name: input.name !== undefined ? clampText(input.name) : undefined,
          unit: input.unit !== undefined ? clampText(input.unit) : undefined,
          unitPrice:
            input.unitPrice !== undefined ? clampNumber(input.unitPrice) : undefined,
          defaultQuantity:
            input.defaultQuantity !== undefined
              ? clampNumber(input.defaultQuantity)
              : undefined,
        },
      });
      await audit(tx, user, "article.update", "article", a.id, input);
      return a;
    });
    res.json(articleDto(updated));
  }),
);

// DELETE /articles/:id — admin only (hard delete; no soft-delete column).
materialsRouter.delete(
  "/articles/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.article.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!existing) throw NotFound("Article not found");
    await prisma.$transaction(async (tx) => {
      await tx.article.delete({ where: { id: existing.id } });
      await audit(tx, user, "article.delete", "article", existing.id);
    });
    res.status(204).end();
  }),
);

// --- Work types -----------------------------------------------------------

// GET /work-types — admin + technician read; client 403.
materialsRouter.get(
  "/work-types",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const rows = await prisma.workType.findMany({
      where: { orgId: user.orgId },
      orderBy: { name: "asc" },
    });
    res.json(rows.map(workTypeDto));
  }),
);

// POST /work-types — admin only. Dedupe case-insensitive per orgId; skip
// (return the existing) if it already exists.
materialsRouter.post(
  "/work-types",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createWorkTypeSchema.parse(req.body);
    const name = clampText(input.name);
    const existing = await prisma.workType.findFirst({
      where: { orgId: user.orgId, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      res.status(200).json(workTypeDto(existing));
      return;
    }
    const created = await prisma.$transaction(async (tx) => {
      const w = await tx.workType.create({
        data: { orgId: user.orgId, name },
      });
      await audit(tx, user, "workType.create", "workType", w.id, { name: w.name });
      return w;
    });
    res.status(201).json(workTypeDto(created));
  }),
);

// PATCH /work-types/:id — admin only, rename.
materialsRouter.patch(
  "/work-types/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = renameWorkTypeSchema.parse(req.body);
    const existing = await prisma.workType.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!existing) throw NotFound("Work type not found");
    const updated = await prisma.$transaction(async (tx) => {
      const w = await tx.workType.update({
        where: { id: existing.id },
        data: { name: clampText(input.name) },
      });
      await audit(tx, user, "workType.update", "workType", w.id, input);
      return w;
    });
    res.json(workTypeDto(updated));
  }),
);

// DELETE /work-types/:id — admin only.
materialsRouter.delete(
  "/work-types/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.workType.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!existing) throw NotFound("Work type not found");
    await prisma.$transaction(async (tx) => {
      await tx.workType.delete({ where: { id: existing.id } });
      await audit(tx, user, "workType.delete", "workType", existing.id);
    });
    res.status(204).end();
  }),
);

// --- Material orders (purchase list) --------------------------------------

// GET /orders — admin + technician read; client 403.
materialsRouter.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const rows = await prisma.materialOrder.findMany({
      where: { orgId: user.orgId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map(materialOrderDto));
  }),
);

// POST /orders — admin only. Create MaterialOrder + nested items.
materialsRouter.post(
  "/orders",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createMaterialOrderSchema.parse(req.body);
    const created = await prisma.$transaction(async (tx) => {
      const o = await tx.materialOrder.create({
        data: {
          orgId: user.orgId,
          projectId: input.projectId ?? null,
          items: {
            create: input.items.map((item) => ({
              materialName: clampText(item.materialName),
              quantityToOrder: clampNumber(item.quantityToOrder),
              unit: clampText(item.unit),
              supplier: clampText(item.supplier),
            })),
          },
        },
        include: { items: true },
      });
      await audit(tx, user, "materialOrder.create", "materialOrder", o.id, {
        items: o.items.length,
      });
      return o;
    });
    res.status(201).json(materialOrderDto(created));
  }),
);

// PATCH /orders/:id/receive — admin only. Set receivedAt = now.
materialsRouter.patch(
  "/orders/:id/receive",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.materialOrder.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!existing) throw NotFound("Order not found");
    const updated = await prisma.$transaction(async (tx) => {
      const o = await tx.materialOrder.update({
        where: { id: existing.id },
        data: { receivedAt: new Date() },
        include: { items: true },
      });
      await audit(tx, user, "materialOrder.receive", "materialOrder", o.id);
      return o;
    });
    res.json(materialOrderDto(updated));
  }),
);

// ===========================================================================
// Materials + inventory — parameterized /:id routes registered LAST so the
// literal paths above take precedence.
// ===========================================================================

// The stock-status buckets shown as filter chips + count pills on the list.
const MATERIAL_STOCK_STATUSES = ["ok", "low", "out_of_stock"] as const;

// GET /?cursor=&limit=&search=&filter= — cursor-paginated, server-searched
// (name/category/supplier) and server-filtered by the denormalized stockStatus.
// Returns { items, nextCursor, counts } where counts is the per-status totals
// across the WHOLE (org-scoped + searched) set, so the count pills stay accurate
// no matter how many pages are loaded.
materialsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const { limit, cursor, search } = parsePageParams(req);
    const stockFilter =
      typeof req.query.filter === "string" &&
      (MATERIAL_STOCK_STATUSES as readonly string[]).includes(req.query.filter)
        ? req.query.filter
        : undefined;

    // Base filter (shared by counts + the page query). Search matches name,
    // category and the linked inventory's supplier.
    const baseWhere: Prisma.MaterialWhereInput = {
      orgId: user.orgId,
      deletedAt: null,
    };
    if (search) {
      const ci = { contains: search, mode: "insensitive" as const };
      baseWhere.OR = [
        { name: ci },
        { category: ci },
        { inventory: { is: { supplier: ci } } },
      ];
    }

    // Per-status counts across the whole scoped+searched set (not just the page).
    const grouped = await prisma.material.groupBy({
      by: ["stockStatus"],
      where: baseWhere,
      _count: { _all: true },
    });
    const counts: Record<string, number> = { total: 0 };
    for (const s of MATERIAL_STOCK_STATUSES) counts[s] = 0;
    for (const g of grouped) {
      counts[g.stockStatus] = g._count._all;
      counts.total += g._count._all;
    }

    // The page itself: apply the stock-status filter on top of the base filter.
    const pageWhere: Prisma.MaterialWhereInput = stockFilter
      ? { AND: [baseWhere, { stockStatus: stockFilter }] }
      : baseWhere;

    const page = await paginate({ limit, cursor, search }, (args) =>
      prisma.material.findMany({
        where: pageWhere,
        include: { inventory: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        ...args,
      }),
    );

    // Prices are admin-only (stripped for technicians, per the org's hide-prices).
    const hidePrices = await resolveHidePrices(user.role as UserRole, user.orgId);
    const showPrices = canSeePrices(user.role as UserRole, hidePrices);

    res.json({
      items: page.items.map((m) => materialListDto(m, showPrices)),
      nextCursor: page.nextCursor,
      counts,
    });
  }),
);

// GET /:id — admin + technician read; client 403.
materialsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const row = await prisma.material.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
      include: { inventory: true },
    });
    if (!row) throw NotFound("Material not found");
    res.json(materialDto(row));
  }),
);

// POST / — admin only. Also create the Inventory row if inventory fields given.
materialsRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createMaterialSchema.parse(req.body);
    await assertValidCategory(user.orgId, input.category);
    const created = await prisma.$transaction(async (tx) => {
      const m = await tx.material.create({
        data: {
          orgId: user.orgId,
          name: clampText(input.name),
          unit: clampText(input.unit),
          ...(input.category ? { category: clampText(input.category) } : {}),
          ...(input.unitPrice !== undefined ? { unitPrice: clampNumber(input.unitPrice) } : {}),
        },
      });
      await audit(tx, user, "material.create", "material", m.id, { name: m.name });

      // Seed the linked Inventory row when any inventory field is supplied.
      const hasInventory =
        input.quantityInStock !== undefined ||
        input.supplier !== undefined ||
        input.reorderPoint !== undefined;
      let inventory = null;
      if (hasInventory) {
        inventory = await tx.inventory.create({
          data: {
            materialId: m.id,
            materialName: m.name,
            quantityInStock: clampNumber(input.quantityInStock),
            unit: m.unit,
            supplier: input.supplier ? clampText(input.supplier) : "",
            reorderPoint: clampNumber(input.reorderPoint),
          },
        });
        await audit(tx, user, "inventory.create", "inventory", inventory.id);
      }
      // Seed the denormalized stockStatus from whatever inventory was created.
      await recomputeMaterialStock(tx, m.id);
      return { ...m, inventory };
    });
    res.status(201).json(materialDto(created));
  }),
);

// PATCH /:id — admin only.
materialsRouter.patch(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateMaterialSchema.parse(req.body);
    await assertValidCategory(user.orgId, input.category);
    const existing = await prisma.material.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!existing) throw NotFound("Material not found");
    const updated = await prisma.$transaction(async (tx) => {
      const m = await tx.material.update({
        where: { id: existing.id },
        data: {
          name: input.name !== undefined ? clampText(input.name) : undefined,
          unit: input.unit !== undefined ? clampText(input.unit) : undefined,
          category:
            input.category !== undefined ? clampText(input.category) : undefined,
          unitPrice:
            input.unitPrice !== undefined ? clampNumber(input.unitPrice) : undefined,
        },
        include: { inventory: true },
      });
      await audit(tx, user, "material.update", "material", m.id, input);
      return m;
    });
    res.json(materialDto(updated));
  }),
);

// DELETE /:id — admin only, soft delete.
materialsRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.material.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!existing) throw NotFound("Material not found");
    await prisma.$transaction(async (tx) => {
      await tx.material.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
      await audit(tx, user, "material.delete", "material", existing.id);
    });
    res.status(204).end();
  }),
);

// PATCH /:id/inventory — admin only. Update the linked Inventory row.
materialsRouter.patch(
  "/:id/inventory",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateInventorySchema.parse(req.body);
    const material = await prisma.material.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
      include: { inventory: true },
    });
    if (!material) throw NotFound("Material not found");
    const updated = await prisma.$transaction(async (tx) => {
      // Upsert: create the inventory row if this material doesn't have one yet
      // (so stock can be set on a material that was created without it).
      if (!material.inventory) {
        const inv = await tx.inventory.create({
          data: {
            materialId: material.id,
            materialName: material.name,
            unit: input.unit ? clampText(input.unit) : material.unit,
            quantityInStock:
              input.quantityInStock !== undefined
                ? clampNumber(input.quantityInStock)
                : 0,
            supplier: input.supplier ? clampText(input.supplier) : "",
            reorderPoint:
              input.reorderPoint !== undefined
                ? clampNumber(input.reorderPoint)
                : 0,
          },
        });
        await audit(tx, user, "inventory.create", "inventory", inv.id, input);
        await recomputeMaterialStock(tx, material.id);
        return inv;
      }
      const inv = await tx.inventory.update({
        where: { id: material.inventory.id },
        data: {
          quantityInStock:
            input.quantityInStock !== undefined
              ? clampNumber(input.quantityInStock)
              : undefined,
          supplier:
            input.supplier !== undefined ? clampText(input.supplier) : undefined,
          reorderPoint:
            input.reorderPoint !== undefined
              ? clampNumber(input.reorderPoint)
              : undefined,
          unit: input.unit !== undefined ? clampText(input.unit) : undefined,
        },
      });
      await audit(tx, user, "inventory.update", "inventory", inv.id, input);
      await recomputeMaterialStock(tx, material.id);
      return inv;
    });
    res.json(inventoryDto(updated));
  }),
);
