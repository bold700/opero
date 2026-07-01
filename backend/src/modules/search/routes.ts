import { Router } from "express";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../auth/middleware.js";
import { visibleProjectsWhere } from "../projects/visibility.js";

// Global search: GET /api/search?q=... — searches customers, projects and work
// orders the requesting user is allowed to see, and returns the top few of each.
//
// Permission is enforced by REUSING the same role-scoped `where` fragments the
// list endpoints use (org scope + visibleProjectsWhere + the customer role
// rule), so results can never leak across orgs or roles.
export const searchRouter = Router();

searchRouter.use(requireAuth);

const PER_GROUP = 5;
const MIN_LEN = 2;

type Hit = { id: string; label: string; sublabel?: string };
type SearchResults = { customers: Hit[]; projects: Hit[]; workOrders: Hit[] };

searchRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const q = String(req.query.q ?? "").trim();

    // Below the threshold → no DB work, empty result.
    if (q.length < MIN_LEN) {
      res.json({ customers: [], projects: [], workOrders: [] } satisfies SearchResults);
      return;
    }

    const ci = { contains: q, mode: "insensitive" as const };
    const orgScope = { orgId: user.orgId, deletedAt: null };
    const projectScope = visibleProjectsWhere(user); // role-aware

    // --- Customers: technicians have no customer access; clients only their own.
    const customersPromise =
      user.role === "technician"
        ? Promise.resolve([])
        : prisma.customer.findMany({
            where: {
              ...orgScope,
              ...(user.role === "client"
                ? { id: user.customerId ?? "__none__" }
                : {}),
              OR: [
                { name: ci },
                { city: ci },
                { contactName: ci },
                { email: ci },
              ],
            },
            orderBy: { name: "asc" },
            take: PER_GROUP,
            select: { id: true, name: true, city: true },
          });

    // --- Projects: org + role visibility.
    const projectsPromise = prisma.project.findMany({
      where: {
        ...orgScope,
        ...projectScope,
        OR: [
          { projectNumber: ci },
          { name: ci },
          { customerName: ci },
          { city: ci },
          { address: ci },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: PER_GROUP,
      select: { id: true, projectNumber: true, name: true, customerName: true, city: true },
    });

    // --- Work orders: scoped through their project's visibility.
    const workOrdersPromise = prisma.workOrder.findMany({
      where: {
        project: { is: { ...orgScope, ...projectScope } },
        OR: [
          { title: ci },
          { project: { is: { projectNumber: ci } } },
          { project: { is: { customerName: ci } } },
          { project: { is: { city: ci } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: PER_GROUP,
      select: {
        id: true,
        title: true,
        ordinal: true,
        project: { select: { projectNumber: true, customerName: true, city: true } },
      },
    });

    const [customers, projects, workOrders] = await Promise.all([
      customersPromise,
      projectsPromise,
      workOrdersPromise,
    ]);

    const result: SearchResults = {
      customers: customers.map((c) => ({
        id: c.id,
        label: c.name,
        sublabel: c.city || undefined,
      })),
      projects: projects.map((p) => ({
        id: p.id,
        label: [p.projectNumber, p.name].filter(Boolean).join(" · "),
        sublabel: [p.customerName, p.city].filter(Boolean).join(" · ") || undefined,
      })),
      workOrders: workOrders.map((w) => ({
        id: w.id,
        label: w.title || `#${w.ordinal + 1} · ${w.project.projectNumber}`,
        sublabel:
          [w.project.customerName, w.project.city].filter(Boolean).join(" · ") || undefined,
      })),
    };

    res.json(result);
  }),
);
