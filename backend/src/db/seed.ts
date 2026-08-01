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
  mockProjects,
  catalogItems,
  projectTypes,
  supplierMaterials,
  type QuoteLineItem,
  type MaterialRequirement,
  type PlanningItem,
  type WorkOrder,
  type WorkOrderTask,
  type TaskMaterial,
  type ExtraWorkItem,
  type HandoverItem,
  type ProjectTask,
} from "@opero/shared";
import type {
  TeamRole,
  CatalogCategory,
  BillingType,
  Stage,
  ExtraWorkRejectedBy,
} from "@prisma/client";

// Demo dataset toggle. By DEFAULT the seed only bootstraps the essentials the
// app needs to run — organization, materials catalog, articles, work types and
// the three login accounts — and creates NO placeholder customers, employees or
// projects, so a fresh reset gives you a clean slate to enter real data into.
// Set SEED_DEMO=1 to also generate the demo customers/employees/projects (handy
// for local UI work). Everything is still wiped first either way.
const SEED_DEMO = process.env.SEED_DEMO === "1" || process.env.SEED_DEMO === "true";

async function main() {
  // -----------------------------------------------------------------------
  // 1. Wipe everything in FK-safe order (children → parents). deleteMany on
  //    every model so the seed is fully idempotent.
  // -----------------------------------------------------------------------
  await prisma.$transaction([
    // project deepest children first
    prisma.taskMaterial.deleteMany({}),
    prisma.workOrderTask.deleteMany({}),
    prisma.workOrder.deleteMany({}),
    prisma.handoverItem.deleteMany({}),
    prisma.handover.deleteMany({}),
    prisma.deliveryChecklistItem.deleteMany({}),
    prisma.deliveryChecklist.deleteMany({}),
    prisma.quoteLineItem.deleteMany({}),
    prisma.quote.deleteMany({}),
    prisma.intake.deleteMany({}),
    prisma.invoice.deleteMany({}),
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
    prisma.workType.deleteMany({}),
    // materials catalog (variants → materials, FK order)
    prisma.materialVariant.deleteMany({}),
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

  // Default pre-job checklist template (every org needs one — the werkbon
  // snapshots it at creation). Not demo-gated. Keys match the historical list.
  await prisma.prejobCheckItem.createMany({
    data: [
      { orgId, key: "address_confirmed", label: "Adres en toegang bevestigd", ordinal: 0 },
      { orgId, key: "materials_ready", label: "Benodigde materialen gereed", ordinal: 1 },
      { orgId, key: "safety_reviewed", label: "Risico's en veiligheid op locatie bekeken", ordinal: 2 },
      { orgId, key: "customer_informed", label: "Klant geïnformeerd over het bezoek", ordinal: 3 },
    ],
  });

  // -----------------------------------------------------------------------
  // 3. Customers (keep mock ids as PK) — DEMO ONLY
  // -----------------------------------------------------------------------
  if (SEED_DEMO) {
  for (const c of mockCustomers) {
    // Company-looking names → business, otherwise private.
    const isBusiness = /\b(bv|vve|vastgoed|beheer|holding|&|zn)\b/i.test(c.name);
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
        type: isBusiness ? "business" : "private",
        notes: c.notes ?? null,
      },
    });
    // Saved job-site locations: the main address, plus a second site for
    // business customers (so the create-flow location picker has real options).
    await prisma.location.create({
      data: {
        customerId: c.id,
        label: isBusiness ? "Hoofdlocatie" : "Thuisadres",
        address: c.address,
        postalCode: c.postalCode,
        city: c.city,
      },
    });
    if (isBusiness) {
      await prisma.location.create({
        data: {
          customerId: c.id,
          label: "Tweede locatie",
          address: `Magazijnweg ${10 + mockCustomers.indexOf(c)}`,
          postalCode: c.postalCode,
          city: c.city,
        },
      });
    }
  }
  } // end SEED_DEMO customers

  // -----------------------------------------------------------------------
  // 4. Employees (keep mock ids). roles strings map 1:1 to TeamRole enum.
  //    DEMO mode seeds the full mock team; otherwise NO mock employees at all —
  //    the demo logins carry their own dedicated Employee records (§9), so
  //    there is nothing here that needs propping up for them to resolve.
  // -----------------------------------------------------------------------
  const seededTeam = SEED_DEMO ? mockTeamMembers : [];
  for (let i = 0; i < seededTeam.length; i++) {
    const tm = seededTeam[i];
    // Most active; sprinkle a few on_leave / inactive for realistic variety.
    const status =
      i % 7 === 3 ? "on_leave" : i % 11 === 5 ? "inactive" : "active";
    await prisma.employee.create({
      data: {
        id: tm.id,
        orgId,
        name: tm.name,
        phone: tm.phone,
        email: tm.email ?? null,
        roles: tm.roles as TeamRole[],
        status,
      },
    });
  }
  const employeeIds = new Set(seededTeam.map((tm) => tm.id));
  const validEmployeeId = (id?: string | null): string | null =>
    id && employeeIds.has(id) ? id : null;

  // The technician demo login gets its OWN Employee, never a mockTeamMembers
  // persona. Binding it to the first mock technician (tm-004 "Sven Bakker")
  // made the login's identity depend on array order in shared/src/mock-data.ts,
  // and that persona sits on every project crew — so the dev login inherited a
  // full werkbon list it was never meant to own.
  //
  // Seeded with NO work: this employee starts with zero werkbon and project
  // assignments, so the account is a clean slate you assign work to yourself.
  const DEMO_TECHNICIAN_ID = "demo-technician";
  await prisma.employee.create({
    data: {
      id: DEMO_TECHNICIAN_ID,
      orgId,
      name: "Technician Demo",
      phone: "",
      email: "technician@opero.test",
      roles: ["Technician"] as TeamRole[],
      status: "active",
    },
  });

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
  // 6b. Materials catalog — THE material entities from the supplier documents
  //     (Merwede 2026-2029, Ezron 2025, AF5/AF6 adjusted). Data in
  //     @opero/shared (shared/src/materials.ts); one Material per product with
  //     its price provenance, one MaterialVariant per priced size × component.
  // -----------------------------------------------------------------------
  for (let m = 0; m < supplierMaterials.length; m++) {
    const mat = supplierMaterials[m];
    const created = await prisma.material.create({
      data: {
        orgId,
        key: mat.key,
        name: mat.name,
        class: mat.class,
        supplier: mat.supplier,
        pipeMaterial: mat.pipeMaterial ?? null,
        thicknessMm: mat.thicknessMm ?? null,
        finish: mat.finish ?? null,
        sizeUnit: mat.sizeUnit,
        note: mat.note ?? null,
        priceSource: mat.priceSource,
        priceValidFrom: mat.priceValidFrom ? new Date(mat.priceValidFrom) : null,
        priceValidTo: mat.priceValidTo ? new Date(mat.priceValidTo) : null,
        priceNote: mat.priceNote ?? null,
        ordinal: m,
      },
    });
    await prisma.materialVariant.createMany({
      data: mat.variants.map((v, idx) => ({
        materialId: created.id,
        size: v.size,
        component: v.component,
        thicknessMm: v.thicknessMm ?? null,
        unit: v.unit,
        unitPrice: v.unitPrice,
        costPrice: v.costPrice ?? null,
        ordinal: idx,
      })),
    });
  }

  // -----------------------------------------------------------------------
  // 7. Work types (managed list; one row per canonical name)
  // -----------------------------------------------------------------------
  for (const name of projectTypes) {
    await prisma.workType.upsert({
      where: { orgId_name: { orgId, name } },
      create: { orgId, name },
      update: {},
    });
  }
  // name -> id lookup so projects can link to a real WorkType row.
  const workTypeByName = new Map(
    (await prisma.workType.findMany({ where: { orgId } })).map((w) => [
      w.name,
      w.id,
    ]),
  );
  // Map each demo project's free-text insulationType to a canonical WorkType.
  // (Real projects pick from the list directly; this only cleans up seed data.)
  function resolveWorkType(raw: string): { id: string; name: string } {
    const lower = raw.toLowerCase();
    const match =
      projectTypes.find((t) => lower.includes(t.toLowerCase().split("-")[0])) ??
      (lower.includes("spouw")
        ? "Spouwmuurisolatie"
        : lower.includes("dak")
          ? "Dakisolatie"
          : lower.includes("vloer")
            ? "Vloerisolatie"
            : lower.includes("kruipruimte") || lower.includes("bodem")
              ? "Kruipruimte-isolatie"
              : lower.includes("gevel")
                ? "Gevelisolatie"
                : lower.includes("plafond")
                  ? "Plafondisolatie"
                  : lower.includes("binnenwand")
                    ? "Binnenwandisolatie"
                    : projectTypes[0]);
    const id = workTypeByName.get(match);
    return { id: id!, name: match };
  }

  // -----------------------------------------------------------------------
  // 8a. Werkbon builder — billing (quote+invoice), scheduling and extra work
  //     are per-werkbon now. This maps a mock project onto its nested werkbon
  //     create array with these rules:
  //       - Always produce at least one werkbon (the "primary") so the
  //         project's quote/invoice have a home even when the mock carries no
  //         explicit workOrders.
  //       - The PRIMARY werkbon inherits the project's plannedDate(s), quote
  //         (with line items), invoice, extraWork and planningItems.
  //       - Every ADDITIONAL werkbon gets its own derived quote + invoice so
  //         billing works uniformly across all werkbonnen. To exercise the
  //         multi-werkbon flow, a couple of projects are given 2–3 werkbonnen.
  // -----------------------------------------------------------------------
  // Synthesize a couple of tasks with varied completion for projects whose
  // mock carries no explicit werkbon tasks. mode: 0 = none done (Open),
  // 1 = some done (In progress), 2 = all done (Done).
  function synthTasks(mode: number): WorkOrderTask[] {
    const now = new Date().toISOString();
    return [
      {
        description: "Voorbereiding en materiaal controleren",
        done: mode === 2,
        beforePhotos: [],
        resultPhotos: [],
        startedAt: mode >= 1 ? now : undefined,
        endedAt: mode === 2 ? now : undefined,
        materials: [],
      } as unknown as WorkOrderTask,
      {
        description: "Isolatie aanbrengen",
        done: mode === 2,
        beforePhotos: [],
        resultPhotos: [],
        materials: [],
      } as unknown as WorkOrderTask,
    ];
  }

  // `meerwerk` (when given) is appended to this zone's lines as flagged
  // TaskMaterials — extra work is an ordinary line with `isExtraWork` set.
  function buildTaskCreate(
    t: WorkOrderTask,
    tIdx: number,
    meerwerk: ExtraWorkItem[] = [],
  ) {
    const lines = (t.materials ?? []).map((mtl: TaskMaterial, mIdx: number) => ({
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
    }));
    const extra = meerwerk.map((mw: ExtraWorkItem, i: number) => ({
      label: mw.label ?? null,
      name: mw.name ?? mw.description,
      quantity: mw.quantity ?? 1,
      unit: mw.unit ?? "stuk",
      diameter: mw.diameter ?? null,
      unitPrice: mw.unitPrice ?? null,
      onSite: false,
      done: mw.done ?? false,
      photos: mw.photos,
      ordinal: lines.length + i,
      isExtraWork: true,
      approvedByOffice: mw.approvedByOffice,
      approvedByClient: mw.approvedByClient,
      rejected: mw.rejected,
      rejectedBy: (mw.rejectedBy as ExtraWorkRejectedBy | undefined) ?? null,
    }));
    return {
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
      materials: { create: [...lines, ...extra] },
    };
  }

  function buildWorkOrders(p: (typeof mockProjects)[number]) {
    const quote = p.quote;
    const invoice = p.invoice;

    // The mock werkbonnen (may be empty). We always want at least one.
    const mockWos = p.workOrders ?? [];

    // Decide how many werkbonnen to seed. To exercise the multi-werkbon flow,
    // give a couple of projects (every 5th operational/closing one is enough
    // variety) 2–3 werkbonnen even though the mock only defines one shape.
    const projectIndex = mockProjects.indexOf(p);
    const isBillable = p.status === "operations" || p.status === "closing";
    const extraWerkbonnen = isBillable && projectIndex % 5 === 2 ? 2 : 0;

    // Base list of werkbonnen to create: the mock ones, or a synthesized
    // primary when the mock has none.
    const base: Array<{ title: string; drawings: string[]; approvedBySupervisor: boolean; tasks: WorkOrderTask[] }> =
      mockWos.length > 0
        ? mockWos.map((wb: WorkOrder) => ({
            title: wb.title,
            drawings: wb.drawings,
            approvedBySupervisor: wb.approvedBySupervisor,
            tasks: wb.tasks ?? [],
          }))
        : [
            {
              title: "Werkbon 1",
              drawings: [],
              approvedBySupervisor: false,
              // Vary completion across operational projects so the werkbon list
              // shows Open / In progress / Done states. Non-operational
              // projects get an empty (Open) werkbon.
              tasks: isBillable
                ? synthTasks(projectIndex % 3)
                : [],
            },
          ];

    // Append the synthetic extra werkbonnen (own quote+invoice, no inherited
    // project billing) so multi-werkbon projects have several billed visits.
    for (let e = 0; e < extraWerkbonnen; e++) {
      base.push({
        title: `Werkbon ${base.length + 1}`,
        drawings: [],
        approvedBySupervisor: false,
        tasks: [
          { description: "Voorbereiding", done: false, beforePhotos: [], resultPhotos: [], materials: [] } as unknown as WorkOrderTask,
          { description: "Isolatie aanbrengen", done: false, beforePhotos: [], resultPhotos: [], materials: [] } as unknown as WorkOrderTask,
        ],
      });
    }

    const count = base.length;
    // Split the project's total quote amount across the werkbonnen so each has
    // a realistic (non-zero) value; the primary keeps any rounding remainder.
    const totalAmount = quote.amount ?? 0;
    const share = count > 0 ? Math.round(totalAmount / count) : totalAmount;

    // The project's crew, valid-filtered — the same list the project itself
    // connects as `installers`.
    const crew = (p.installerIds ?? [])
      .filter((id: string) => employeeIds.has(id))
      .map((id: string) => ({ id }));

    return base.map((wb, wbIdx) => {
      const isPrimary = wbIdx === 0;
      const amount = isPrimary ? totalAmount - share * (count - 1) : share;

      return {
        title: wb.title,
        drawings: wb.drawings,
        approvedBySupervisor: wb.approvedBySupervisor,
        ordinal: wbIdx,
        // Crew assignment is PER WERKBON — that's what makes a werkbon visible
        // to a monteur (see work-orders/visibility.ts). Seeding only the
        // project's `installers` would leave every technician with an empty app.
        assignees: { connect: crew },
        // Scheduling lives on the werkbon; only the primary inherits the
        // project's planned dates.
        plannedDate: isPrimary ? p.plannedDate ?? null : null,
        plannedEndDate: isPrimary ? p.plannedEndDate ?? null : null,
        value: amount,

        tasks: {
          create: (wb.tasks ?? []).map((t: WorkOrderTask, tIdx: number) =>
            // Meerwerk is defined once at project level in the mock; hang it off
            // the primary werkbon's FIRST zone (it has to live in a zone now).
            buildTaskCreate(t, tIdx, isPrimary && tIdx === 0 ? (p.extraWork ?? []) : []),
          ),
        },

        // Every werkbon gets a quote. The primary inherits the project's quote
        // (status/dates + line items); additional werkbonnen get a simple
        // derived quote with the shared amount.
        quote: {
          create: isPrimary
            ? {
                status: quote.status,
                amount,
                sentDate: quote.sentDate ?? null,
                acceptedDate: quote.acceptedDate ?? null,
                lineItems: {
                  create: quote.lineItems.map(
                    (li: QuoteLineItem, idx: number) => ({
                      catalogItemId: li.catalogItemId ?? null,
                      workType: li.workType ?? null,
                      description: li.description,
                      size: li.size ?? null,
                      quantity: li.quantity,
                      unit: li.unit,
                      unitPrice: li.unitPrice,
                      ordinal: idx,
                    }),
                  ),
                },
              }
            : {
                status: quote.status,
                amount,
              },
        },

        // Every werkbon gets an invoice. The primary inherits the project's
        // invoice amounts; additional werkbonnen get a minimal invoice carrying
        // the werkbon's share as its accepted quote amount.
        invoice: {
          create: isPrimary
            ? {
                status: invoice.status,
                acceptedQuoteAmount: invoice.acceptedQuoteAmount,
                extraWorkAmount: invoice.extraWorkAmount,
                materialsAmount: invoice.materialsAmount,
                laborAmount: invoice.laborAmount,
                sentDate: invoice.sentDate ?? null,
                paidDate: invoice.paidDate ?? null,
              }
            : {
                status: invoice.status,
                acceptedQuoteAmount: amount,
              },
        },

        // extraWork + planningItems only attach to the primary werkbon (the
        // mock defines them once, at project level).
        ...(isPrimary
          ? {
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
            }
          : {}),
      };
    });
  }

  // -----------------------------------------------------------------------
  // 8. Projects — nested create so children insert with the parent. DEMO ONLY:
  //    real projects are created through the app, not seeded.
  // -----------------------------------------------------------------------
  if (SEED_DEMO)
  for (const p of mockProjects) {
    const workType = resolveWorkType(p.insulationType);
    const intake = p.intake;
    const checklist = p.deliveryChecklist;

    // Derive stage if not present on the mock.
    const stage: Stage =
      (p.stage as Stage | undefined) ??
      (p.status === "operations"
        ? "in_progress"
        : p.status === "closing"
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
        workTypeId: workType.id,
        insulationType: workType.name,
        squareMeters: p.squareMeters,
        description: p.description ?? null,
        workTypes: p.workTypes ?? [],
        exclusions: p.exclusions ?? null,
        billingType: (p.billingType as BillingType | undefined) ?? null,
        archived: p.archived ?? false,
        stage,
        status: p.status,
        urgency: p.urgency,
        blocker: p.blocker ?? null,
        blockerKey: p.blockerKey ?? null,
        nextStepKey: p.nextStepKey,
        signature: p.signature ?? null,
        materialsReady: p.materialsReady ?? false,
        value: p.value,

        surveyPhotos: p.survey?.photos ?? [],
        surveyNotes: p.survey?.notes ?? "",

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

        // NOTE: Quote + Invoice moved from Project to WorkOrder (billing is
        // per-werkbon now). They are nested under the workOrders create below,
        // not here. Same for planningItems, extraWork, and plannedDate(s).

        // 1:1 delivery checklist with items
        deliveryChecklist: {
          create: {
            qualityNotes: checklist.qualityNotes ?? null,
            items: {
              create: checklist.items.map(
                (
                  it: { id: string; labelKey: string; complete: boolean },
                  idx: number,
                ) => ({
                  labelKey: it.labelKey,
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

        // workOrders (werkbonnen) — billing (quote+invoice), scheduling
        // (plannedDate/plannedEndDate), planningItems and extraWork all live on
        // the werkbon now. `buildWorkOrders(p)` (defined above the loop) builds
        // the nested create array: it always yields at least one werkbon so the
        // project's billing has a home, attaches the project's quote/invoice/
        // extraWork/planningItems/plannedDate to the PRIMARY werkbon, and gives
        // every additional werkbon its own derived quote + invoice.
        workOrders: {
          create: buildWorkOrders(p),
        },

        // handover — optional 1:1, absent on mocks
        ...(p.handover
          ? {
              handover: {
                create: {
                  photos: p.handover.photos,
                  restpunten: p.handover.restpunten,
                  signedBy: p.handover.signedBy ?? null,
                  completedAt: p.handover.completedAt ?? null,
                  checklist: {
                    create: (p.handover.checklist ?? []).map((it: HandoverItem, idx: number) => ({
                      labelKey: it.labelKey,
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

  // Note: werkbon (WorkOrder) generation — including billing (quote+invoice),
  // scheduling and varied task-completion states — is handled by
  // buildWorkOrders(p) nested under each project create above.

  // -----------------------------------------------------------------------
  // 9. Demo users
  // -----------------------------------------------------------------------
  const passwordHash = await bcrypt.hash("opero123", 12);

  // THE INVARIANT: every login links to an Employee or a Customer. Access is
  // managed from the Werknemers / Klanten screens, so an unlinked login would be
  // invisible there — and impossible to revoke through the UI. Pinned by
  // modules/users/invariant.test.ts.

  // The admin login needs its own Employee record; there is no mock team member
  // for "the office admin", so mint one. Administration puts them in the
  // existing "office" filter bucket.
  const adminEmployee = await prisma.employee.create({
    data: {
      orgId,
      name: "Admin Demo",
      phone: "",
      email: "admin@opero.test",
      roles: ["Administration"] as TeamRole[],
      status: "active",
    },
  });

  // Only seeded when demo customers were (the non-demo slice seeds none).
  const firstCustomerId = SEED_DEMO ? mockCustomers[0]?.id ?? null : null;

  await prisma.user.create({
    data: {
      orgId,
      email: "admin@opero.test",
      passwordHash,
      name: "Admin Demo",
      role: "admin",
      totpEnabled: false,
      employeeId: adminEmployee.id,
    },
  });

  // Office staff: the full operational app, but no login provisioning and no
  // org settings. Gets its own Employee record so the invariant holds.
  const officeEmployee = await prisma.employee.create({
    data: {
      orgId,
      name: "Office Demo",
      phone: "",
      email: "office@opero.test",
      roles: ["WorkPlanner"] as TeamRole[],
      status: "active",
    },
  });
  await prisma.user.create({
    data: {
      orgId,
      email: "office@opero.test",
      passwordHash,
      name: "Office Demo",
      role: "office",
      totpEnabled: false,
      employeeId: officeEmployee.id,
    },
  });

  // The technician login always resolves: its Employee (DEMO_TECHNICIAN_ID) is
  // minted unconditionally in §4, so the link invariant holds on a clean slate
  // without depending on any mock data being seeded.
  await prisma.user.create({
    data: {
      orgId,
      email: "technician@opero.test",
      passwordHash,
      name: "Technician Demo",
      role: "technician",
      totpEnabled: false,
      employeeId: DEMO_TECHNICIAN_ID,
    },
  });

  // The client login is only created when its Customer exists (demo-only).
  // Creating it unlinked would break the invariant on a clean slate.
  if (firstCustomerId) {
    await prisma.user.create({
      data: {
        orgId,
        email: "client@opero.test",
        passwordHash,
        name: "Client Demo",
        role: "client",
        totpEnabled: false,
        customerId: firstCustomerId,
      },
    });
  }

  // Foreman (meewerkend uitvoerder) — demo-only: sees everyone's werkbonnen and
  // planning, no prices, nothing commercial. Real foreman accounts arrive via
  // invite; the clean seed stays at the essential logins.
  if (SEED_DEMO) {
    const foremanEmployee = await prisma.employee.create({
      data: {
        orgId,
        name: "Foreman Demo",
        phone: "",
        email: "foreman@opero.test",
        roles: ["Foreman"] as TeamRole[],
        status: "active",
      },
    });
    await prisma.user.create({
      data: {
        orgId,
        email: "foreman@opero.test",
        passwordHash,
        name: "Foreman Demo",
        role: "foreman",
        totpEnabled: false,
        employeeId: foremanEmployee.id,
      },
    });
  }

  // -----------------------------------------------------------------------
  // 10. Summary
  // -----------------------------------------------------------------------
  const [
    customers,
    employees,
    materials,
    materialVariants,
    articles,
    workTypes,
    projects,
    users,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.employee.count(),
    prisma.material.count(),
    prisma.materialVariant.count(),
    prisma.article.count(),
    prisma.workType.count(),
    prisma.project.count(),
    prisma.user.count(),
  ]);

  console.log("Seed complete:");
  console.table({
    customers,
    employees,
    materials,
    materialVariants,
    articles,
    workTypes,
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
