import { z } from "zod";

// Local zod schemas for the planning module (not shared). Mirror the store's
// planning actions (schedulePlanningSlot / scheduleProjectOnDay /
// setProjectDurationDays / unscheduleProject / markProjectPlanned). All text is
// clamped in the handlers, so these keep validation light.

const viewSchema = z.enum(["day", "week", "month"]);

// GET / — calendar feed query. `view` is informational (the store has no view
// state); `from`/`to` are inclusive ISO date strings (YYYY-MM-DD).
export const calendarQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  view: viewSchema.optional(),
});
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

// GET /route — route overview for a single day.
export const routeQuerySchema = z.object({
  date: z.string().optional(),
});
export type RouteQuery = z.infer<typeof routeQuerySchema>;

// POST /projects/:projectId/planning — schedule a slot. Mirror the union of
// schedulePlanningSlot(date, teamLeaderId) and scheduleProjectOnDay(date):
// `date` is required; teamLeaderId/startTime/endTime/vehicle are optional.
export const schedulePlanningSchema = z.object({
  date: z.string().min(1),
  teamLeaderId: z.string().nullable().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  vehicle: z.string().optional(),
});
export type SchedulePlanningInput = z.infer<typeof schedulePlanningSchema>;

// PATCH /projects/:projectId/planning/duration — setProjectDurationDays.
export const durationSchema = z.object({
  days: z.number(),
});
export type DurationInput = z.infer<typeof durationSchema>;
