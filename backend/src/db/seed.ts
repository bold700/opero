// Opero backend — Prisma seed.
//
// Re-creates the demo dataset from the shared mock data (@opero/shared) in the
// relational schema. Idempotent: wipes every table (FK-safe order) then
// re-inserts. Run with `corepack pnpm exec tsx src/db/seed.ts` (or `pnpm db:seed`).
import "dotenv/config";
import bcrypt from "bcryptjs";

import { prisma } from "./client.js";
import {
  mockCustomers,
  mockTeamMembers,
  mockMaterials,
  mockInventory,
  mockProjects,
  catalogItems,
  projectTypes,
  type QuoteLineItem,
  type MaterialRequirement,
  type PlanningItem,
  type Werkbon,
  type WerkbonTaak,
  type TaakMateriaal,
  type MeerwerkItem,
  type OpleverItem,
  type ProjectTask,
} from "@opero/shared";
import type {
  TeamRole,
  CatalogCategory,
  BillingType,
  Stage,
  MeerwerkRejectedBy,
} from "@prisma/client";

async function main() {
  // -----------------------------------------------------------------------
  // 1. Wipe everything in FK-safe order (children → parents). deleteMany on
  //    every model so the seed is fully idempotent.
  // -----------------------------------------------------------------------
  await prisma.$transaction([
    // project deepest children first
    prisma.taakMateriaal.deleteMany({}),
    prisma.werkbonTaak.deleteMany({}),
    prisma.werkbon.deleteMany({}),
    prisma.opleverItem.deleteMany({}),
    prisma.oplevering.deleteMany({}),
    prisma.deliveryChecklistItem.deleteMany({}),
    prisma.deliveryChecklist.deleteMany({}),
    prisma.quoteLineItem.deleteMany({}),
    prisma.quote.deleteMany({}),
    prisma.intake.deleteMany({}),
    prisma.invoice.deleteMany({}),
    prisma.meerwerk.deleteMany({}),
    prisma.materialRequirement.deleteMany({}),
    prisma.planningItem.deleteMany({}),
    prisma.projectTask.deleteMany({}),
    prisma.projectActivity.deleteMany({}),
    prisma.materialOrderItem.deleteMany({}),
    prisma.materialOrder.deleteMany({}),
    // auth/session children
    prisma.auditLog.deleteMany({}),
    prisma.authSession.deleteMany({}),
    prisma.passwordReset.deleteMany({}),
    // projects + their direct dependents
    prisma.project.deleteMany({}),
    // customer children
    prisma.contactPerson.deleteMany({}),
    prisma.location.deleteMany({}),
    // catalog / werksoort
    prisma.article.deleteMany({}),
    prisma.werksoort.deleteMany({}),
    // inventory before material (FK)
    prisma.inventory.deleteMany({}),
    prisma.material.deleteMany({}),
    // users before customers/employees (FK), and before org
    prisma.user.deleteMany({}),
    prisma.customer.deleteMany({}),
    prisma.employee.deleteMany({}),
    // org last
    prisma.organization.deleteMany({}),
  ]);

  // -----------------------------------------------------------------------
  // 2. Organization
  // -----------------------------------------------------------------------
  const org = await prisma.organization.create({
    data: { name: "Opero Demo" },
  });
  const orgId = org.id;

  // -----------------------------------------------------------------------
  // 3. Customers (keep mock ids as PK)
  // -----------------------------------------------------------------------
  for (const c of mockCustomers) {
    await prisma.customer.create({
      data: {
        id: c.id,
        orgId,
        name: c.name,
        contactName: c.contactName,
        email: c.email,
        phone: c.phone,
        address: c.address,
        postalCode: c.postalCode,
        city: c.city,
        notes: c.notes ?? null,
      },
    });
  }

  // -----------------------------------------------------------------------
  // 4. Employees (keep mock ids). roles strings map 1:1 to TeamRole enum.
  // -----------------------------------------------------------------------
  for (const tm of mockTeamMembers) {
    await prisma.employee.create({
      data: {
        id: tm.id,
        orgId,
        name: tm.name,
        phone: tm.phone,
        email: tm.email ?? null,
        roles: tm.roles as TeamRole[],
      },
    });
  }
  const employeeIds = new Set(mockTeamMembers.map((tm) => tm.id));
  const validEmployeeId = (id?: string | null): string | null =>
    id && employeeIds.has(id) ? id : null;

  // -----------------------------------------------------------------------
  // 5. Materials + Inventory (keep ids)
  // -----------------------------------------------------------------------
  for (const m of mockMaterials) {
    await prisma.material.create({
      data: { id: m.id, orgId, name: m.name, unit: m.unit },
    });
  }
  for (const inv of mockInventory) {
    await prisma.inventory.create({
      data: {
        id: inv.id,
        materialId: inv.materialId,
        materialName: inv.materialName,
        quantityInStock: inv.quantityInStock,
        unit: inv.unit,
        supplier: inv.supplier,
        reorderPoint: inv.reorderPoint,
      },
    });
  }

  // -----------------------------------------------------------------------
  // 6. Articles (catalog) — keep ids; category → CatalogCategory enum
  // -----------------------------------------------------------------------
  for (const item of catalogItems) {
    await prisma.article.create({
      data: {
        id: item.id,
        orgId,
        category: item.category as CatalogCategory,
        name: item.name,
        unit: item.unit,
        unitPrice: item.unitPrice,
        defaultQuantity: item.defaultQuantity,
      },
    });
  }

  // -----------------------------------------------------------------------
  // 7. Werksoorten (one row per string; @@unique([orgId, name]))
  // -----------------------------------------------------------------------
  for (const name of projectTypes) {
    await prisma.werksoort.upsert({
      where: { orgId_name: { orgId, name } },
      create: { orgId, name },
      update: {},
    });
  }

  // -----------------------------------------------------------------------
  // 8. Projects — nested create so children insert with the parent.
  // -----------------------------------------------------------------------
  for (const p of mockProjects) {
    const intake = p.intake;
    const quote = p.quote;
    const invoice = p.invoice;
    const checklist = p.deliveryChecklist;

    // Derive stage if not present on the mock.
    const stage: Stage =
      (p.stage as Stage | undefined) ??
      (p.status === "operatie"
        ? "in_progress"
        : p.status === "afronding"
          ? "done"
          : "concept");

    const installerConnect = (p.installerIds ?? [])
      .filter((id: string) => employeeIds.has(id))
      .map((id: string) => ({ id }));

    await prisma.project.create({
      data: {
        id: p.id,
        orgId,
        projectNumber: p.projectNumber,
        name: p.name ?? null,
        customerId: p.customerId,
        customerName: p.customerName,
        address: p.address,
        postalCode: p.postalCode,
        city: p.city,
        contactName: p.contactName ?? null,
        contactPhone: p.contactPhone ?? null,
        instructions: p.instructions ?? null,
        insulationType: p.insulationType,
        squareMeters: p.squareMeters,
        description: p.description ?? null,
        werksoorten: p.werksoorten ?? [],
        exclusions: p.exclusions ?? null,
        billingType: (p.billingType as BillingType | undefined) ?? null,
        archived: p.archived ?? false,
        stage,
        status: p.status,
        urgency: p.urgency,
        blocker: p.blocker ?? null,
        nextStep: p.nextStep,
        signature: p.signature ?? null,
        materialsReady: p.materialsReady ?? false,
        plannedDate: p.plannedDate ?? null,
        plannedEndDate: p.plannedEndDate ?? null,
        value: p.value,

        opnamePhotos: p.opname?.photos ?? [],
        opnameNotes: p.opname?.notes ?? "",

        projectLeaderId: validEmployeeId(p.projectLeaderId),
        teamLeaderId: validEmployeeId(p.teamLeaderId),
        installers: { connect: installerConnect },

        // 1:1 intake
        intake: {
          create: {
            status: intake.status,
            plannedDate: intake.plannedDate ?? null,
            contactName: intake.customerDetails.contactName,
            contactEmail: intake.customerDetails.email,
            contactPhone: intake.customerDetails.phone,
            address: intake.address,
            insulationType: intake.insulationType,
            squareMeters: intake.squareMeters,
            cavityWidthMm: intake.cavityWidthMm ?? null,
            existingInsulation: intake.existingInsulation ?? null,
            buildingType: intake.buildingType ?? null,
            accessibility: intake.accessibility ?? null,
            photos: intake.photos,
            notes: intake.notes,
            risks: intake.risks,
            estimatedMaterials: intake.estimatedMaterials,
            estimatedLaborHours: intake.estimatedLaborHours,
          },
        },

        // 1:1 quote with line items
        quote: {
          create: {
            status: quote.status,
            amount: quote.amount,
            sentDate: quote.sentDate ?? null,
            acceptedDate: quote.acceptedDate ?? null,
            lineItems: {
              create: quote.lineItems.map((li: QuoteLineItem, idx: number) => ({
                catalogItemId: li.catalogItemId ?? null,
                werksoort: li.werksoort ?? null,
                description: li.description,
                size: li.size ?? null,
                quantity: li.quantity,
                unit: li.unit,
                unitPrice: li.unitPrice,
                ordinal: idx,
              })),
            },
          },
        },

        // 1:1 invoice
        invoice: {
          create: {
            status: invoice.status,
            acceptedQuoteAmount: invoice.acceptedQuoteAmount,
            extraWorkAmount: invoice.extraWorkAmount,
            materialsAmount: invoice.materialsAmount,
            laborAmount: invoice.laborAmount,
            sentDate: invoice.sentDate ?? null,
            paidDate: invoice.paidDate ?? null,
          },
        },

        // 1:1 delivery checklist with items
        deliveryChecklist: {
          create: {
            qualityNotes: checklist.qualityNotes ?? null,
            items: {
              create: checklist.items.map(
                (
                  it: { id: string; label: string; complete: boolean },
                  idx: number,
                ) => ({
                  label: it.label,
                  complete: it.complete,
                  ordinal: idx,
                }),
              ),
            },
          },
        },

        // material requirements
        materialRequirements: {
          create: (p.materialRequirements ?? []).map((mr: MaterialRequirement) => ({
            materialId: mr.materialId,
            materialName: mr.materialName,
            quantityNeeded: mr.quantityNeeded,
            quantityInStock: mr.quantityInStock,
            unit: mr.unit,
            supplier: mr.supplier,
            expectedDeliveryDate: mr.expectedDeliveryDate ?? null,
          })),
        },

        // planning items
        planningItems: {
          create: (p.planningItems ?? []).map((pi: PlanningItem) => ({
            date: pi.date,
            startTime: pi.startTime,
            endTime: pi.endTime,
            vehicle: pi.vehicle,
            projectLeaderId: validEmployeeId(pi.projectLeaderId),
            teamLeaderId: validEmployeeId(pi.teamLeaderId),
            installers: {
              connect: (pi.installerIds ?? [])
                .filter((id: string) => employeeIds.has(id))
                .map((id: string) => ({ id })),
            },
          })),
        },

        // werkbonnen (work orders in the new model) — optional, absent on mocks
        werkbonnen: {
          create: (p.werkbonnen ?? []).map((wb: Werkbon, wbIdx: number) => ({
            title: wb.title,
            drawings: wb.drawings,
            approvedByOpzichter: wb.approvedByOpzichter,
            ordinal: wbIdx,
            tasks: {
              create: (wb.tasks ?? []).map((t: WerkbonTaak, tIdx: number) => ({
                description: t.description,
                done: t.done,
                day: t.day ?? null,
                beforePhotos: t.beforePhotos,
                resultPhotos: t.resultPhotos,
                startedAt: t.startedAt ?? null,
                endedAt: t.endedAt ?? null,
                hours: t.hours ?? null,
                note: t.note ?? null,
                ordinal: tIdx,
                materials: {
                  create: (t.materials ?? []).map((mtl: TaakMateriaal, mIdx: number) => ({
                    label: mtl.label ?? null,
                    name: mtl.name,
                    quantity: mtl.quantity,
                    usedQuantity: mtl.usedQuantity ?? null,
                    unit: mtl.unit,
                    diameter: mtl.diameter ?? null,
                    unitPrice: mtl.unitPrice ?? null,
                    onSite: mtl.onSite,
                    done: mtl.done ?? false,
                    note: mtl.note ?? null,
                    ordinal: mIdx,
                  })),
                },
              })),
            },
          })),
        },

        // meerwerk — optional, absent on mocks
        meerwerk: {
          create: (p.meerwerk ?? []).map((mw: MeerwerkItem) => ({
            description: mw.description,
            label: mw.label ?? null,
            name: mw.name ?? null,
            quantity: mw.quantity ?? null,
            unit: mw.unit ?? null,
            diameter: mw.diameter ?? null,
            unitPrice: mw.unitPrice ?? null,
            amount: mw.amount,
            photos: mw.photos,
            createdAt: mw.createdAt,
            done: mw.done ?? false,
            approvedByOffice: mw.approvedByOffice,
            approvedByClient: mw.approvedByClient,
            rejected: mw.rejected,
            rejectedBy: (mw.rejectedBy as MeerwerkRejectedBy | undefined) ?? null,
          })),
        },

        // oplevering — optional 1:1, absent on mocks
        ...(p.oplevering
          ? {
              oplevering: {
                create: {
                  photos: p.oplevering.photos,
                  restpunten: p.oplevering.restpunten,
                  signedBy: p.oplevering.signedBy ?? null,
                  completedAt: p.oplevering.completedAt ?? null,
                  checklist: {
                    create: (p.oplevering.checklist ?? []).map((it: OpleverItem, idx: number) => ({
                      label: it.label,
                      done: it.done,
                      ordinal: idx,
                    })),
                  },
                },
              },
            }
          : {}),

        // project tasks — optional, absent on mocks
        tasks: {
          create: (p.tasks ?? []).map((t: ProjectTask, idx: number) => ({
            label: t.label,
            done: t.done,
            source: t.source,
            ordinal: idx,
          })),
        },
      },
    });
  }

  // -----------------------------------------------------------------------
  // 9. Demo users
  // -----------------------------------------------------------------------
  const passwordHash = await bcrypt.hash("opero123", 12);

  const monteurEmployee = mockTeamMembers.find((tm) =>
    tm.roles.includes("Monteur"),
  );
  const firstCustomerId = mockCustomers[0]?.id ?? null;

  await prisma.user.create({
    data: {
      orgId,
      email: "admin@opero.test",
      passwordHash,
      name: "Admin Demo",
      role: "admin",
      totpEnabled: false,
    },
  });
  await prisma.user.create({
    data: {
      orgId,
      email: "monteur@opero.test",
      passwordHash,
      name: "Monteur Demo",
      role: "monteur",
      totpEnabled: false,
      employeeId: validEmployeeId(monteurEmployee?.id),
    },
  });
  await prisma.user.create({
    data: {
      orgId,
      email: "klant@opero.test",
      passwordHash,
      name: "Klant Demo",
      role: "klant",
      totpEnabled: false,
      customerId: firstCustomerId,
    },
  });

  // -----------------------------------------------------------------------
  // 10. Summary
  // -----------------------------------------------------------------------
  const [
    customers,
    employees,
    materials,
    articles,
    werksoorten,
    projects,
    users,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.employee.count(),
    prisma.material.count(),
    prisma.article.count(),
    prisma.werksoort.count(),
    prisma.project.count(),
    prisma.user.count(),
  ]);

  console.log("Seed complete:");
  console.table({
    customers,
    employees,
    materials,
    articles,
    werksoorten,
    projects,
    users,
  });

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
