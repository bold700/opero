import { Router } from "express";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, NotFound } from "../../lib/httpError.js";
import { audit } from "../../lib/audit.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import { recomputeWorkOrderStatus } from "../work-orders/status.js";
import { buildInvoicePdf, type InvoicePdfData } from "./pdf.js";

export const invoicesRouter = Router();

// Invoices are office work: money is never field-visible, so admin + office
// only (spec: Reports/finance = admin; office runs the full operational app).
// foreman/technician/client never reach these routes.
invoicesRouter.use(requireAuth, requireRole("admin", "office"));

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
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
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
    invoiceNumber: inv.invoiceNumber ?? undefined,
    invoiceDate: inv.invoiceDate ?? undefined,
    dueDate: inv.dueDate ?? undefined,
    total:
      inv.acceptedQuoteAmount +
      inv.extraWorkAmount +
      inv.materialsAmount +
      inv.laborAmount,
    sentDate: inv.sentDate ?? undefined,
    paidDate: inv.paidDate ?? undefined,
  };
}

const INVOICE_PAYMENT_DAYS = 14;

function addDays(iso: string, days: number): string {
  const value = new Date(`${iso}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function nextInvoiceNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await prisma.invoice.findMany({
    where: {
      workOrder: { project: { orgId } },
      invoiceNumber: { startsWith: `INV-${year}-` },
    },
    select: { invoiceNumber: true },
  });
  const highest = existing.reduce((max, item) => {
    const value = item.invoiceNumber?.match(/^INV-\d{4}-(\d{4})$/)?.[1];
    return value ? Math.max(max, Number(value)) : max;
  }, 0);
  return `INV-${year}-${String(highest + 1).padStart(4, "0")}`;
}

async function ensureInvoiceIdentity(
  orgId: string,
  invoice: {
    id: string;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    dueDate: string | null;
    acceptedQuoteAmount: number;
  },
) {
  if (invoice.invoiceNumber && invoice.invoiceDate && invoice.dueDate) return invoice;
  const invoiceDate = invoice.invoiceDate ?? todayIso();
  return prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      invoiceNumber: invoice.invoiceNumber ?? (await nextInvoiceNumber(orgId)),
      invoiceDate,
      dueDate: invoice.dueDate ?? addDays(invoiceDate, INVOICE_PAYMENT_DAYS),
    },
  });
}

// Load the werkbon's invoice, org-scoped via its parent project. Throws if
// work order/invoice missing.
async function loadInvoice(orgId: string, workOrderId: string) {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, project: { orgId, deletedAt: null } },
    include: {
      quote: true,
      invoice: true,
      project: true,
      // Meerwerk lines live on the zones now, so pull the werkbon's task
      // materials and filter to the flagged ones in deriveTotals().
      tasks: { include: { materials: true } },
    },
  });
  if (!workOrder) throw NotFound("Work order not found");
  if (!workOrder.invoice) throw NotFound("Invoice not found");
  return workOrder;
}

// Compute invoice totals from the accepted quote + approved extra work.
//
// The two amounts are DISJOINT and are summed into the invoice total by
// invoiceDto(). `acceptedQuoteAmount` is the sold scope (WorkOrder.value, which
// recomputeQuoteAmount() builds from non-meerwerk lines only); `extraWorkAmount`
// is meerwerk that BOTH office and client have approved. A line can therefore
// never be counted twice, and unapproved meerwerk is billed to nobody.
type LineForTotals = {
  quantity: number;
  unitPrice: number | null;
  isExtraWork: boolean;
  approvedByOffice: boolean;
  approvedByClient: boolean;
  rejected: boolean;
};

export function deriveTotals(workOrder: {
  project: { value: number };
  quote: { amount: number; status: string } | null;
  tasks: { materials: LineForTotals[] }[];
}) {
  const acceptedQuoteAmount = workOrder.quote?.amount ?? workOrder.project.value;
  const extraWorkAmount = workOrder.tasks
    .flatMap((t) => t.materials)
    .filter((m) => m.isExtraWork && m.approvedByOffice && m.approvedByClient && !m.rejected)
    // Round per line, matching what the old persisted `amount` snapshot held.
    .reduce((sum, m) => sum + Math.round(m.quantity * (m.unitPrice ?? 0)), 0);
  return {
    acceptedQuoteAmount,
    extraWorkAmount,
    materialsAmount: 0,
    laborAmount: 0,
  };
}

// GET /work-orders/:workOrderId/invoice/pdf — customer-facing invoice.
invoicesRouter.get(
  "/work-orders/:workOrderId/invoice/pdf",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const workOrder = await loadInvoice(user.orgId, req.params.workOrderId);
    if (workOrder.invoice!.status === "not_started") {
      throw BadRequest("Create a draft before exporting the invoice");
    }
    const invoice = await ensureInvoiceIdentity(user.orgId, workOrder.invoice!);
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.orgId } });
    const approvedExtraWork = workOrder.tasks
      .flatMap((task) => task.materials)
      .filter(
        (item) =>
          item.isExtraWork &&
          item.approvedByOffice &&
          item.approvedByClient &&
          !item.rejected,
      );
    const data: InvoicePdfData = {
      invoiceNumber: invoice.invoiceNumber!,
      invoiceDate: invoice.invoiceDate!,
      dueDate: invoice.dueDate!,
      reference: `${workOrder.project.projectNumber} · ${workOrder.title}`,
      quoteNumber: workOrder.quoteNumber ?? undefined,
      customer: {
        name: workOrder.project.customerName,
        contactName: workOrder.project.contactName || undefined,
        address: workOrder.project.address || undefined,
        postalCode: workOrder.project.postalCode || undefined,
        city: workOrder.project.city || undefined,
      },
      acceptedQuoteAmount: invoice.acceptedQuoteAmount,
      extraWork: approvedExtraWork.map((item) => ({
        description: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice ?? 0,
      })),
    };
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="factuur-${invoice.invoiceNumber}.pdf"`,
    );
    await buildInvoicePdf(data, { org }, res);
  }),
);

// POST /work-orders/:workOrderId/invoice/draft
invoicesRouter.post(
  "/work-orders/:workOrderId/invoice/draft",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const workOrder = await loadInvoice(user.orgId, req.params.workOrderId);
    const totals = deriveTotals(workOrder);
    const identity = await ensureInvoiceIdentity(user.orgId, workOrder.invoice!);
    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: workOrder.invoice!.id },
        data: {
          ...totals,
          status: "draft",
          invoiceNumber: identity.invoiceNumber,
          invoiceDate: identity.invoiceDate,
          dueDate: identity.dueDate,
          sentDate: null,
          paidDate: null,
        },
      });
      await tx.workOrder.update({
        where: { id: workOrder.id },
        data: { statusOverride: null },
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
      await recomputeWorkOrderStatus(tx, workOrder.id);
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
    const identity = await ensureInvoiceIdentity(user.orgId, workOrder.invoice!);
    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: workOrder.invoice!.id },
        data: {
          status: "sent",
          sentDate: todayIso(),
          invoiceNumber: identity.invoiceNumber,
          invoiceDate: identity.invoiceDate,
          dueDate: identity.dueDate,
          paidDate: null,
        },
      });
      await tx.workOrder.update({
        where: { id: workOrder.id },
        data: { statusOverride: null },
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
      await recomputeWorkOrderStatus(tx, workOrder.id);
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
      await tx.workOrder.update({
        where: { id: workOrder.id },
        data: { statusOverride: null },
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
      await recomputeWorkOrderStatus(tx, workOrder.id);
      return inv;
    });
    res.json(invoiceDto(updated));
  }),
);
