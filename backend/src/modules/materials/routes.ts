import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { Forbidden, NotFound } from "../../lib/httpError.js";
import { clampText, clampNumber } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { resolveHidePrices } from "../../lib/orgPricing.js";
import { parsePageParams, paginate } from "../../lib/pagination.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import { canSeePrices, type UserRole } from "@opero/shared";
import {
  createArticleSchema,
  updateArticleSchema,
  createWorkTypeSchema,
  renameWorkTypeSchema,
  createMaterialOrderSchema,
} from "./schema.js";
import {
  materialSummaryDto,
  materialDetailDto,
  variantSearchRowDto,
  articleDto,
  workTypeDto,
  materialOrderDto,
} from "./dto.js";
import { componentsMatching } from "./labels.js";

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
// Materials catalog — THE material entities (class-grouped), their variants
// and the flat search. Read-only (data is seeded from @opero/shared).
// Literal paths (/suppliers, /variants) BEFORE the parameterized /:id route.
// ===========================================================================

// Class display order: how the four kinds appear in the catalog.
const CLASS_ORDER = ["insulation", "fitting", "tank", "cladding"] as const;

// GET / — the catalog grouped by material class. Summaries only (no variant
// payloads): name, supplier, size range, variant count.
materialsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const rows = await prisma.material.findMany({
      where: { orgId: user.orgId },
      orderBy: { ordinal: "asc" },
      include: { variants: { select: { size: true } } },
    });
    const groups = CLASS_ORDER.map((cls) => ({
      class: cls,
      materials: rows.filter((m) => m.class === cls).map(materialSummaryDto),
    })).filter((g) => g.materials.length > 0);
    res.json(groups);
  }),
);

// GET /suppliers — distinct supplier names for the org (filter chips).
materialsRouter.get(
  "/suppliers",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const rows = await prisma.material.findMany({
      where: { orgId: user.orgId },
      orderBy: { ordinal: "asc" },
      select: { supplier: true },
    });
    const seen = new Set<string>();
    res.json(
      rows.map((r) => r.supplier).filter((s) => {
        if (seen.has(s)) return false;
        seen.add(s);
        return true;
      }),
    );
  }),
);

// GET /variants — the FLAT, searchable catalog: one row per variant across all
// the org's materials. Paginated (cursor). Optional ?supplier= filter and
// ?search= (each word AND-matched against material name, size, OR a component
// by its Dutch/English label — so "bocht 60" narrows to elbows at Ø60).
// Prices stripped for technicians.
materialsRouter.get(
  "/variants",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const params = parsePageParams(req);
    const supplier = String(req.query.supplier ?? "").trim();

    const words = params.search.split(/\s+/).filter(Boolean);
    const where: Prisma.MaterialVariantWhereInput = {
      material: {
        orgId: user.orgId,
        ...(supplier ? { supplier } : {}),
      },
      ...(words.length
        ? {
            AND: words.map((w) => {
              const comps = componentsMatching(w);
              return {
                OR: [
                  { material: { name: { contains: w, mode: "insensitive" as const } } },
                  { size: { contains: w, mode: "insensitive" as const } },
                  ...(comps.length ? [{ component: { in: comps } }] : []),
                ],
              };
            }),
          }
        : {}),
    };

    const page = await paginate(params, (args) =>
      prisma.materialVariant.findMany({
        where,
        // Stable order: material document order, then variant order, then id.
        orderBy: [
          { material: { ordinal: "asc" } },
          { ordinal: "asc" },
          { id: "asc" },
        ],
        include: { material: true },
        ...args,
      }),
    );

    const hidePrices = await resolveHidePrices(user.role as UserRole, user.orgId);
    const showPrices = canSeePrices(user.role as UserRole, hidePrices);
    res.json({
      items: page.items.map((v) => variantSearchRowDto(v, showPrices)),
      nextCursor: page.nextCursor,
    });
  }),
);

// GET /:id — one material with its full variant set. Prices stripped for
// technicians when the org hides prices from them.
materialsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const material = await prisma.material.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
      include: { variants: { orderBy: { ordinal: "asc" } } },
    });
    if (!material) throw NotFound("Material not found");
    const hidePrices = await resolveHidePrices(user.role as UserRole, user.orgId);
    const showPrices = canSeePrices(user.role as UserRole, hidePrices);
    res.json(materialDetailDto(material, showPrices));
  }),
);
