import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Materials catalog (read-only): class grouping, detail, flat variant search,
// suppliers, price stripping for technicians, client 403, org scoping.

const TAG = "matcatalog-test";
let orgId: string;
let otherOrgId: string;
let adminToken: string;
let technicianToken: string;
let foremanToken: string;
let clientToken: string;
let materialId: string;
let otherOrgMaterialId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function createMaterial(org: string, suffix: string) {
  return prisma.material.create({
    data: {
      orgId: org,
      key: `${TAG}_material_${suffix}`,
      name: `${TAG} material ${suffix}`,
      class: "insulation",
      supplier: `${TAG}-supplier`,
      pipeMaterial: "steel",
      thicknessMm: 19,
      finish: "none",
      sizeUnit: "pipe_od_mm",
      priceSource: `${TAG}-source`,
      ordinal: 998,
      variants: {
        create: [
          { size: "17", component: "meter", unit: "m", unitPrice: 30.13, ordinal: 0 },
          { size: "17", component: "coupling", unit: "piece", unitPrice: 20.11, ordinal: 1 },
          { size: "60", component: "elbow", unit: "piece", unitPrice: 28.25, ordinal: 2 },
        ],
      },
    },
  });
}

beforeAll(async () => {
  const org = await prisma.organization.findFirstOrThrow();
  orgId = org.id;
  const otherOrg = await prisma.organization.create({ data: { name: `${TAG}-other-org` } });
  otherOrgId = otherOrg.id;

  await prisma.material.deleteMany({ where: { key: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-a@opero.test`, passwordHash: pw, name: "A", role: "admin", status: "active" },
  });
  const technician = await prisma.user.create({
    data: { orgId, email: `${TAG}-t@opero.test`, passwordHash: pw, name: "T", role: "technician", status: "active" },
  });
  const foreman = await prisma.user.create({
    data: { orgId, email: `${TAG}-f@opero.test`, passwordHash: pw, name: "F", role: "foreman", status: "active" },
  });
  const client = await prisma.user.create({
    data: { orgId, email: `${TAG}-c@opero.test`, passwordHash: pw, name: "C", role: "client", status: "active" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });
  technicianToken = signAccessToken({ sub: technician.id, role: "technician", orgId });
  foremanToken = signAccessToken({ sub: foreman.id, role: "foreman", orgId });
  clientToken = signAccessToken({ sub: client.id, role: "client", orgId });

  materialId = (await createMaterial(orgId, "own")).id;
  otherOrgMaterialId = (await createMaterial(otherOrgId, "other")).id;
});

afterAll(async () => {
  await prisma.material.deleteMany({ where: { key: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("materials catalog — grouped list", () => {
  it("groups materials by class with summaries (count + size range)", async () => {
    const res = await request(app).get("/api/materials").set(auth(adminToken));
    expect(res.status).toBe(200);
    const groups = res.body as {
      class: string;
      materials: { id: string; name: string; supplier: string; variantCount: number; sizeRange?: { min: number; max: number } }[];
    }[];
    // Class order starts with insulation; our TAG material is in it.
    const insulation = groups.find((g) => g.class === "insulation");
    expect(insulation).toBeDefined();
    const own = insulation!.materials.find((m) => m.id === materialId);
    expect(own).toBeDefined();
    expect(own!.variantCount).toBe(3);
    expect(own!.sizeRange).toEqual({ min: 17, max: 60 });
    expect(own!.supplier).toBe(`${TAG}-supplier`);
    // Other org's material never appears.
    const all = groups.flatMap((g) => g.materials.map((m) => m.id));
    expect(all).not.toContain(otherOrgMaterialId);
  });

  it("allows technicians to browse, forbids clients", async () => {
    const tech = await request(app).get("/api/materials").set(auth(technicianToken));
    expect(tech.status).toBe(200);
    const client = await request(app).get("/api/materials").set(auth(clientToken));
    expect(client.status).toBe(403);
  });
});

describe("materials catalog — detail", () => {
  it("returns variants with prices + provenance for admins", async () => {
    const res = await request(app)
      .get(`/api/materials/${materialId}`)
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.class).toBe("insulation");
    expect(res.body.priceSource).toBe(`${TAG}-source`);
    const variants = res.body.variants as { size: string; component: string; unitPrice?: number }[];
    expect(variants).toHaveLength(3);
    const meter17 = variants.find((v) => v.size === "17" && v.component === "meter");
    expect(meter17?.unitPrice).toBe(30.13);
  });

  it("strips unitPrice for technicians; hides other orgs' materials (404)", async () => {
    const tech = await request(app)
      .get(`/api/materials/${materialId}`)
      .set(auth(technicianToken));
    expect(tech.status).toBe(200);
    for (const v of tech.body.variants as { unitPrice?: number }[]) {
      expect(v.unitPrice).toBeUndefined();
    }
    const crossOrg = await request(app)
      .get(`/api/materials/${otherOrgMaterialId}`)
      .set(auth(adminToken));
    expect(crossOrg.status).toBe(404);
  });

  // The foreman is field staff too — canSeePrices is false for him. He has no
  // materials nav entry, but /materials/:id is reachable by direct URL (the
  // client route guard only matches exact NAV_ITEMS paths), so the server strip
  // is what actually protects this. The client drops the price COLUMN on top.
  it("strips unitPrice for foremen", async () => {
    const res = await request(app)
      .get(`/api/materials/${materialId}`)
      .set(auth(foremanToken));
    expect(res.status).toBe(200);
    expect(res.body.variants.length).toBeGreaterThan(0);
    for (const v of res.body.variants as { unitPrice?: number; costPrice?: number }[]) {
      expect(v.unitPrice).toBeUndefined();
      expect(v.costPrice).toBeUndefined();
    }
  });
});

describe("materials catalog — flat variant search", () => {
  it("matches component words (Dutch) AND sizes", async () => {
    const res = await request(app)
      .get(`/api/materials/variants?search=${encodeURIComponent(`${TAG} bocht 60`)}&limit=50`)
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    const items = res.body.items as { size: string; component: string; name: string; unitPrice?: number }[];
    expect(items).toHaveLength(1);
    expect(items[0].component).toBe("elbow");
    expect(items[0].size).toBe("60");
    expect(items[0].name).toContain("Bocht");
    expect(items[0].unitPrice).toBe(28.25);
  });

  it("supplier filter scopes rows; suppliers endpoint lists the org's suppliers", async () => {
    const res = await request(app)
      .get(`/api/materials/variants?supplier=${encodeURIComponent(`${TAG}-supplier`)}&limit=50`)
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect((res.body.items as unknown[]).length).toBe(3);

    const suppliers = await request(app).get("/api/materials/suppliers").set(auth(adminToken));
    expect(suppliers.status).toBe(200);
    expect(suppliers.body as string[]).toContain(`${TAG}-supplier`);
  });
});
