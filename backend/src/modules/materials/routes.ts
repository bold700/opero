import { Router } from "express";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, Forbidden, NotFound } from "../../lib/httpError.js";
import { clampText, clampNumber } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import {
  createMaterialSchema,
  updateMaterialSchema,
  updateInventorySchema,
  createArticleSchema,
  updateArticleSchema,
  createWerksoortSchema,
  renameWerksoortSchema,
  createMaterialOrderSchema,
} from "./schema.js";
import {
  materialDto,
  inventoryDto,
  articleDto,
  werksoortDto,
  materialOrderDto,
} from "./dto.js";

export const materialsRouter = Router();

// All materials routes require auth.
materialsRouter.use(requireAuth);

// Spec matrix: Materials = admin full, monteur limited (read — they register
// usage), klant none. Reads allow admin + monteur; klant → 403. Writes are
// gated to admin via requireRole("admin").
function assertCanRead(user: { role: string }) {
  if (user.role === "admin" || user.role === "monteur") return;
  throw Forbidden("Not available");
}

// ===========================================================================
// IMPORTANT — Express route ordering:
// The literal sub-resource paths (/articles, /werksoorten, /orders) MUST be
// registered BEFORE the parameterized /:id routes, otherwise a request to
// e.g. GET /articles would match GET /:id with id="articles". Sub-resources
// come first below.
// ===========================================================================

// --- Articles (catalog) ---------------------------------------------------

// GET /articles — admin + monteur read; klant 403.
materialsRouter.get(
  "/articles",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const rows = await prisma.article.findMany({
      where: { orgId: user.orgId },
      orderBy: { name: "asc" },
    });
    res.json(rows.map(articleDto));
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

// --- Werksoorten ----------------------------------------------------------

// GET /werksoorten — admin + monteur read; klant 403.
materialsRouter.get(
  "/werksoorten",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const rows = await prisma.werksoort.findMany({
      where: { orgId: user.orgId },
      orderBy: { name: "asc" },
    });
    res.json(rows.map(werksoortDto));
  }),
);

// POST /werksoorten — admin only. Dedupe case-insensitive per orgId; skip
// (return the existing) if it already exists.
materialsRouter.post(
  "/werksoorten",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createWerksoortSchema.parse(req.body);
    const name = clampText(input.name);
    const existing = await prisma.werksoort.findFirst({
      where: { orgId: user.orgId, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      res.status(200).json(werksoortDto(existing));
      return;
    }
    const created = await prisma.$transaction(async (tx) => {
      const w = await tx.werksoort.create({
        data: { orgId: user.orgId, name },
      });
      await audit(tx, user, "werksoort.create", "werksoort", w.id, { name: w.name });
      return w;
    });
    res.status(201).json(werksoortDto(created));
  }),
);

// PATCH /werksoorten/:id — admin only, rename.
materialsRouter.patch(
  "/werksoorten/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = renameWerksoortSchema.parse(req.body);
    const existing = await prisma.werksoort.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!existing) throw NotFound("Werksoort not found");
    const updated = await prisma.$transaction(async (tx) => {
      const w = await tx.werksoort.update({
        where: { id: existing.id },
        data: { name: clampText(input.name) },
      });
      await audit(tx, user, "werksoort.update", "werksoort", w.id, input);
      return w;
    });
    res.json(werksoortDto(updated));
  }),
);

// DELETE /werksoorten/:id — admin only.
materialsRouter.delete(
  "/werksoorten/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.werksoort.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!existing) throw NotFound("Werksoort not found");
    await prisma.$transaction(async (tx) => {
      await tx.werksoort.delete({ where: { id: existing.id } });
      await audit(tx, user, "werksoort.delete", "werksoort", existing.id);
    });
    res.status(204).end();
  }),
);

// --- Material orders (purchase list) --------------------------------------

// GET /orders — admin + monteur read; klant 403.
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

// GET / — list materials (orgId-scoped, not soft-deleted, include inventory).
materialsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const rows = await prisma.material.findMany({
      where: { orgId: user.orgId, deletedAt: null },
      include: { inventory: true },
      orderBy: { name: "asc" },
    });
    res.json(rows.map(materialDto));
  }),
);

// GET /:id — admin + monteur read; klant 403.
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
    const created = await prisma.$transaction(async (tx) => {
      const m = await tx.material.create({
        data: {
          orgId: user.orgId,
          name: clampText(input.name),
          unit: clampText(input.unit),
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
    if (!material.inventory) throw BadRequest("Material has no inventory row");
    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.update({
        where: { id: material.inventory!.id },
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
      return inv;
    });
    res.json(inventoryDto(updated));
  }),
);
