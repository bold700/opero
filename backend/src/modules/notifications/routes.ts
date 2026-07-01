import { Router } from "express";
import {
  categoryEnabled,
  NOTIFICATIONS_LIMIT,
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationItem,
  type NotificationPrefs,
  type NotificationsResponse,
} from "@opero/shared";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../auth/middleware.js";
import { projectScopeWhere } from "../projects/visibility.js";

// Notifications bell. The feed is DERIVED live from existing data (not stored per
// user): extra work awaiting approval, urgent/blocked projects, newly assigned
// work orders — scoped by role (reusing projectScopeWhere) and gated by each
// user's notification preference toggles. A single User.notificationsSeenAt
// timestamp drives the unread badge count.
export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

function prefsOf(raw: unknown): NotificationPrefs {
  const p = ((raw ?? {}) as { notifications?: Partial<NotificationPrefs> }).notifications ?? {};
  return { ...DEFAULT_NOTIFICATION_PREFS, ...p };
}

// GET /notifications → { items, unreadCount, seenAt }
notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const prefs = prefsOf(user.preferences);

    // Read the user's last-seen marker fresh (req.user may be from a stale JWT).
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { notificationsSeenAt: true },
    });
    const seenAt = dbUser?.notificationsSeenAt ?? null;

    const items: NotificationItem[] = [];

    // --- Extra work awaiting approval -------------------------------------
    if (categoryEnabled("extraWorkApproval", prefs)) {
      // Which stage of approval is "yours" depends on role.
      const awaitingWhere =
        user.role === "client"
          ? { approvedByOffice: true, approvedByClient: false, rejected: false }
          : { approvedByOffice: false, rejected: false }; // admin (office)

      // Only admin + client act on extra-work approvals.
      if (user.role === "admin" || user.role === "client") {
        const extra = await prisma.extraWork.findMany({
          where: {
            ...awaitingWhere,
            project: { is: projectScopeWhere(user) },
          },
          orderBy: { id: "desc" },
          take: NOTIFICATIONS_LIMIT,
          select: {
            id: true,
            description: true,
            createdAt: true,
            project: {
              select: {
                id: true,
                customerName: true,
                workOrders: { select: { id: true }, take: 1, orderBy: { ordinal: "asc" } },
              },
            },
          },
        });
        for (const e of extra) {
          const woId = e.project.workOrders[0]?.id;
          items.push({
            id: `extrawork:${e.id}`,
            category: "extraWorkApproval",
            messageKey:
              user.role === "client"
                ? "notifications.extraWorkAwaitingClient"
                : "notifications.extraWorkAwaitingOffice",
            params: { description: e.description, customer: e.project.customerName },
            // ExtraWork.createdAt is a plain date string; normalize to ISO-ish.
            createdAt: toIso(e.createdAt),
            route: woId ? `/work-orders/${woId}` : "/work-orders",
          });
        }
      }
    }

    // --- Urgent / blocked projects (admin + technician) -------------------
    if (
      categoryEnabled("urgentOnSite", prefs) &&
      (user.role === "admin" || user.role === "technician")
    ) {
      const urgent = await prisma.project.findMany({
        where: {
          ...projectScopeWhere(user),
          urgency: { in: ["urgent", "blocked"] },
        },
        orderBy: { createdAt: "desc" },
        take: NOTIFICATIONS_LIMIT,
        select: {
          id: true,
          projectNumber: true,
          customerName: true,
          urgency: true,
          createdAt: true,
          workOrders: { select: { id: true }, take: 1, orderBy: { ordinal: "asc" } },
        },
      });
      for (const p of urgent) {
        const woId = p.workOrders[0]?.id;
        items.push({
          id: `urgent:${p.id}`,
          category: "urgentOnSite",
          messageKey:
            p.urgency === "blocked"
              ? "notifications.projectBlocked"
              : "notifications.projectUrgent",
          params: { number: p.projectNumber, customer: p.customerName },
          createdAt: p.createdAt.toISOString(),
          route: woId ? `/work-orders/${woId}` : "/work-orders",
        });
      }
    }

    // --- Work orders newly assigned to a technician -----------------------
    if (categoryEnabled("newWorkOrder", prefs) && user.role === "technician") {
      const employeeId = user.employeeId ?? "__none__";
      const workOrders = await prisma.workOrder.findMany({
        where: {
          project: { is: projectScopeWhere(user) },
          tasks: { some: { assigneeId: employeeId } },
        },
        orderBy: { createdAt: "desc" },
        take: NOTIFICATIONS_LIMIT,
        select: {
          id: true,
          title: true,
          ordinal: true,
          createdAt: true,
          project: { select: { projectNumber: true, customerName: true } },
        },
      });
      for (const w of workOrders) {
        items.push({
          id: `newwo:${w.id}`,
          category: "newWorkOrder",
          messageKey: "notifications.newWorkOrderAssigned",
          params: {
            title: w.title || `#${w.ordinal + 1}`,
            number: w.project.projectNumber,
            customer: w.project.customerName,
          },
          createdAt: w.createdAt.toISOString(),
          route: `/work-orders/${w.id}`,
        });
      }
    }

    // Most recent first, capped.
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const capped = items.slice(0, NOTIFICATIONS_LIMIT);

    const seenMs = seenAt ? seenAt.getTime() : 0;
    const unreadCount = capped.filter((i) => new Date(i.createdAt).getTime() > seenMs).length;

    const response: NotificationsResponse = {
      items: capped,
      unreadCount,
      seenAt: seenAt ? seenAt.toISOString() : null,
    };
    res.json(response);
  }),
);

// POST /notifications/seen → mark everything as seen (clears the badge).
notificationsRouter.post(
  "/seen",
  asyncHandler(async (req, res) => {
    const now = new Date();
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { notificationsSeenAt: now },
    });
    res.json({ seenAt: now.toISOString() });
  }),
);

// ExtraWork.createdAt is stored as a date string (e.g. "2026-06-28"). Coerce to
// a comparable ISO timestamp; fall back to now on anything unparseable.
function toIso(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
