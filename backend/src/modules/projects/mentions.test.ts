import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../index.js";
import { prisma } from "../../db/client.js";
import { hashPassword } from "../../auth/service.js";

const TAG = "mentiontest";
const password = "pw-mention-123";
const authorEmail = `${TAG}-author@opero.test`;
const recipientEmail = `${TAG}-recipient@opero.test`;

let orgId: string;
let customerId: string;
let projectId: string;
let workOrderId: string;
let recipientId: string;
let authorToken: string;
let recipientToken: string;

async function login(email: string): Promise<string> {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  return response.body.accessToken;
}

beforeAll(async () => {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("seed org required");
  orgId = org.id;

  const customer = await prisma.customer.create({
    data: {
      orgId,
      name: `${TAG} Customer`,
      contactName: "",
      email: "",
      phone: "",
      address: "",
      postalCode: "",
      city: "",
    },
  });
  customerId = customer.id;

  const project = await prisma.project.create({
    data: {
      orgId,
      customerId,
      customerName: customer.name,
      projectNumber: `${TAG}-P1`,
      address: "",
      postalCode: "",
      city: "",
      insulationType: "",
      nextStepKey: "sendQuote",
    },
  });
  projectId = project.id;

  const workOrder = await prisma.workOrder.create({
    data: { projectId, title: `${TAG} Work order`, drawings: [] },
  });
  workOrderId = workOrder.id;

  const passwordHash = await hashPassword(password);
  const author = await prisma.user.create({
    data: {
      orgId,
      email: authorEmail,
      name: "Mention Author",
      passwordHash,
      role: "admin",
    },
  });
  const recipient = await prisma.user.create({
    data: {
      orgId,
      email: recipientEmail,
      name: "Mention Recipient",
      passwordHash,
      role: "office",
      notificationsSeenAt: null,
    },
  });
  recipientId = recipient.id;
  authorToken = await login(author.email);
  recipientToken = await login(recipient.email);
});

afterAll(async () => {
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.customer.deleteMany({ where: { id: customerId } });
  await prisma.user.deleteMany({ where: { email: { in: [authorEmail, recipientEmail] } } });
});

describe("work-order note mentions", () => {
  it("lists stable mention candidates and notifies the selected account", async () => {
    const candidates = await request(app)
      .get(`/api/projects/${projectId}/mentionable-users`)
      .set("authorization", `Bearer ${authorToken}`);
    expect(candidates.status).toBe(200);
    expect(candidates.body).toContainEqual({
      id: recipientId,
      name: "Mention Recipient",
      email: recipientEmail,
    });

    const note = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .set("authorization", `Bearer ${authorToken}`)
      .send({
        body: "@Mention Recipient wil jij dit controleren?",
        mentionUserIds: [recipientId],
        workOrderId,
      });
    expect(note.status).toBe(201);
    expect(note.body[0].params).toMatchObject({
      workOrderId,
      mentionUserIds: [recipientId],
      mentions: [{ userId: recipientId, name: "Mention Recipient" }],
    });

    const notifications = await request(app)
      .get("/api/notifications")
      .set("authorization", `Bearer ${recipientToken}`);
    expect(notifications.status).toBe(200);
    expect(notifications.body.items).toContainEqual(
      expect.objectContaining({
        category: "mention",
        messageKey: "notifications.mentionedInNote",
        route: `/work-orders/${workOrderId}`,
      }),
    );
  });
});
