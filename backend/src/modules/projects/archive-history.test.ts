import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

const TAG = "project-archive-history";
let token: string;
let userId: string;
let customerId: string;
let projectId: string;

const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  const org = await prisma.organization.findFirstOrThrow();
  const user = await prisma.user.create({
    data: {
      orgId: org.id,
      email: `${TAG}@opero.test`,
      passwordHash: await hashPassword("test-password"),
      name: TAG,
      role: "admin",
      status: "active",
    },
  });
  userId = user.id;
  token = signAccessToken({ sub: user.id, role: "admin", orgId: org.id });

  const customer = await prisma.customer.create({
    data: {
      orgId: org.id,
      name: TAG,
      contactName: TAG,
      email: `${TAG}-customer@opero.test`,
      phone: "",
      address: "",
      postalCode: "",
      city: "",
    },
  });
  customerId = customer.id;

  const created = await request(app)
    .post("/api/projects")
    .set(auth())
    .send({ customerId, name: TAG });
  expect(created.status).toBe(201);
  projectId = created.body.id;
});

afterAll(async () => {
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.customer.deleteMany({ where: { id: customerId } });
  await prisma.auditLog.deleteMany({ where: { actorUserId: userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

async function listed(archived?: "active" | "archived" | "all") {
  const query = new URLSearchParams({ search: TAG });
  if (archived) query.set("archived", archived);
  return request(app).get(`/api/projects?${query}`).set(auth());
}

describe("project archive history", () => {
  it("moves a project out of the active list and into history", async () => {
    const activeBefore = await listed();
    expect(activeBefore.status).toBe(200);
    expect(activeBefore.body.items.some((project: { id: string }) => project.id === projectId)).toBe(true);

    const archived = await request(app)
      .post(`/api/projects/${projectId}/archive`)
      .set(auth())
      .send({});
    expect(archived.status).toBe(200);
    expect(archived.body.archived).toBe(true);

    const activeAfter = await listed();
    expect(activeAfter.body.items.some((project: { id: string }) => project.id === projectId)).toBe(false);

    const history = await listed("archived");
    expect(history.body.items.some((project: { id: string; archived: boolean }) =>
      project.id === projectId && project.archived,
    )).toBe(true);
  });

  it("restores a project to the active list", async () => {
    const restored = await request(app)
      .post(`/api/projects/${projectId}/restore`)
      .set(auth())
      .send({});
    expect(restored.status).toBe(200);
    expect(restored.body.archived).toBe(false);

    const active = await listed("active");
    expect(active.body.items.some((project: { id: string }) => project.id === projectId)).toBe(true);
  });

  it("refuses to archive a project with unfinished work orders", async () => {
    const workOrder = await request(app)
      .post("/api/work-orders")
      .set(auth())
      .send({ projectId });
    expect(workOrder.status).toBe(201);

    const active = await listed("active");
    const summary = active.body.items.find((project: { id: string }) => project.id === projectId);
    expect(summary.canArchive).toBe(false);

    const archived = await request(app)
      .post(`/api/projects/${projectId}/archive`)
      .set(auth())
      .send({});
    expect(archived.status).toBe(400);

    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(project.archived).toBe(false);
  });
});
