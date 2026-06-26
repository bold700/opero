import { Router } from "express";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, NotFound } from "../../lib/httpError.js";
import { audit } from "../../lib/audit.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";

export const invoicesRouter = Router();

// Invoices are admin-only (spec: Reports/finance = admin; invoice actions live
// with Administration → admin in the 3-role model).
invoicesRouter.use(requireAuth, requireRole("admin"));

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function invoiceDto(inv: {
  id: string;
  status: string;
  acceptedQuoteAmount: number;
  extraWorkAmount: number;
  materialsAmount: number;
  laborAmount: number;
  sentDate: string | null;
  paidDate: string | null;
}) {
  return {
    id: inv.id,
    status: inv.status,
    acceptedQuoteAmount: inv.acceptedQuoteAmount,
    extraWorkAmount: inv.extraWorkAmount,
    materialsAmount: inv.materialsAmount,
    laborAmount: inv.laborAmount,
    total:
      inv.acceptedQuoteAmount +
      inv.extraWorkAmount +
      inv.materialsAmount +
      inv.laborAmount,
    sentDate: inv.sentDate ?? undefined,
    paidDate: inv.paidDate ?? undefined,
  };
}

// Load the project's invoice, org-scoped. Throws if project/invoice missing.
async function loadInvoice(orgId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId, deletedAt: null },
    include: { invoice: true, quote: true, extraWork: true },
  });
  if (!project) throw NotFound("Project not found");
  if (!project.invoice) throw NotFound("Invoice not found");
  return project;
}

// Compute invoice totals from the accepted quote + approved extra work
// (mirrors the store's deriveInvoiceTotals intent in relational form).
function deriveTotals(project: {
  value: number;
  quote: { amount: number; status: string } | null;
  extraWork: { amount: number; approvedByOffice: boolean; approvedByClient: boolean; rejected: boolean }[];
}) {
  const acceptedQuoteAmount = project.quote?.amount ?? project.value;
  const extraWorkAmount = project.extraWork
    .filter((m) => m.approvedByOffice && m.approvedByClient && !m.rejected)
    .reduce((sum, m) => sum + m.amount, 0);
  return {
    acceptedQuoteAmount,
    extraWorkAmount,
    materialsAmount: 0,
    laborAmount: 0,
  };
}

// POST /projects/:projectId/invoice/draft
invoicesRouter.post(
  "/projects/:projectId/invoice/draft",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const project = await loadInvoice(user.orgId, req.params.projectId);
    const totals = deriveTotals(project);
    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: project.invoice!.id },
        data: { ...totals, status: "draft" },
      });
      await tx.projectActivity.create({
        data: {
          projectId: project.id,
          userId: user.id,
          type: "system",
          messageKey: "invoice.drafted",
        },
      });
      await audit(tx, user, "invoice.draft", "invoice", inv.id, totals);
      return inv;
    });
    res.json(invoiceDto(updated));
  }),
);

// POST /projects/:projectId/invoice/send
invoicesRouter.post(
  "/projects/:projectId/invoice/send",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const project = await loadInvoice(user.orgId, req.params.projectId);
    if (project.invoice!.status === "not_started") {
      throw BadRequest("Create a draft before sending");
    }
    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: project.invoice!.id },
        data: { status: "sent", sentDate: todayIso() },
      });
      await tx.projectActivity.create({
        data: {
          projectId: project.id,
          userId: user.id,
          type: "system",
          messageKey: "invoice.sent",
        },
      });
      await audit(tx, user, "invoice.send", "invoice", inv.id);
      return inv;
    });
    res.json(invoiceDto(updated));
  }),
);

// POST /projects/:projectId/invoice/paid
invoicesRouter.post(
  "/projects/:projectId/invoice/paid",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const project = await loadInvoice(user.orgId, req.params.projectId);
    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: project.invoice!.id },
        data: { status: "paid", paidDate: todayIso() },
      });
      await tx.projectActivity.create({
        data: {
          projectId: project.id,
          userId: user.id,
          type: "system",
          messageKey: "invoice.paid",
        },
      });
      await audit(tx, user, "invoice.paid", "invoice", inv.id);
      return inv;
    });
    res.json(invoiceDto(updated));
  }),
);
