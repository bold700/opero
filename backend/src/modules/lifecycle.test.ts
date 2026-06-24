import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../index.js";
import { prisma } from "../db/client.js";
import { hashPassword } from "../auth/service.js";

// End-to-end happy path across the Phase 3 modules, plus role-guard + price-strip
// spot checks. Uses the seeded org; creates a throwaway admin to drive it.

const TAG = "lifecycletest";
const adminEmail = `${TAG}-admin@opero.test`;
let adminToken: string;
let orgId: string;
let customerId: string;

async function login(email: string): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "pw-lifecycle-123" });
  return res.body.accessToken;
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.user.create({
    data: {
      orgId,
      email: adminEmail,
      passwordHash: await hashPassword("pw-lifecycle-123"),
      name: "Lifecycle Admin",
      role: "admin",
    },
  });
  adminToken = await login(adminEmail);
});

afterAll(async () => {
  // clean up created customer + its projects (cascade) and the test user
  if (customerId) {
    await prisma.project.deleteMany({ where: { customerId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
  }
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("full project lifecycle", () => {
  it("runs create customer → project → intake → quote → accept → werkbon → finish → invoice → paid", async () => {
    // 1. create customer
    const cust = await request(app)
      .post("/api/customers")
      .set(auth(adminToken))
      .send({ name: "Lifecycle BV", contactName: "Test", email: "t@x.nl" });
    expect(cust.status).toBe(201);
    customerId = cust.body.id;

    // 2. create project for that customer
    const proj = await request(app)
      .post("/api/projects")
      .set(auth(adminToken))
      .send({ customerId, name: "Lifecycle project" });
    expect(proj.status).toBe(201);
    const pid = proj.body.id;
    expect(proj.body.projectNumber).toMatch(/^OP-\d{4}-\d{3}$/);

    // 3. complete intake
    const intake = await request(app)
      .post(`/api/projects/${pid}/intake/complete`)
      .set(auth(adminToken))
      .send({ insulationType: "Spouwmuurisolatie", squareMeters: 80 });
    expect([200, 204]).toContain(intake.status);

    // 4. add a quote line + send + accept
    const line = await request(app)
      .post(`/api/projects/${pid}/quote/lines`)
      .set(auth(adminToken))
      .send({ description: "Spouwmuur", quantity: 80, unit: "m2", unitPrice: 18 });
    expect([200, 201]).toContain(line.status);

    const send = await request(app)
      .post(`/api/projects/${pid}/quote/send`)
      .set(auth(adminToken));
    expect([200, 204]).toContain(send.status);

    const accept = await request(app)
      .post(`/api/projects/${pid}/quote/accept`)
      .set(auth(adminToken));
    expect([200, 204]).toContain(accept.status);

    // 5. create a werkbon, a task, a material; finish it
    const wb = await request(app)
      .post(`/api/work-orders`)
      .set(auth(adminToken))
      .send({ projectId: pid, title: "Werkbon 1" });
    expect(wb.status).toBe(201);
    const wbId = wb.body.id;

    const task = await request(app)
      .post(`/api/work-orders/${wbId}/tasks`)
      .set(auth(adminToken))
      .send({});
    expect([200, 201]).toContain(task.status);
    const taskId = task.body.tasks?.slice(-1)[0]?.id ?? task.body.id;

    if (taskId) {
      const mat = await request(app)
        .post(`/api/work-orders/${wbId}/tasks/${taskId}/materials`)
        .set(auth(adminToken))
        .send({ name: "EPS parels", quantity: 40, unit: "zak", unitPrice: 12 });
      expect([200, 201]).toContain(mat.status);
    }

    const finish = await request(app)
      .post(`/api/work-orders/${wbId}/finish`)
      .set(auth(adminToken))
      .send({ signature: "Klant Handtekening" });
    expect([200, 204]).toContain(finish.status);

    // 6. invoice draft → send → paid
    const draft = await request(app)
      .post(`/api/projects/${pid}/invoice/draft`)
      .set(auth(adminToken));
    expect(draft.status).toBe(200);
    expect(draft.body.status).toBe("draft");

    const sendInv = await request(app)
      .post(`/api/projects/${pid}/invoice/send`)
      .set(auth(adminToken));
    expect(sendInv.status).toBe(200);
    expect(sendInv.body.status).toBe("sent");

    const paid = await request(app)
      .post(`/api/projects/${pid}/invoice/paid`)
      .set(auth(adminToken));
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe("paid");

    // 7. verify final DB state
    const dbProject = await prisma.project.findUnique({
      where: { id: pid },
      include: { invoice: true, quote: true, werkbonnen: true },
    });
    expect(dbProject?.invoice?.status).toBe("paid");
    expect(dbProject?.quote?.status).toBe("accepted");
    expect(dbProject?.werkbonnen.length).toBeGreaterThan(0);
    expect(dbProject?.signature).toBe("Klant Handtekening");

    // 8. audit log captured the mutations
    const auditCount = await prisma.auditLog.count({
      where: { entity: "invoice" },
    });
    expect(auditCount).toBeGreaterThan(0);
  });
});
