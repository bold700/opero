import { api } from "./client";
import type { NotificationsResponse } from "@opero/shared";

export type { NotificationItem, NotificationsResponse } from "@opero/shared";

// The derived, role-scoped, preference-gated notifications feed + unread count.
export function getNotifications(): Promise<NotificationsResponse> {
  return api.get<NotificationsResponse>("/notifications");
}

// Mark everything as seen (clears the unread badge).
export function markNotificationsSeen(): Promise<{ seenAt: string }> {
  return api.post<{ seenAt: string }>("/notifications/seen", {});
}
