import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// URGENCY IS PER WERKBON (the visit is the unit of work). This suite pins the
// redesign's contract:
//   - flagging one visit urgent flips ONLY that visit's listStatus — floor 2's
//     leak must not stamp floor 1's routine job (the old project-level field
//     did exactly that);
//   - the project reads "urgent" only as a rollup of its unfinished visits;
//   - blocked is a separate axis (blocker/blockerKey → project.blocked) and
//     never bleeds into any werkbon's status;
//   - sign-off still outranks urgency.

const TAG = "urgency-wb";
let orgId: string;
let adminToken: string;
let projectId: string;
let woA: string;
let woB: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function statuses(): Promise<Record<string, string>> {
  const rows = await prisma.workOrder.findMany({
    where: { projectId },
    select: { id: true, listStatus: true },
  });
  return Object.fromEntries(rows.map((r) => [r.id, r.listStatus]));
}

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-a@opero.test`, passwordHash: pw, name: "A", role: "admin", status: "active" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });

  const customer = await prisma.customer.create({
    data: { orgId, name: `${TAG} Cust`, contactName: "C", email: "c@c.nl", phone: "", address: "", postalCode: "", city: "" },
  });
  const projRes = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Project` });
  projectId = projRes.body.id;

  for (const which of ["A", "B"] as const) {
    const res = await request(app)
      .post("/api/work-orders")
      .set(auth(adminToken))
      .send({ projectId, title: `${TAG} ${which}` });
    if (which === "A") woA = res.body.id;
    else woB = res.body.id;
  }
});

beforeEach(async () => {
  // Calm baseline: both visits normal, statuses recomputed, no blocker.
  for (const id of [woA, woB]) {
    await request(app)
      .patch(`/api/work-orders/${id}`)
      .set(auth(adminToken))
      .send({ urgency: "normal" });
  }
  await prisma.project.update({
    where: { id: projectId },
    data: { blocker: null, blockerKey: null },
  });
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("per-werkbon urgency", () => {
  it("flagging one visit urgent leaves its sibling untouched", async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${woA}`)
      .set(auth(adminToken))
      .send({ urgency: "urgent" });
    expect(res.status).toBe(200);
    expect(res.body.urgency).toBe("urgent");
    expect(res.body.status).toBe("open");

    const after = await statuses();
    expect(after[woA]).toBe("open");
    expect(after[woB]).toBe("open"); // the whole point of the redesign

    // The project rolls up to urgent while an unfinished urgent visit exists.
    const proj = await request(app)
      .get(`/api/projects/${projectId}`)
      .set(auth(adminToken));
    expect(proj.body.urgency).toBe("urgent");
  });

  it("back to normal falls back to the task-derived status", async () => {
    await request(app)
      .patch(`/api/work-orders/${woA}`)
      .set(auth(adminToken))
      .send({ urgency: "urgent" });
    await request(app)
      .patch(`/api/work-orders/${woA}`)
      .set(auth(adminToken))
      .send({ urgency: "normal" });
    expect((await statuses())[woA]).toBe("open");

    const proj = await request(app)
      .get(`/api/projects/${projectId}`)
      .set(auth(adminToken));
    expect(proj.body.urgency).toBe("normal");
  });

  it("sign-off moves an urgent visit to ready for review", async () => {
    await request(app)
      .patch(`/api/work-orders/${woB}`)
      .set(auth(adminToken))
      .send({ urgency: "urgent" });
    await prisma.workOrder.update({
      where: { id: woB },
      data: { signedAt: new Date(), signedByName: "K" },
    });
    await request(app)
      .patch(`/api/work-orders/${woB}`)
      .set(auth(adminToken))
      .send({ title: `${TAG} B renamed` }); // any PATCH recomputes on the way out
    expect((await statuses())[woB]).toBe("ready_for_review");

    // A signed urgent visit no longer drives the project rollup either.
    const proj = await request(app)
      .get(`/api/projects/${projectId}`)
      .set(auth(adminToken));
    expect(proj.body.urgency).toBe("normal");

    await prisma.workOrder.update({
      where: { id: woB },
      data: { signedAt: null, signedByName: null },
    });
    await request(app)
      .patch(`/api/work-orders/${woB}`)
      .set(auth(adminToken))
      .send({ title: `${TAG} B` });
  });

  it("blocked is a separate axis: a blocker never makes visits urgent", async () => {
    await prisma.project.update({
      where: { id: projectId },
      data: { blockerKey: "materialsUnavailable" },
    });
    // Recompute happens on any werkbon mutation; statuses must stay progress-derived.
    await request(app)
      .patch(`/api/work-orders/${woA}`)
      .set(auth(adminToken))
      .send({ title: `${TAG} A renamed` });
    const after = await statuses();
    expect(after[woA]).toBe("open");
    expect(after[woB]).toBe("open");

    const proj = await request(app)
      .get(`/api/projects/${projectId}`)
      .set(auth(adminToken));
    expect(proj.body.blocked).toBe(true);
    expect(proj.body.urgency).toBe("normal");
  });

  it("the projects LIST carries the same rollup and blocked flag", async () => {
    await request(app)
      .patch(`/api/work-orders/${woA}`)
      .set(auth(adminToken))
      .send({ urgency: "urgent" });
    const list = await request(app)
      .get(`/api/projects?search=${TAG}`)
      .set(auth(adminToken));
    const row = list.body.items.find((p: { id: string }) => p.id === projectId);
    expect(row).toBeDefined();
    expect(row.urgency).toBe("urgent");
    expect(row.blocked).toBe(false);
  });
});
