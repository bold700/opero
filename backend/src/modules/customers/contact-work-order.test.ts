import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

const TAG = "contact-work-order-test";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let adminToken: string;
let customerAId: string;
let customerBId: string;
let projectAId: string;
let projectBId: string;
let contactAId: string;
let contactA2Id: string;
let contactBId: string;

beforeAll(async () => {
  const org = await prisma.organization.findFirstOrThrow();
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.project.deleteMany({
    where: { customer: { name: { startsWith: TAG } } },
  });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });

  const admin = await prisma.user.create({
    data: {
      orgId: org.id,
      email: `${TAG}-admin@opero.test`,
      passwordHash: await hashPassword("x"),
      name: "Contact flow admin",
      role: "admin",
      status: "active",
    },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId: org.id });

  const [customerA, customerB] = await Promise.all([
    prisma.customer.create({
      data: {
        orgId: org.id,
        name: `${TAG} Alpha`,
        contactName: "",
        email: "",
        phone: "",
        address: "Alphaweg 1",
        postalCode: "1000 AA",
        city: "Amsterdam",
      },
    }),
    prisma.customer.create({
      data: {
        orgId: org.id,
        name: `${TAG} Beta`,
        contactName: "",
        email: "",
        phone: "",
        address: "Betaweg 2",
        postalCode: "2000 BB",
        city: "Rotterdam",
      },
    }),
  ]);
  customerAId = customerA.id;
  customerBId = customerB.id;

  const project = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customerAId, name: `${TAG} Project` });
  expect(project.status).toBe(201);
  projectAId = project.body.id;

  const projectB = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customerBId, name: `${TAG} Project B` });
  expect(projectB.status).toBe(201);
  projectBId = projectB.body.id;

  const contactA = await request(app)
    .post(`/api/customers/${customerAId}/contacts`)
    .set(auth(adminToken))
    .send({
      firstName: "Alex",
      lastName: "Jansen",
      email: `${TAG}@example.com`,
      phone: "06 91029384",
      role: "Site contact",
    });
  expect(contactA.status).toBe(201);
  contactAId = contactA.body.id;

  const contactA2 = await request(app)
    .post(`/api/customers/${customerAId}/contacts`)
    .set(auth(adminToken))
    .send({ phone: "06 22223333" });
  expect(contactA2.status).toBe(201);
  expect(contactA2.body.name).toBe("");
  expect(contactA2.body.email).toBeUndefined();
  contactA2Id = contactA2.body.id;

  const contactB = await request(app)
    .post(`/api/customers/${customerBId}/contacts`)
    .set(auth(adminToken))
    .send({
      firstName: "Bea",
      lastName: "Bakker",
      email: `${TAG}-bea@example.com`,
      phone: "06 87654321",
    });
  expect(contactB.status).toBe(201);
  contactBId = contactB.body.id;
});

afterAll(async () => {
  await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } });
  await prisma.customer.deleteMany({ where: { id: { in: [customerAId, customerBId] } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("contact people in the work-order creation flow", () => {
  it("finds an existing contact by a case-insensitive email address", async () => {
    const response = await request(app)
      .post(`/api/customers/${customerBId}/contacts/check-duplicate`)
      .set(auth(adminToken))
      .send({ email: `${TAG.toUpperCase()}@EXAMPLE.COM` });

    expect(response.status).toBe(200);
    expect(response.body.duplicate.contact.id).toBe(contactAId);
    expect(response.body.duplicate.customer.id).toBe(customerAId);
    expect(response.body.duplicate.matchedFields).toContain("email");
  });

  it("finds a Dutch phone number even when it uses another format", async () => {
    const response = await request(app)
      .post(`/api/customers/${customerBId}/contacts/check-duplicate`)
      .set(auth(adminToken))
      .send({ phone: "+31 6 91029384" });

    expect(response.status).toBe(200);
    expect(response.body.duplicate.contact.id).toBe(contactAId);
    expect(response.body.duplicate.matchedFields).toContain("phone");
  });

  it("blocks direct API creation of a duplicate contact", async () => {
    const response = await request(app)
      .post(`/api/customers/${customerBId}/contacts`)
      .set(auth(adminToken))
      .send({ name: "Duplicate", email: `${TAG.toUpperCase()}@example.com` });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONTACT_DUPLICATE");
  });

  it("allows a contact to keep their own email address while editing", async () => {
    const response = await request(app)
      .patch(`/api/customers/${customerAId}/contacts/${contactAId}`)
      .set(auth(adminToken))
      .send({ email: `${TAG}@example.com`, role: "Updated site contact" });

    expect(response.status).toBe(200);
    expect(response.body.role).toBe("Updated site contact");
  });

  it("stores multiple selected contacts on a work order and links them to the project", async () => {
    const response = await request(app)
      .post("/api/work-orders")
      .set(auth(adminToken))
      .send({
        projectId: projectAId,
        contactPersonIds: [contactAId, contactA2Id],
        title: "Contact test",
      });

    expect(response.status).toBe(201);
    expect(response.body.contactPersons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: contactAId, name: "Alex Jansen" }),
        expect.objectContaining({ id: contactA2Id, phone: "06 22223333" }),
      ]),
    );

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectAId },
      select: { contacts: { select: { id: true } } },
    });
    expect(project.contacts.map((contact) => contact.id)).toEqual(
      expect.arrayContaining([contactAId, contactA2Id]),
    );

    const cleared = await request(app)
      .patch(`/api/work-orders/${response.body.id}`)
      .set(auth(adminToken))
      .send({ contactPersonIds: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body.contactPersons).toEqual([]);
  });

  it("rejects a contact belonging to another customer", async () => {
    const response = await request(app)
      .post("/api/work-orders")
      .set(auth(adminToken))
      .send({ projectId: projectAId, contactPersonIds: [contactAId, contactBId] });

    expect(response.status).toBe(400);
  });

  it("links one contact to multiple customers without copying it", async () => {
    const linked = await request(app)
      .post(`/api/customers/${customerBId}/contacts/${contactAId}/link`)
      .set(auth(adminToken))
      .send({});
    expect(linked.status).toBe(200);
    expect(linked.body.id).toBe(contactAId);

    const customerContacts = await request(app)
      .get(`/api/customers/${customerBId}/contacts`)
      .set(auth(adminToken));
    expect(customerContacts.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: contactAId })]),
    );

    const workOrder = await request(app)
      .post("/api/work-orders")
      .set(auth(adminToken))
      .send({ projectId: projectBId, contactPersonIds: [contactAId] });
    expect(workOrder.status).toBe(201);
    expect(workOrder.body.contactPersons).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: contactAId })]),
    );
    expect(workOrder.body.customer.contactPersons).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: contactAId })]),
    );

    const overview = await request(app)
      .get(`/api/customers/contacts?search=${TAG}`)
      .set(auth(adminToken));
    const contact = overview.body.items.find((item: { id: string }) => item.id === contactAId);
    expect(contact.customers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: customerAId }),
        expect.objectContaining({ id: customerBId }),
      ]),
    );
  });

  it("unlinks a shared contact from one customer without deleting it", async () => {
    const removed = await request(app)
      .delete(`/api/customers/${customerBId}/contacts/${contactAId}`)
      .set(auth(adminToken));
    expect(removed.status).toBe(204);
    expect(await prisma.contactPerson.findUnique({ where: { id: contactAId } })).not.toBeNull();

    const customerContacts = await request(app)
      .get(`/api/customers/${customerBId}/contacts`)
      .set(auth(adminToken));
    expect(customerContacts.body.some((contact: { id: string }) => contact.id === contactAId)).toBe(false);
  });

  it("lists all contacts with their customer and linked projects", async () => {
    const response = await request(app)
      .get(`/api/customers/contacts?search=${TAG}`)
      .set(auth(adminToken));

    expect(response.status).toBe(200);
    const contact = response.body.items.find(
      (item: { id: string }) => item.id === contactAId,
    );
    expect(contact.customer).toMatchObject({ id: customerAId });
    expect(contact.projects).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: projectAId })]),
    );
  });
});
