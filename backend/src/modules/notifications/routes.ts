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

function previousWorkday(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  do {
    date.setUTCDate(date.getUTCDate() - 1);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
}

function amsterdamDateTime(day: string, time: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, date, hour, minute);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(guess));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const localAtGuess = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
  );
  return new Date(guess - (localAtGuess - guess));
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

    // --- Timed work-order controls ---------------------------------------
    // A configured control becomes visible in the bell at its chosen time on
    // the workday before the visit. It remains until somebody completes it.
    if (
      (user.role === "technician" || user.role === "foreman") &&
      user.employeeId
    ) {
      const controls = await prisma.workOrderPrejobItem.findMany({
        where: {
          done: false,
          reminderEnabled: true,
          reminderTime: { not: null },
          workOrder: {
            is: {
              AND: [
                { signedAt: null },
                { plannedDate: { not: null } },
                { project: { is: { orgId: user.orgId, deletedAt: null, archived: false } } },
                {
                  OR: [
                    assignedToEmployeeWhere(user.employeeId),
                    { project: { is: { projectLeaderId: user.employeeId } } },
                  ],
                },
              ],
            },
          },
        },
        orderBy: { workOrder: { plannedDate: "asc" } },
        take: 100,
        select: {
          id: true,
          label: true,
          reminderTime: true,
          workOrder: {
            select: {
              id: true,
              title: true,
              ordinal: true,
              plannedDate: true,
              project: { select: { projectNumber: true, customerName: true } },
            },
          },
        },
      });
      const now = new Date();
      for (const control of controls) {
        const workOrder = control.workOrder;
        if (!control.reminderTime || !workOrder.plannedDate) continue;
        const reminderAt = amsterdamDateTime(
          previousWorkday(workOrder.plannedDate),
          control.reminderTime,
        );
        if (reminderAt > now) continue;
        items.push({
          id: `control:${control.id}`,
          category: "controlReminder",
          messageKey: "notifications.controlReminder",
          params: {
            control: control.label,
            title: workOrder.title || `#${workOrder.ordinal + 1}`,
            customer: workOrder.project.customerName,
            time: control.reminderTime,
          },
          createdAt: reminderAt.toISOString(),
          route: `/work-orders/${workOrder.id}`,
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

    // --- Material shortages after a completed work day (office) ----------
    // The latest closed day per work order is compared with the unfinished
    // task quantities. Material left on site is deducted, producing a concrete
    // packing suggestion for the next visit without a scheduled background job.
    if (canApproveAsOffice(user.role)) {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const closedDays = await prisma.workDay.findMany({
        where: {
          status: "completed",
          completedAt: { gte: since },
          workOrder: {
            is: {
              signedAt: null,
              project: { is: projectScopeWhere(user) },
            },
          },
        },
        orderBy: { completedAt: "desc" },
        take: 50,
        select: {
          id: true,
          completedAt: true,
          workOrder: {
            select: {
              id: true,
              title: true,
              ordinal: true,
              project: { select: { projectNumber: true, customerName: true } },
            },
          },
          entries: {
            where: { taskMaterialId: { not: null } },
            select: {
              leftOnSite: true,
              taskMaterial: {
                select: {
                  id: true,
                  label: true,
                  name: true,
                  unit: true,
                  quantity: true,
                  done: true,
                  requirementDone: true,
                  progressEntries: { select: { amount: true } },
                },
              },
            },
          },
        },
      });
      const handledWorkOrders = new Set<string>();
      for (const day of closedDays) {
        const workOrder = day.workOrder;
        if (handledWorkOrders.has(workOrder.id)) continue;
        handledWorkOrders.add(workOrder.id);
        const shortages = day.entries.flatMap((entry) => {
          const material = entry.taskMaterial;
          if (!material || material.done || material.requirementDone) return [];
          const installed = material.progressEntries.reduce((sum, item) => sum + item.amount, 0);
          const shortage = Math.max(0, material.quantity - installed - entry.leftOnSite);
          return shortage > 0.01
            ? [`${shortage} ${material.unit} ${material.label?.trim() || material.name}`]
            : [];
        });
        if (shortages.length === 0) continue;
        items.push({
          id: `material-shortage:${day.id}`,
          category: "materialShortage",
          messageKey: "notifications.materialShortage",
          params: {
            title: workOrder.title || `#${workOrder.ordinal + 1}`,
            number: workOrder.project.projectNumber,
            customer: workOrder.project.customerName,
            items: shortages.slice(0, 3).join(", "),
            extra: Math.max(0, shortages.length - 3),
          },
          createdAt: (day.completedAt ?? new Date()).toISOString(),
          route: `/work-orders/${workOrder.id}`,
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

    // --- Direct @mentions in notes ---------------------------------------
    // Mentions are stored on the comment activity row as stable user IDs.
    // Query the JSON array directly so each recipient sees only notes that
    // explicitly selected their account, even when names are duplicated.
    const mentionedNotes = await prisma.projectActivity.findMany({
      where: {
        type: "comment",
        params: { path: ["mentionUserIds"], array_contains: [user.id] },
        project: { is: projectScopeWhere(user) },
      },
      orderBy: { createdAt: "desc" },
      take: NOTIFICATIONS_LIMIT,
      select: {
        id: true,
        body: true,
        params: true,
        createdAt: true,
        projectId: true,
        user: { select: { name: true } },
      },
    });
    for (const note of mentionedNotes) {
      const params = (note.params ?? {}) as Record<string, unknown>;
      const workOrderId =
        typeof params.workOrderId === "string" ? params.workOrderId : undefined;
      const text = note.body?.trim() ?? "";
      items.push({
        id: `mention:${note.id}`,
        category: "mention",
        messageKey: "notifications.mentionedInNote",
        params: {
          author: note.user?.name ?? "—",
          text: text.length > 90 ? `${text.slice(0, 87)}…` : text,
        },
        createdAt: note.createdAt.toISOString(),
        route: workOrderId ? `/work-orders/${workOrderId}` : `/projects/${note.projectId}`,
      });
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
