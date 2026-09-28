import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Use the local-disk storage adapter for the signature upload (no cloud creds).
vi.stubEnv("STORAGE_BUCKET", "");
vi.stubEnv("STORAGE_ENDPOINT", "");
vi.stubEnv("STORAGE_ACCESS_KEY", "");
vi.stubEnv("STORAGE_SECRET_KEY", "");

const { default: request } = await import("supertest");
const sharp = (await import("sharp")).default;
const { app } = await import("../index.js");
const { prisma } = await import("../db/client.js");
const { hashPassword } = await import("../auth/service.js");

// A small valid PNG buffer for the signature upload.
async function signaturePng(): Promise<Buffer> {
  return sharp({
    create: { width: 200, height: 80, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
  })
    .png()
    .toBuffer();
}

// End-to-end happy path across the Phase 3 modules, plus role-guard + price-strip
// spot checks. Uses the seeded org; creates a throwaway admin to drive it.

const TAG = "lifecycletest";
const adminEmail = `${TAG}-admin@opero.test`;
let adminToken: string;
let orgId: string;
let customerId: string;
let employeeId: string;

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
  const employee = await prisma.employee.create({
    data: {
      orgId,
      name: `${TAG}-technician`,
      phone: "",
      role: "Technician",
      status: "active",
    },
  });
  employeeId = employee.id;
});

afterAll(async () => {
  // clean up created customer + its projects (cascade) and the test user
  if (customerId) {
    await prisma.project.deleteMany({ where: { customerId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
  }
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { id: employeeId } });
  await prisma.$disconnect();
});

describe("full project lifecycle", () => {
  it("runs create customer → project → intake → werkbon → finish → invoice → paid", async () => {
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
    expect(proj.body.lifecycleStatus).toBe("new");

    // 3. complete intake
    const intake = await request(app)
      .post(`/api/projects/${pid}/intake/complete`)
      .set(auth(adminToken))
      .send({ insulationType: "Spouwmuurisolatie", squareMeters: 80 });
    expect([200, 204]).toContain(intake.status);

    // 4. create the WERKBON — it's the billable/schedulable unit. Its quote +
    // invoice are created with it (billing is per-werkbon).
    const wb = await request(app)
      .post(`/api/work-orders`)
      .set(auth(adminToken))
      .send({ projectId: pid, title: "Work order 1" });
    expect(wb.status).toBe(201);
    const wbId = wb.body.id;

    const preparation = await request(app)
      .get(`/api/projects/${pid}`)
      .set(auth(adminToken));
    expect(preparation.body.lifecycleStatus).toBe("work_preparation");

    const scheduled = await request(app)
      .patch(`/api/work-orders/${wbId}`)
      .set(auth(adminToken))
      .send({
        plannedDate: "2030-10-01",
        assigneeIds: [employeeId],
      });
    expect(scheduled.status).toBe(200);
    const scheduledProject = await request(app)
      .get(`/api/projects/${pid}`)
      .set(auth(adminToken));
    expect(scheduledProject.body.lifecycleStatus).toBe("scheduled");

    // 5. add a task + a material line — this drives the werkbon's quote value.
    const task = await request(app)
      .post(`/api/work-orders/${wbId}/tasks`)
      .set(auth(adminToken))
      .send({});
    expect([200, 201]).toContain(task.status);
    const taskId = task.body.tasks?.slice(-1)[0]?.id ?? task.body.id;

    if (taskId) {
      const started = await request(app)
        .post(`/api/work-orders/${wbId}/tasks/${taskId}/start`)
        .set(auth(adminToken));
      expect(started.status).toBe(200);

      const activeProject = await request(app)
        .get(`/api/projects/${pid}`)
        .set(auth(adminToken));
      expect(activeProject.body.lifecycleStatus).toBe("in_progress");

      const mat = await request(app)
        .post(`/api/work-orders/${wbId}/tasks/${taskId}/materials`)
        .set(auth(adminToken))
        .send({ name: "EPS parels", quantity: 40, unit: "zak", unitPrice: 12 });
      expect([200, 201]).toContain(mat.status);
    }

    const finish = await request(app)
      .post(`/api/work-orders/${wbId}/finish`)
      .set(auth(adminToken))
      .field("signedByName", "Klant Handtekening")
      .attach("file", await signaturePng(), "signature.png");
    expect([200, 204]).toContain(finish.status);

    const approve = await request(app)
      .post(`/api/work-orders/${wbId}/approve`)
      .set(auth(adminToken));
    expect(approve.status).toBe(200);

    const readyProject = await request(app)
      .get(`/api/projects/${pid}`)
      .set(auth(adminToken));
    expect(readyProject.body.lifecycleStatus).toBe("ready_to_invoice");

    // 6. invoice draft → send → paid — all on the WERKBON now.
    const draft = await request(app)
      .post(`/api/work-orders/${wbId}/invoice/draft`)
      .set(auth(adminToken));
    expect(draft.status).toBe(200);
    expect(draft.body.status).toBe("draft");

    const sendInv = await request(app)
      .post(`/api/work-orders/${wbId}/invoice/send`)
      .set(auth(adminToken));
    expect(sendInv.status).toBe(200);
    expect(sendInv.body.status).toBe("sent");

    const invoicedProject = await request(app)
      .get(`/api/projects/${pid}`)
      .set(auth(adminToken));
    expect(invoicedProject.body.lifecycleStatus).toBe("invoiced");

    const paid = await request(app)
      .post(`/api/work-orders/${wbId}/invoice/paid`)
      .set(auth(adminToken));
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe("paid");

    const completedProject = await request(app)
      .get(`/api/projects/${pid}`)
      .set(auth(adminToken));
    expect(completedProject.body.lifecycleStatus).toBe("completed");

    const archive = await request(app)
      .post(`/api/projects/${pid}/archive`)
      .set(auth(adminToken));
    expect(archive.status).toBe(200);
    expect(archive.body.lifecycleStatus).toBe("history");

    // 7. verify final DB state — quote/invoice live on the WERKBON.
    const dbWo = await prisma.workOrder.findUnique({
      where: { id: wbId },
      include: { invoice: true, quote: true },
    });
    expect(dbWo?.invoice?.status).toBe("paid");
    // The werkbon's value came from its task materials (40 × 12 = 480).
    expect(dbWo?.value).toBe(480);
    // Sign-off lives on the work order. `signature` holds the object key.
    expect(dbWo?.signature).toMatch(/\/wo-signature\/.*\.png$/);
    expect(dbWo?.signedByName).toBe("Klant Handtekening");
    expect(dbWo?.signedAt).not.toBeNull();

    // 8. audit log captured the mutations
    const auditCount = await prisma.auditLog.count({
      where: { entity: "invoice" },
    });
    expect(auditCount).toBeGreaterThan(0);
  });
});
