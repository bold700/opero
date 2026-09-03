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
      // Urgency is per-werkbon; blocked derives from the blocker columns. A
      // project surfaces here when it is blocked OR has an unfinished urgent
      // werkbon.
      const urgent = await prisma.project.findMany({
        where: projectScopeWhere(user, {
          OR: [
            { blocker: { not: null } },
            { blockerKey: { not: null } },
            { workOrders: { some: { urgency: "urgent", signedAt: null } } },
          ],
        }),
        orderBy: { createdAt: "desc" },
        take: NOTIFICATIONS_LIMIT,
        select: {
          id: true,
          projectNumber: true,
          customerName: true,
          blocker: true,
          blockerKey: true,
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
            p.blocker || p.blockerKey
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

    // --- Progress logged by field staff (office) --------------------------
    // Derived from the activity feed: every progress log writes a
    // material.progressLogged activity row (work-orders routes).
    if (categoryEnabled("progressLogged", prefs) && canApproveAsOffice(user.role)) {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const logged = await prisma.projectActivity.findMany({
        where: {
          messageKey: "material.progressLogged",
          createdAt: { gte: since },
          project: { is: projectScopeWhere(user) },
        },
        orderBy: { createdAt: "desc" },
        take: NOTIFICATIONS_LIMIT,
        select: {
          id: true,
          params: true,
          createdAt: true,
          projectId: true,
          user: { select: { name: true } },
        },
      });
      for (const a of logged) {
        const p = (a.params ?? {}) as Record<string, unknown>;
        items.push({
          id: `progress:${a.id}`,
          category: "progressLogged",
          messageKey: "notifications.progressLogged",
          params: {
            user: a.user?.name ?? "—",
            name: p.name ?? "—",
            amount: p.amount ?? 0,
            unit: p.unit ?? "",
            total: p.total ?? 0,
            target: p.target ?? 0,
          },
          createdAt: a.createdAt.toISOString(),
          route: `/projects/${a.projectId}`,
        });
      }
    }

    // --- "Don't forget to log" reminder (field staff) ---------------------
    // A dispatched, unsigned werkbon assigned to me whose planned window
    // includes (or has passed) today, where I logged NOTHING today. Derived at
    // poll time — no cron needed; the timestamp is pinned to today's morning
    // so marking the bell seen silences it until tomorrow.
    if (
      categoryEnabled("progressReminder", prefs) &&
      (user.role === "technician" || user.role === "foreman") &&
      user.employeeId
    ) {
      const today = new Date().toISOString().slice(0, 10);
      const candidates = await prisma.workOrder.findMany({
        where: {
          AND: [
            { project: { is: projectScopeWhere(user) } },
            assignedToEmployeeWhere(user.employeeId),
            { dispatchedAt: { not: null } },
            { signedAt: null },
            { plannedDate: { lte: today } },
          ],
        },
        take: NOTIFICATIONS_LIMIT,
        select: {
          id: true,
          title: true,
          ordinal: true,
          project: { select: { projectNumber: true, customerName: true } },
        },
      });
      if (candidates.length > 0) {
        const loggedToday = await prisma.taskProgressEntry.findMany({
          where: { employeeId: user.employeeId, day: today },
          select: { material: { select: { task: { select: { workOrderId: true } } } } },
        });
        const loggedWoIds = new Set(loggedToday.map((e) => e.material.task.workOrderId));
        for (const w of candidates) {
          if (loggedWoIds.has(w.id)) continue;
          items.push({
            id: `logreminder:${w.id}:${today}`,
            category: "progressReminder",
            messageKey: "notifications.progressReminder",
            params: {
              title: w.title || `#${w.ordinal + 1}`,
              number: w.project.projectNumber,
              customer: w.project.customerName,
            },
            createdAt: `${today}T06:00:00.000Z`,
            route: `/work-orders/${w.id}`,
          });
        }
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
