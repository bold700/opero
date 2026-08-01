import { prisma } from "../src/db/client.js";

// One-off repair for schedule drift produced BEFORE the werkbon PATCH was wired
// through planning/schedule.ts.
//
// Back then, changing a werkbon's date from the werkbon screen wrote
// WorkOrder.plannedDate but left the PlanningItem untouched — and since the item
// shadows plannedDate on the calendar (see planning/dto.ts), the two screens
// disagreed silently.
//
// Direction: plannedDate WINS. Drift could only be produced by the werkbon-PATCH
// path (the planning path always wrote both), so in every drifted row
// plannedDate is the newer intent.
//
// Dry run (default):  npx tsx scripts/reconcile-planning-dates.ts
// Apply:              npx tsx scripts/reconcile-planning-dates.ts --apply

const apply = process.argv.includes("--apply");

type Drift = {
  workOrderId: string;
  projectNumber: string;
  plannedDate: string | null;
  itemDates: string[];
  action: string;
};

async function main() {
  const workOrders = await prisma.workOrder.findMany({
    where: { planningItems: { some: {} } },
    select: {
      id: true,
      plannedDate: true,
      project: { select: { projectNumber: true } },
      planningItems: { orderBy: { date: "asc" }, select: { id: true, date: true } },
    },
  });

  const drifted: Drift[] = [];

  for (const wo of workOrders) {
    const dates = wo.planningItems.map((i) => i.date);

    if (!wo.plannedDate) {
      // No start date but slots exist: the werkbon reads as unplanned while the
      // calendar still draws it. Clearing the slots matches what unscheduling
      // does now. Reported only — deleting data needs a human call.
      drifted.push({
        workOrderId: wo.id,
        projectNumber: wo.project.projectNumber,
        plannedDate: null,
        itemDates: dates,
        action: "REVIEW: no plannedDate but slot(s) exist — unschedule manually?",
      });
      continue;
    }

    if (dates.includes(wo.plannedDate)) continue; // consistent

    drifted.push({
      workOrderId: wo.id,
      projectNumber: wo.project.projectNumber,
      plannedDate: wo.plannedDate,
      itemDates: dates,
      action: `move first slot ${dates[0]} → ${wo.plannedDate}`,
    });
  }

  const extraSlots = workOrders.filter((w) => w.planningItems.length > 1);

  console.log(`scanned ${workOrders.length} werkbon(nen) with planning slots`);
  console.log(`drifted: ${drifted.length}`);
  if (extraSlots.length > 0) {
    console.log(
      `note: ${extraSlots.length} werkbon(nen) have >1 slot; only the first is reconciled`,
    );
  }
  for (const d of drifted) {
    console.log(
      `  ${d.projectNumber} (${d.workOrderId})  plannedDate=${d.plannedDate}  slots=[${d.itemDates.join(", ")}]  → ${d.action}`,
    );
  }

  if (!apply) {
    console.log("\ndry run — re-run with --apply to write");
    return;
  }

  let fixed = 0;
  for (const wo of workOrders) {
    if (!wo.plannedDate) continue; // REVIEW rows are left alone
    const dates = wo.planningItems.map((i) => i.date);
    if (dates.includes(wo.plannedDate)) continue;
    await prisma.planningItem.update({
      where: { id: wo.planningItems[0].id },
      data: { date: wo.plannedDate },
    });
    fixed++;
  }
  console.log(`\napplied: ${fixed} slot(s) moved onto plannedDate`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
