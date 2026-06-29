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

export const toggleRoleSchema = z.object({
  role: teamRoleSchema,
});
