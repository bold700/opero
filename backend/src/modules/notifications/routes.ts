import { Router } from "express";
import {
  categoryEnabled,
  canApproveAsOffice,
  isStaff,
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
import { assignedToEmployeeWhere } from "../work-orders/visibility.js";

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
          : { approvedByOffice: false, rejected: false }; // the office signs first

      // Only the office + the client act on extra-work approvals.
      if (canApproveAsOffice(user.role) || user.role === "client") {
        // Meerwerk is a flagged TaskMaterial line inside a zone now, so reach it
        // through task → workOrder → project.
        const extra = await prisma.taskMaterial.findMany({
          where: {
            ...awaitingWhere,
            isExtraWork: true,
            task: { is: { workOrder: { is: { project: { is: projectScopeWhere(user) } } } } },
          },
          orderBy: { createdAt: "desc" },
          take: NOTIFICATIONS_LIMIT,
          select: {
            id: true,
            label: true,
            name: true,
            createdAt: true,
            task: {
              select: {
                workOrder: {
                  select: {
                    id: true,
                    project: { select: { id: true, customerName: true } },
                  },
                },
              },
            },
          },
        });
        for (const e of extra) {
          const wo = e.task.workOrder;
          items.push({
            id: `extrawork:${e.id}`,
            category: "extraWorkApproval",
            messageKey:
              user.role === "client"
                ? "notifications.extraWorkAwaitingClient"
                : "notifications.extraWorkAwaitingOffice",
            params: {
              description: e.label?.trim() || e.name || "—",
              customer: wo.project.customerName,
            },
            createdAt: toIso(e.createdAt),
            route: wo.id ? `/work-orders/${wo.id}` : "/work-orders",
          });
        }
      }
    }

    // --- Urgent / blocked projects (staff, not clients) -------------------
    if (categoryEnabled("urgentOnSite", prefs) && isStaff(user.role)) {
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

    // --- Work orders newly assigned to field staff ------------------------
    // A foreman works along on the tools, so he can hold task assignments
    // exactly like a technician.
    if (
      categoryEnabled("newWorkOrder", prefs) &&
      (user.role === "technician" || user.role === "foreman")
    ) {
      const workOrders = await prisma.workOrder.findMany({
        // Assignment is at the WERKBON level (assignees, m:n) as well as the zone
        // level — this used to check only the zone arm, so a monteur dispatched
        // to the visit itself got no notification at all.
        //
        // AND, never a spread: assignedToEmployeeWhere returns a top-level OR,
        // and a sibling key carrying its own OR would silently overwrite it.
        // NOT visibleWorkOrdersWhere — that is org-wide ({}) for a foreman, who
        // also reaches this branch, and would notify him about everyone's work.
        where: {
          AND: [
            { project: { is: projectScopeWhere(user) } },
            assignedToEmployeeWhere(user.employeeId),
          ],
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
function toIso(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
