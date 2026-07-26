import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Switching a project's CUSTOMER (PATCH /projects/:id { customerId }).
//
// This is an ACCESS change, not a relabel: the client portal is scoped by
// project.customerId, so the job — and its werkbonnen — move out of one
// customer's portal and into another's. Three things must travel with it:
//   - customerId (the access gate itself)
//   - customerName (the denormalized copy read by search/lists/PDFs)
//   - locationId, cleared unless the NEW customer owns that location
// The job SITE (address/postalCode/city) must NOT move.

const TAG = "custswitch-test";
let orgId: string;
let adminToken: string;
let custA: string;
let custB: string;
let clientAToken: string;
let clientBToken: string;
let projectId: string;
let workOrderId: string;
let locationA: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const projectRow = () =>
  prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      customerId: true,
      customerName: true,
      locationId: true,
      address: true,
      postalCode: true,
      city: true,
    },
  });

const switchTo = (customerId: string, token = adminToken) =>
  request(app).patch(`/api/projects/${projectId}`).set(auth(token)).send({ customerId });

beforeAll(async () => {
  const org = await prisma.organization.findFirstOrThrow();
  orgId = org.id;

  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-a@opero.test`, passwordHash: pw, name: "A", role: "admin", status: "active" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });

  const a = await prisma.customer.create({
    data: { orgId, name: `${TAG} Alpha`, contactName: "CA", email: "", phone: "", address: "Alphaweg 1", postalCode: "1000 AA", city: "Amsterdam", type: "business" },
  });
  const b = await prisma.customer.create({
    data: { orgId, name: `${TAG} Beta`, contactName: "CB", email: "", phone: "", address: "Betaweg 2", postalCode: "2000 BB", city: "Rotterdam", type: "business" },
  });
  custA = a.id;
  custB = b.id;

  // A saved location owned by customer A — it must not survive a switch to B.
  locationA = (
    await prisma.location.create({
      data: { customerId: custA, label: "Site A", address: "Sitestraat 9", postalCode: "1111 AA", city: "Amsterdam" },
    })
  ).id;

  // One client login per customer, so we can prove the access actually moves.
  for (const [suffix, customerId] of [["ca", custA], ["cb", custB]] as const) {
    const u = await prisma.user.create({
      data: {
        orgId,
        email: `${TAG}-${suffix}@opero.test`,
        passwordHash: pw,
        name: suffix,
        role: "client",
        status: "active",
        customerId,
      },
    });
    const token = signAccessToken({ sub: u.id, role: "client", orgId });
    if (suffix === "ca") clientAToken = token;
    else clientBToken = token;
  }

  const created = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: custA, locationId: locationA, insulationType: "test" });
  projectId = created.body.id;

  const wo = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId, title: `${TAG} WO` });
  workOrderId = wo.body.id;
});

afterAll(async () => {
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("switching a project's customer", () => {
  it("moves the job out of the old customer's portal and into the new one's", async () => {
    // Before: A's login can see the werkbon, B's cannot.
    expect((await request(app).get(`/api/work-orders/${workOrderId}`).set(auth(clientAToken))).status).toBe(200);
    expect((await request(app).get(`/api/work-orders/${workOrderId}`).set(auth(clientBToken))).status).toBe(404);

    expect((await switchTo(custB)).status).toBe(200);

    // After: exactly reversed. THIS is the assertion the feature exists for.
    expect((await request(app).get(`/api/work-orders/${workOrderId}`).set(auth(clientAToken))).status).toBe(404);
    expect((await request(app).get(`/api/work-orders/${workOrderId}`).set(auth(clientBToken))).status).toBe(200);
  });

  it("rewrites the denormalized customerName", async () => {
    const p = await projectRow();
    expect(p.customerId).toBe(custB);
    expect(p.customerName).toBe(`${TAG} Beta`);
  });

  it("clears a location the new customer doesn't own", async () => {
    expect((await projectRow()).locationId).toBeNull();
  });

  it("leaves the job site address untouched", async () => {
    // The crew still goes to the same place — only the billing customer changed.
    const p = await projectRow();
    expect(p.address).toBe("Sitestraat 9");
    expect(p.postalCode).toBe("1111 AA");
    expect(p.city).toBe("Amsterdam");
  });

  it("keeps a location the new customer DOES own", async () => {
    const locB = await prisma.location.create({
      data: { customerId: custB, label: "Site B", address: "Bstraat 1", postalCode: "2222 BB", city: "Rotterdam" },
    });
    await prisma.project.update({ where: { id: projectId }, data: { locationId: locB.id } });

    // Switching to the customer who already owns the location is a no-op for it.
    expect((await switchTo(custB)).status).toBe(200);
    expect((await projectRow()).locationId).toBe(locB.id);

    await prisma.project.update({ where: { id: projectId }, data: { locationId: null } });
    await prisma.location.delete({ where: { id: locB.id } });
  });

  it("rejects a customer from another organization", async () => {
    const otherOrg = await prisma.organization.create({ data: { name: `${TAG}-otherorg` } });
    const foreign = await prisma.customer.create({
      data: { orgId: otherOrg.id, name: `${TAG} Foreign`, contactName: "", email: "", phone: "", address: "", postalCode: "", city: "", type: "business" },
    });

    expect((await switchTo(foreign.id)).status).toBe(404);
    // ...and nothing moved.
    expect((await projectRow()).customerId).toBe(custB);

    await prisma.customer.delete({ where: { id: foreign.id } });
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });

  it("is admin-only", async () => {
    // A client of the CURRENT customer still may not reassign the job.
    expect((await switchTo(custA, clientBToken)).status).toBe(403);
    expect((await projectRow()).customerId).toBe(custB);
  });
});

describe("renaming a customer", () => {
  it("keeps every project's denormalized copy in sync", async () => {
    // Regression: renaming used to leave projects (and reprinted PDFs) showing
    // the OLD name, because Project.customerName was never updated.
    const second = await request(app)
      .post("/api/projects")
      .set(auth(adminToken))
      .send({ customerId: custB, insulationType: "test" });
    const secondId = second.body.id as string;

    const res = await request(app)
      .patch(`/api/customers/${custB}`)
      .set(auth(adminToken))
      .send({ name: `${TAG} Beta Renamed` });
    expect(res.status).toBe(200);

    const projects = await prisma.project.findMany({
      where: { customerId: custB },
      select: { customerName: true },
    });
    expect(projects.length).toBeGreaterThanOrEqual(2);
    for (const p of projects) expect(p.customerName).toBe(`${TAG} Beta Renamed`);

    await prisma.project.deleteMany({ where: { id: secondId } });
  });
});
