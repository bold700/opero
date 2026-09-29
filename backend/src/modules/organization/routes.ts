import { Router } from "express";
import { updateOrganizationSchema } from "@opero/shared";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { NotFound } from "../../lib/httpError.js";
import { clampText } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import { uploadSingle } from "../../lib/upload.js";
import { deleteStored, storeUpload } from "../../lib/attachUpload.js";
import { storage } from "../../lib/storage/index.js";

export const organizationRouter = Router();

organizationRouter.use(requireAuth);

type Org = {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  vatNumber: string | null;
  iban: string | null;
  bic: string | null;
  kvkNumber: string | null;
  website: string | null;
  logo: string | null;
};

async function orgDto(o: Org) {
  return {
    id: o.id,
    name: o.name,
    email: o.email ?? "",
    address: o.address ?? "",
    postalCode: o.postalCode ?? "",
    city: o.city ?? "",
    phone: o.phone ?? "",
    vatNumber: o.vatNumber ?? "",
    iban: o.iban ?? "",
    bic: o.bic ?? "",
    kvkNumber: o.kvkNumber ?? "",
    website: o.website ?? "",
    logoUrl: o.logo ? await storage.url(o.logo) : undefined,
  };
}

// GET /organization — any authed user may read (org name/branding/settings).
organizationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.orgId },
    });
    if (!org) throw NotFound("Organization not found");
    res.json(await orgDto(org));
  }),
);

// PATCH /organization — admin only. Company details + the hide-prices flag.
organizationRouter.patch(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateOrganizationSchema.parse(req.body);

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) {
      const name = clampText(input.name).trim();
      if (name) data.name = name;
    }
    if (input.email !== undefined) data.email = clampText(input.email).trim() || null;
    if (input.address !== undefined) data.address = clampText(input.address).trim() || null;
    if (input.postalCode !== undefined) data.postalCode = clampText(input.postalCode).trim() || null;
    if (input.city !== undefined) data.city = clampText(input.city).trim() || null;
    if (input.phone !== undefined) data.phone = clampText(input.phone).trim() || null;
    if (input.vatNumber !== undefined) data.vatNumber = clampText(input.vatNumber).trim() || null;
    if (input.iban !== undefined) data.iban = clampText(input.iban).trim() || null;
    if (input.bic !== undefined) data.bic = clampText(input.bic).trim() || null;
    if (input.kvkNumber !== undefined) data.kvkNumber = clampText(input.kvkNumber).trim() || null;
    if (input.website !== undefined) data.website = clampText(input.website).trim() || null;

    const updated = await prisma.$transaction(async (tx) => {
      const o = await tx.organization.update({
        where: { id: user.orgId },
        data,
      });
      await audit(tx, user, "organization.update", "organization", o.id, input);
      return o;
    });
    res.json(await orgDto(updated));
  }),
);

// POST /organization/logo — one reusable company logo for all documents.
organizationRouter.post(
  "/logo",
  requireRole("admin"),
  uploadSingle,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const key = await storeUpload(user, req.file, "organization-logo", user.orgId);
    const previous = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { logo: true },
    });
    const updated = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.update({
        where: { id: user.orgId },
        data: { logo: key },
      });
      await audit(tx, user, "organization.logo.update", "organization", org.id);
      return org;
    });
    if (previous?.logo && previous.logo !== key) await deleteStored(previous.logo);
    res.json(await orgDto(updated));
  }),
);

organizationRouter.delete(
  "/logo",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const previous = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { logo: true },
    });
    const updated = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.update({
        where: { id: user.orgId },
        data: { logo: null },
      });
      await audit(tx, user, "organization.logo.remove", "organization", org.id);
      return org;
    });
    if (previous?.logo) await deleteStored(previous.logo);
    res.json(await orgDto(updated));
  }),
);
