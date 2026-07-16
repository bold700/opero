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

// Load the werkbon's invoice, org-scoped via its parent project. Throws if
// work order/invoice missing.
async function loadInvoice(orgId: string, workOrderId: string) {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, project: { orgId, deletedAt: null } },
    include: { quote: true, invoice: true, extraWork: true, project: true },
  });
  if (!workOrder) throw NotFound("Work order not found");
  if (!workOrder.invoice) throw NotFound("Invoice not found");
  return workOrder;
}

// Compute invoice totals from the accepted quote + approved extra work
// (mirrors the store's deriveInvoiceTotals intent in relational form).
function deriveTotals(workOrder: {
  project: { value: number };
  quote: { amount: number; status: string } | null;
  extraWork: { amount: number; approvedByOffice: boolean; approvedByClient: boolean; rejected: boolean }[];
}) {
  const acceptedQuoteAmount = workOrder.quote?.amount ?? workOrder.project.value;
  const extraWorkAmount = workOrder.extraWork
    .filter((m) => m.approvedByOffice && m.approvedByClient && !m.rejected)
    .reduce((sum, m) => sum + m.amount, 0);
  return {
    acceptedQuoteAmount,
    extraWorkAmount,
    materialsAmount: 0,
    laborAmount: 0,
  };
}

// POST /work-orders/:workOrderId/invoice/draft
invoicesRouter.post(
  "/work-orders/:workOrderId/invoice/draft",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const workOrder = await loadInvoice(user.orgId, req.params.workOrderId);
    const totals = deriveTotals(workOrder);
    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: workOrder.invoice!.id },
        data: { ...totals, status: "draft" },
      });
      await tx.projectActivity.create({
        data: {
          projectId: workOrder.projectId,
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

// POST /work-orders/:workOrderId/invoice/send
invoicesRouter.post(
  "/work-orders/:workOrderId/invoice/send",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const workOrder = await loadInvoice(user.orgId, req.params.workOrderId);
    if (workOrder.invoice!.status === "not_started") {
      throw BadRequest("Create a draft before sending");
    }
    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: workOrder.invoice!.id },
        data: { status: "sent", sentDate: todayIso() },
      });
      await tx.projectActivity.create({
        data: {
          projectId: workOrder.projectId,
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

// POST /work-orders/:workOrderId/invoice/paid
invoicesRouter.post(
  "/work-orders/:workOrderId/invoice/paid",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const workOrder = await loadInvoice(user.orgId, req.params.workOrderId);
    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: workOrder.invoice!.id },
        data: { status: "paid", paidDate: todayIso() },
      });
      await tx.projectActivity.create({
        data: {
          projectId: workOrder.projectId,
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
