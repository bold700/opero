import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { Conflict, Forbidden, NotFound } from "../../lib/httpError.js";
import { clampText, clampNumber } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { parsePageParams, paginate } from "../../lib/pagination.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import { canSeePrices, canSeeMargin, isStaff, type UserRole } from "@opero/shared";
import {
  createArticleSchema,
  updateArticleSchema,
  createWorkTypeSchema,
  renameWorkTypeSchema,
  createMaterialOrderSchema,
  createMaterialSchema,
  updateMaterialSchema,
  createVariantSchema,
  updateVariantSchema,
  materialCategoryFilterSchema,
} from "./schema.js";
import {
  materialSummaryDto,
  materialDetailDto,
  variantDto,
  variantSearchRowDto,
  articleDto,
  workTypeDto,
  materialOrderDto,
} from "./dto.js";
import {
  componentsMatching,
  CATEGORY_LABELS,
  CLASS_LABELS,
  COMPONENT_LABELS,
  LINE_UNIT_LABELS,
} from "./labels.js";

// Parse ?category= into a Prisma where-fragment for Material. An absent or empty
// param means "all" — never a filter — so uncategorised materials stay reachable
// and the picker can't end up showing nothing. An invalid value is a 400 (zod).
function categoryWhere(raw: unknown): Prisma.MaterialWhereInput {
  const value = materialCategoryFilterSchema.parse(
    raw === undefined ? undefined : String(raw),
  );
  return value ? { category: value } : {};
}

// A Prisma unique-constraint violation (P2002). Kept local so the CRUD routes
// can translate it into a clean 409 instead of a raw 500.
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: string }).code === "P2002"
  );
}

export const materialsRouter = Router();

// All materials routes require auth.
materialsRouter.use(requireAuth);

// Spec matrix: Materials = admin/office full, technician limited (read — they
// register usage), client none. Reads allow all staff; client → 403. Writes are
// gated via requireRole("admin", "office").
function assertCanRead(user: { role: UserRole }) {
  if (isStaff(user.role)) return;
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
    const showPrices = canSeePrices(user.role as UserRole);
    res.json(rows.map((a) => articleDto(a, showPrices)));
  }),
);

// POST /articles — admin only.
materialsRouter.post(
  "/articles",
  requireRole("admin", "office"),
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
  requireRole("admin", "office"),
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
  requireRole("admin", "office"),
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
  requireRole("admin", "office"),
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
  requireRole("admin", "office"),
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
  requireRole("admin", "office"),
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
  requireRole("admin", "office"),
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
  requireRole("admin", "office"),
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
// and the flat search. User-managed: the seed only BOOTSTRAPS this data, and
// admins create/edit/delete materials + variants via the CRUD routes below.
// Reads: admin + technician. Writes: admin only.
// Literal paths (/suppliers, /variants, /meta) BEFORE the parameterized /:id.
// ===========================================================================

// Class display order: how the four kinds appear in the catalog.
const CLASS_ORDER = ["insulation", "fitting", "tank", "cladding"] as const;

// Auto-generate a stable english slug for a new material's `key`. Users never
// type this — it just satisfies the @@unique([orgId, key]) column that seed data
// and FKs rely on. Derived from name + class, plus a short suffix for uniqueness.
async function generateMaterialKey(
  orgId: string,
  name: string,
  cls: string,
): Promise<string> {
  const base =
    `${cls}_${name}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // strip combining diacritics
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "material";
  // Try the base, then base_2, base_3… until unique within the org.
  for (let n = 1; n < 1000; n += 1) {
    const key = n === 1 ? base : `${base}_${n}`;
    const clash = await prisma.material.findFirst({
      where: { orgId, key },
      select: { id: true },
    });
    if (!clash) return key;
  }
  // Extremely unlikely fallback: append the material count.
  const count = await prisma.material.count({ where: { orgId } });
  return `${base}_${count + 1}`;
}

// Next display ordinal for a new material (append to the end of the org's list).
async function nextMaterialOrdinal(orgId: string): Promise<number> {
  const last = await prisma.material.findFirst({
    where: { orgId },
    orderBy: { ordinal: "desc" },
    select: { ordinal: true },
  });
  return (last?.ordinal ?? -1) + 1;
}

// Next ordinal for a new variant within a material.
async function nextVariantOrdinal(materialId: string): Promise<number> {
  const last = await prisma.materialVariant.findFirst({
    where: { materialId },
    orderBy: { ordinal: "desc" },
    select: { ordinal: true },
  });
  return (last?.ordinal ?? -1) + 1;
}

// Guard a variant/material delete: count task lines still pointing at it. The FK
// is onDelete:SetNull so deleting won't crash, but it silently detaches history.
// We block unless ?force=true (the line keeps its snapshotted name/price).
async function variantsInUse(variantIds: string[]): Promise<number> {
  if (variantIds.length === 0) return 0;
  return prisma.taskMaterial.count({ where: { variantId: { in: variantIds } } });
}

// Enforce variant uniqueness in APP CODE, not just the DB constraint. Postgres
// treats NULL as distinct in unique indexes, so @@unique(size, component,
// thicknessMm) does NOT dedupe rows where thicknessMm is null — we must check
// explicitly. `excludeId` skips the row being updated. Returns true if a
// conflicting sibling exists.
async function variantConflict(
  materialId: string,
  size: string,
  component: string,
  thicknessMm: number | null,
  excludeId?: string,
): Promise<boolean> {
  const clash = await prisma.materialVariant.findFirst({
    where: {
      materialId,
      size,
      component: component as never,
      thicknessMm,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  return clash !== null;
}

// GET / — the catalog grouped by material class. Summaries only (no variant
// payloads): name, supplier, size range, variant count. Optional ?category=
// narrows to one installation system (GKW / CV / KW-WW-CIRC / RIOOL-HWA) so the
// werkbon line picker can shrink the list a technician scrolls through.
materialsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const rows = await prisma.material.findMany({
      where: { orgId: user.orgId, ...categoryWhere(req.query.category) },
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

// GET /meta — enum option lists (class / category / component / sizeUnit / unit) with their
// nl+en display labels, so the create/edit forms are driven by the backend's
// source of truth instead of hardcoded client lists.
materialsRouter.get(
  "/meta",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertCanRead(user);
    const opts = <T extends string>(
      labels: Record<T, Record<"nl" | "en", string>>,
    ) =>
      (Object.keys(labels) as T[]).map((value) => ({
        value,
        nl: labels[value].nl,
        en: labels[value].en,
      }));
    res.json({
      classes: opts(CLASS_LABELS),
      categories: opts(CATEGORY_LABELS),
      components: opts(COMPONENT_LABELS),
      units: opts(LINE_UNIT_LABELS),
      sizeUnits: [
        { value: "pipe_od_mm", nl: "Uitwendige Ø (mm)", en: "Outer Ø (mm)" },
        { value: "pipe_dia_mm", nl: "Diameter (mm)", en: "Diameter (mm)" },
        { value: "tank_liters", nl: "Inhoud (liter)", en: "Capacity (litres)" },
        { value: "flat", nl: "Vast tarief", en: "Flat rate" },
      ],
    });
  }),
);

// POST /materials (mounted at "/") — admin only. Create a material. `key` and
// `ordinal` are generated server-side; provenance is optional metadata.
materialsRouter.post(
  "/",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createMaterialSchema.parse(req.body);
    const key = await generateMaterialKey(user.orgId, input.name, input.class);
    const ordinal = await nextMaterialOrdinal(user.orgId);
    const created = await prisma.$transaction(async (tx) => {
      const m = await tx.material.create({
        data: {
          orgId: user.orgId,
          key,
          name: clampText(input.name),
          class: input.class,
          category: input.category ?? null,
          supplier: clampText(input.supplier ?? ""),
          sizeUnit: input.sizeUnit,
          thicknessMm: input.thicknessMm ?? null,
          pipeMaterial: input.pipeMaterial ?? null,
          finish: input.finish ?? null,
          note: input.note ? clampText(input.note) : null,
          priceSource: input.priceSource ?? null,
          priceValidFrom: input.priceValidFrom ? new Date(input.priceValidFrom) : null,
          priceValidTo: input.priceValidTo ? new Date(input.priceValidTo) : null,
          priceNote: input.priceNote ?? null,
          ordinal,
        },
        include: { variants: { orderBy: { ordinal: "asc" } } },
      });
      await audit(tx, user, "material.create", "material", m.id, { name: m.name });
      return m;
    });
    res.status(201).json(materialDetailDto(created, true, true));
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
// by its Dutch/English label — so "bocht 60" narrows to elbows at Ø60), and
// ?category= (one installation system). Prices stripped for technicians.
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
        ...categoryWhere(req.query.category),
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
    const showPrices = canSeePrices(user.role as UserRole);
    const showMargin = canSeeMargin(user.role as UserRole);
    res.json({
      items: page.items.map((v) => variantSearchRowDto(v, showPrices, showMargin)),
      nextCursor: page.nextCursor,
    });
  }),
);

// PATCH /variants/:id — admin only. Full variant edit: size / component /
// thickness / unit / prices. A cost-only edit is just this with one field
// (`{ costPrice }`), preserving the earlier cost-entry behaviour. Catches the
// @@unique(size, component, thickness) constraint → 409.
materialsRouter.patch(
  "/variants/:id",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateVariantSchema.parse(req.body);
    const existing = await prisma.materialVariant.findFirst({
      where: { id: req.params.id, material: { orgId: user.orgId } },
    });
    if (!existing) throw NotFound("Material variant not found");
    // If any identity field changes, re-check app-level uniqueness (null
    // thickness isn't deduped by the DB constraint).
    if (input.size !== undefined || input.component !== undefined || input.thicknessMm !== undefined) {
      const size = input.size !== undefined ? clampText(input.size) : existing.size;
      const component = input.component ?? existing.component;
      const thicknessMm = input.thicknessMm !== undefined ? input.thicknessMm : existing.thicknessMm;
      if (await variantConflict(existing.materialId, size, component, thicknessMm, existing.id)) {
        throw Conflict("A variant with that size, component and thickness already exists");
      }
    }
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const v = await tx.materialVariant.update({
          where: { id: existing.id },
          data: {
            size: input.size !== undefined ? clampText(input.size) : undefined,
            component: input.component ?? undefined,
            thicknessMm: input.thicknessMm !== undefined ? input.thicknessMm : undefined,
            unit: input.unit ?? undefined,
            unitPrice: input.unitPrice !== undefined ? input.unitPrice : undefined,
            costPrice: input.costPrice !== undefined ? input.costPrice : undefined,
          },
        });
        await audit(tx, user, "materialVariant.update", "materialVariant", v.id, input);
        return v;
      });
      res.json(variantDto(updated, true, true));
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw Conflict("A variant with that size, component and thickness already exists");
      }
      throw e;
    }
  }),
);

// DELETE /variants/:id — admin only. Blocks if the variant is used on a werkbon
// line, unless ?force=true (the line keeps its snapshotted name/price).
materialsRouter.delete(
  "/variants/:id",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.materialVariant.findFirst({
      where: { id: req.params.id, material: { orgId: user.orgId } },
    });
    if (!existing) throw NotFound("Material variant not found");
    const force = String(req.query.force ?? "") === "true";
    const inUse = await variantsInUse([existing.id]);
    if (inUse > 0 && !force) {
      throw Conflict(`Variant is used on ${inUse} werkbon line(s)`);
    }
    await prisma.$transaction(async (tx) => {
      await tx.materialVariant.delete({ where: { id: existing.id } });
      await audit(tx, user, "materialVariant.delete", "materialVariant", existing.id, {
        force,
        inUse,
      });
    });
    res.status(204).end();
  }),
);

// --- Material + variant CRUD on the parameterized /:id path ---------------
// Registered AFTER all literal-prefix routes (/meta, /suppliers, /variants,
// /variants/:id) so "/variants" is never swallowed by "/:id".

// PATCH /:id — admin only. Update a material's editable fields (not key/orgId).
materialsRouter.patch(
  "/:id",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateMaterialSchema.parse(req.body);
    const existing = await prisma.material.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!existing) throw NotFound("Material not found");
    const updated = await prisma.$transaction(async (tx) => {
      const m = await tx.material.update({
        where: { id: existing.id },
        data: {
          name: input.name !== undefined ? clampText(input.name) : undefined,
          class: input.class ?? undefined,
          // `null` is a real value here (clears the system), so test for
          // undefined rather than falling back with ??.
          category: input.category !== undefined ? input.category : undefined,
          supplier: input.supplier !== undefined ? clampText(input.supplier) : undefined,
          sizeUnit: input.sizeUnit ?? undefined,
          thicknessMm: input.thicknessMm !== undefined ? input.thicknessMm : undefined,
          pipeMaterial: input.pipeMaterial !== undefined ? input.pipeMaterial : undefined,
          finish: input.finish !== undefined ? input.finish : undefined,
          note:
            input.note !== undefined
              ? input.note === null
                ? null
                : clampText(input.note)
              : undefined,
          priceSource: input.priceSource !== undefined ? input.priceSource : undefined,
          priceValidFrom:
            input.priceValidFrom !== undefined
              ? input.priceValidFrom
                ? new Date(input.priceValidFrom)
                : null
              : undefined,
          priceValidTo:
            input.priceValidTo !== undefined
              ? input.priceValidTo
                ? new Date(input.priceValidTo)
                : null
              : undefined,
          priceNote: input.priceNote !== undefined ? input.priceNote : undefined,
        },
        include: { variants: { orderBy: { ordinal: "asc" } } },
      });
      await audit(tx, user, "material.update", "material", m.id, input);
      return m;
    });
    res.json(materialDetailDto(updated, true, true));
  }),
);

// DELETE /:id — admin only. Blocks if any of the material's variants are used on
// a werkbon line, unless ?force=true (task lines keep their snapshotted values).
materialsRouter.delete(
  "/:id",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.material.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
      include: { variants: { select: { id: true } } },
    });
    if (!existing) throw NotFound("Material not found");
    const force = String(req.query.force ?? "") === "true";
    const inUse = await variantsInUse(existing.variants.map((v) => v.id));
    if (inUse > 0 && !force) {
      throw Conflict(`Material is used on ${inUse} werkbon line(s)`);
    }
    await prisma.$transaction(async (tx) => {
      await tx.material.delete({ where: { id: existing.id } }); // cascades variants
      await audit(tx, user, "material.delete", "material", existing.id, {
        name: existing.name,
        force,
        inUse,
      });
    });
    res.status(204).end();
  }),
);

// POST /:id/variants — admin only. Add a variant to a material. Catches the
// @@unique(size, component, thickness) constraint → 409.
materialsRouter.post(
  "/:id/variants",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createVariantSchema.parse(req.body);
    const material = await prisma.material.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!material) throw NotFound("Material not found");
    // App-level uniqueness (DB constraint doesn't dedupe null thickness).
    if (await variantConflict(material.id, clampText(input.size), input.component, input.thicknessMm ?? null)) {
      throw Conflict("A variant with that size, component and thickness already exists");
    }
    const ordinal = await nextVariantOrdinal(material.id);
    try {
      const created = await prisma.$transaction(async (tx) => {
        const v = await tx.materialVariant.create({
          data: {
            materialId: material.id,
            size: clampText(input.size),
            component: input.component,
            thicknessMm: input.thicknessMm ?? null,
            unit: input.unit,
            unitPrice: input.unitPrice,
            costPrice: input.costPrice ?? null,
            ordinal,
          },
        });
        await audit(tx, user, "materialVariant.create", "materialVariant", v.id, {
          materialId: material.id,
        });
        return v;
      });
      res.status(201).json(variantDto(created, true, true));
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw Conflict("A variant with that size, component and thickness already exists");
      }
      throw e;
    }
  }),
);

// GET /:id — one material with its full variant set. Prices stripped for field
// staff (canSeePrices — absolute, there is no org toggle).
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
    const showPrices = canSeePrices(user.role as UserRole);
    const showMargin = canSeeMargin(user.role as UserRole);
    res.json(materialDetailDto(material, showPrices, showMargin));
  }),
);
