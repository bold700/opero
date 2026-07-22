import { z } from "zod";

// Local zod schemas for the employees module. Kept here (not in shared) since
// these mirror the store actions addTeamMember/updateTeamMember/toggleTeamMemberRole.

// The TeamRole enum, expressed as zod string literals (matches schema.prisma).
export const teamRoleSchema = z.enum([
  "Sales",
  "WorkPlanner",
  "Planner",
  "Foreman",
  "Technician",
  "Administration",
  "ProjectLeader",
]);

export type TeamRoleValue = z.infer<typeof teamRoleSchema>;

export const createEmployeeSchema = z.object({
  name: z.string().min(1),
  phone: z.string().default(""),
  email: z.string().optional(),
  roles: z.array(teamRoleSchema).optional(),
  status: z.enum(["active", "on_leave", "inactive"]).optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

// --- Absence (vacation / sick / training) ----------------------------------

export const absenceKindSchema = z.enum(["vacation", "sick", "training", "other"]);

// Inclusive plain days. Kept as strings (not z.coerce.date()) on purpose: an
// absence is a human day off, not an instant, and the DB columns are text —
// see modules/employees/absence.ts.
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

export const createAbsenceSchema = z
  .object({
    employeeId: z.string().min(1),
    kind: absenceKindSchema.optional(),
    startDate: isoDay,
    endDate: isoDay,
    note: z.string().optional(),
  })
  // String compare is a correct day compare for this format.
  .refine((v) => v.startDate <= v.endDate, {
    message: "endDate must not be before startDate",
    path: ["endDate"],
  });

export const updateAbsenceSchema = z
  .object({
    kind: absenceKindSchema.optional(),
    startDate: isoDay.optional(),
    endDate: isoDay.optional(),
    note: z.string().nullable().optional(),
  })
  // Only checkable when both ends are supplied; the route re-checks against the
  // stored row for a partial patch.
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: "endDate must not be before startDate",
    path: ["endDate"],
  });

export const toggleRoleSchema = z.object({
  role: teamRoleSchema,
});
