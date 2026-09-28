import type { NotificationPrefs } from "./schemas";

// The bell feed is DERIVED live from existing data (extra work awaiting approval,
// urgent/blocked projects, newly assigned work orders) rather than stored per
// user. Each item carries an i18n messageKey + params (English keys; the client
// renders NL/EN), a category (which maps to a notification preference toggle),
// and a route to act on it.

export type NotificationCategory =
  | "extraWorkApproval"
  | "urgentOnSite"
  | "newWorkOrder"
  | "progressLogged"
  | "progressReminder"
  | "controlReminder"
  | "mention";

export type NotificationItem = {
  // Stable-ish id, e.g. `extrawork:<id>` — used as the React key and to dedupe.
  id: string;
  category: NotificationCategory;
  // i18n key under the `notifications` namespace, e.g. "extraWorkAwaitingOffice".
  messageKey: string;
  params?: Record<string, unknown>;
  createdAt: string; // ISO — drives the unread comparison + relative time
  route: string; // where clicking navigates
};

export type NotificationsResponse = {
  items: NotificationItem[];
  unreadCount: number;
  seenAt: string | null;
};

// A category is shown only if its matching preference toggle is on. weeklySummary
// is an email-only digest, so it has no bell category.
const CATEGORY_TO_PREF: Partial<Record<NotificationCategory, keyof NotificationPrefs>> = {
  extraWorkApproval: "extraWorkApproval",
  urgentOnSite: "urgentOnSite",
  newWorkOrder: "newWorkOrder",
  progressLogged: "progressLogged",
  progressReminder: "progressReminder",
};

export function categoryEnabled(
  category: NotificationCategory,
  prefs: NotificationPrefs,
): boolean {
  const preference = CATEGORY_TO_PREF[category];
  return preference ? prefs[preference] === true : true;
}

// Cap the feed so the dropdown stays short and the queries stay cheap.
export const NOTIFICATIONS_LIMIT = 15;
