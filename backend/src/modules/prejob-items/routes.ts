import { Router } from "express";
import {
  createPrejobItemSchema,
  updatePrejobItemSchema,
  reorderPrejobItemsSchema,
} from "@opero/shared";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, NotFound } from "../../lib/httpError.js";
import { clampText } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";

// Admin-configurable pre-job checklist items, per organization. The work-order
// "Controle vooraf" checklist derives from these (see lib/prejobItems.ts).
export const prejobItemsRouter = Router();

// Read is admin-only too (this is Settings config, not on the werkbon path — the
// werkbon serializes its own items via the DTO).
prejobItemsRouter.use(requireAuth, requireRole("admin"));

function itemDto(i: {
  id: string;
  key: string;
  label: string;
  ordinal: number;
  active: boolean;
}) {
  return { id: i.id, key: i.key, label: i.label, ordinal: i.ordinal, active: i.active };
}

// Slugify a label into a stable key base: lowercase, ascii-ish, underscores.
function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "item";
}

// GET /prejob-items — all items (active + inactive) for the settings screen.
prejobItemsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const rows = await prisma.prejobCheckItem.findMany({
      where: { orgId: user.orgId },
      orderBy: [{ active: "desc" }, { ordinal: "asc" }],
    });
    res.json(rows.map(itemDto));
  }),
);

// POST /prejob-items { label } — create; server generates a unique key and
// appends the item at the end.
prejobItemsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createPrejobItemSchema.parse(req.body);
    const label = clampText(input.label).trim();
    if (!label) throw BadRequest("Label required");

    // Unique key within the org: slug, then -2, -3… on collision.
    const existing = await prisma.prejobCheckItem.findMany({
      where: { orgId: user.orgId },
      select: { key: true },
    });
    const taken = new Set(existing.map((e) => e.key));
    const slug = slugify(label);
    let key = slug;
    let n = 2;
    while (taken.has(key)) key = `${slug}_${n++}`;

    const max = await prisma.prejobCheckItem.aggregate({
      where: { orgId: user.orgId },
      _max: { ordinal: true },
    });
    const ordinal = (max._max.ordinal ?? -1) + 1;

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.prejobCheckItem.create({
        data: { orgId: user.orgId, key, label, ordinal, active: true },
      });
      await audit(tx, user, "prejobItem.create", "prejobCheckItem", created.id, { key, label });
      return created;
    });
    res.status(201).json(itemDto(row));
  }),
);

// PATCH /prejob-items/:id { label?, active? } — edit label / (de)activate.
// `key` is never changed (it keys stored booleans on existing work orders).
prejobItemsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updatePrejobItemSchema.parse(req.body);
    const item = await prisma.prejobCheckItem.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!item) throw NotFound("Checklist item not found");

    const data: { label?: string; active?: boolean } = {};
    if (input.label !== undefined) {
      const label = clampText(input.label).trim();
      if (!label) throw BadRequest("Label required");
      data.label = label;
    }
    if (input.active !== undefined) data.active = input.active;

    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.prejobCheckItem.update({ where: { id: item.id }, data });
      await audit(tx, user, "prejobItem.update", "prejobCheckItem", item.id, data);
      return updated;
    });
    res.json(itemDto(row));
  }),
);

// POST /prejob-items/reorder { orderedIds } — persist the display order. Only
// ids belonging to this org are reordered; unknown ids are ignored.
prejobItemsRouter.post(
  "/reorder",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { orderedIds } = reorderPrejobItemsSchema.parse(req.body);
    const owned = await prisma.prejobCheckItem.findMany({
      where: { id: { in: orderedIds }, orgId: user.orgId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((o) => o.id));
    await prisma.$transaction(async (tx) => {
      let ordinal = 0;
      for (const id of orderedIds) {
        if (!ownedIds.has(id)) continue;
        await tx.prejobCheckItem.update({ where: { id }, data: { ordinal: ordinal++ } });
      }
      await audit(tx, user, "prejobItem.reorder", "prejobCheckItem", null, { orderedIds });
    });
    const rows = await prisma.prejobCheckItem.findMany({
      where: { orgId: user.orgId },
      orderBy: [{ active: "desc" }, { ordinal: "asc" }],
    });
    res.json(rows.map(itemDto));
  }),
);

// DELETE /prejob-items/:id — SOFT remove (active=false). Keeps historical
// booleans + PDFs intact; the item just drops off new/open work orders and no
// longer counts toward "complete".
prejobItemsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const item = await prisma.prejobCheckItem.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!item) throw NotFound("Checklist item not found");
    await prisma.$transaction(async (tx) => {
      await tx.prejobCheckItem.update({ where: { id: item.id }, data: { active: false } });
      await audit(tx, user, "prejobItem.remove", "prejobCheckItem", item.id, { key: item.key });
    });
    res.status(204).end();
  }),
);
