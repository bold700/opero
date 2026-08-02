import { z } from "zod";

// Shared request/response zod schemas, consumed by both the backend (validation)
// and the client (form/typing). Domain-module schemas are added in Phase 3.

// --- Auth (Phase 2) -------------------------------------------------------

// The login identity. Addresses are stored lowercased, so every schema that
// carries one normalizes here rather than at each call site — a `findUnique`
// on a raw address silently misses the row when the user capitalizes it (the
// column is plain text with a byte-exact unique index). Trim first: mobile
// keyboards routinely append a space, and both auto-capitalize the first
// letter. Domains are case-insensitive by RFC 5321 and every mail provider
// treats the local part that way too, so folding the whole address is safe.
const emailIdentity = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().email());

export const loginSchema = z.object({
  email: emailIdentity,
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginSchema>;

// PATCH /auth/profile — the logged-in user edits their own profile. Email is NOT
// here: it's the login identity and changes only via the verified email-change
// flow (request → confirm link on the new address) below.
export const updateProfileSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;

// POST /auth/email-change/request — start a verified change of the login email.
// Requires re-auth (current password); a confirmation link is sent to newEmail
// and the email only switches when that link is confirmed.
export const requestEmailChangeSchema = z.object({
  newEmail: emailIdentity,
  currentPassword: z.string().min(1),
});
export type RequestEmailChangeRequest = z.infer<typeof requestEmailChangeSchema>;

// POST /auth/email-change/confirm — apply the change using the emailed token.
export const confirmEmailChangeSchema = z.object({ token: z.string().min(1) });
export type ConfirmEmailChangeRequest = z.infer<typeof confirmEmailChangeSchema>;

// Per-user notification toggles.
export const notificationPrefsSchema = z.object({
  newWorkOrder: z.boolean(),
  urgentOnSite: z.boolean(),
  extraWorkApproval: z.boolean(),
  weeklySummary: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

// The full per-user preferences object (what the user DTO always returns).
export type UserPreferences = {
  language: "nl" | "en";
  notifications: NotificationPrefs;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  newWorkOrder: true,
  urgentOnSite: true,
  extraWorkApproval: true,
  weeklySummary: false,
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  language: "nl",
  notifications: DEFAULT_NOTIFICATION_PREFS,
};

// PATCH /auth/preferences — the logged-in user updates their own prefs (partial).
export const updatePreferencesSchema = z.object({
  language: z.enum(["nl", "en"]).optional(),
  notifications: notificationPrefsSchema.partial().optional(),
});
export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesSchema>;

// PATCH /organization — admin edits company details + the hide-prices flag.
export const updateOrganizationSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().or(z.literal("")).optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  vatNumber: z.string().optional(),
  // Letterhead details for customer-facing documents (quote PDF).
  iban: z.string().optional(),
  bic: z.string().optional(),
  kvkNumber: z.string().optional(),
  website: z.string().optional(),
});
export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationSchema>;

export const login2faSchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().min(6).max(10),
});
export type Login2faRequest = z.infer<typeof login2faSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export type RefreshRequest = z.infer<typeof refreshSchema>;

export const logoutSchema = z.object({ refreshToken: z.string().min(1) });
export type LogoutRequest = z.infer<typeof logoutSchema>;

export const forgotPasswordSchema = z.object({ email: emailIdentity });
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;

// PATCH-style change of a logged-in user's own password. `refreshToken` lets the
// server re-issue the CURRENT session after revoking all others (no self-logout).
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  refreshToken: z.string().min(1).optional(),
});
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

// POST /users/invite — an admin provisions a login for an EXISTING person and
// sends them an activation (invite) email. A login is always tied to a person
// record: admin/technician logins are Employees, client logins are Customers.
// There is no free-typed email — the email + name come from the linked record.
// The account is created `invited` and can't log in until they set a password.
export const inviteUserSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("employee"),
    employeeId: z.string().min(1),
    // The owner (admin), office staff (office) or field staff (foreman,
    // technician) — all of them are Employees.
    role: z.enum(["admin", "office", "foreman", "technician"]),
  }),
  z.object({
    kind: z.literal("customer"),
    customerId: z.string().min(1),
    // A customer login is always the client role.
  }),
]);
export type InviteUserRequest = z.infer<typeof inviteUserSchema>;

// Change an existing login's ACCESS LEVEL (not the Employee's job title — see
// TeamRole, which grants nothing). Without this an account's role was fixed at
// invite time forever: employee-create auto-invites as `technician`, so every
// employee given an email became a permanently un-promotable technician.
//
// `client` is deliberately absent. It isn't a level you move to or from — it
// pairs structurally with `customerId`, and a client login carrying an
// `employeeId` would break the one-record-per-login invariant.
export const updateUserRoleSchema = z.object({
  role: z.enum(["admin", "office", "foreman", "technician"]),
});
export type UpdateUserRoleRequest = z.infer<typeof updateUserRoleSchema>;

export const enable2faSchema = z.object({ code: z.string().min(6).max(10) });
export type Enable2faRequest = z.infer<typeof enable2faSchema>;

export const disable2faSchema = z.object({ password: z.string().min(1) });
export type Disable2faRequest = z.infer<typeof disable2faSchema>;

// User DTO returned by /auth endpoints (mirrors backend AuthUser).
export const userRoleSchema = z.enum(["admin", "office", "foreman", "technician", "client"]);
export type UserRoleDto = z.infer<typeof userRoleSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  email: z.string(),
  name: z.string(),
  role: userRoleSchema,
  customerId: z.string().nullable(),
  employeeId: z.string().nullable(),
  totpEnabled: z.boolean(),
});
export type AuthUserDto = z.infer<typeof authUserSchema>;

// --- Customers (Phase 3) --------------------------------------------------

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  // Optional: when omitted, the server derives it from the name. When supplied,
  // the user's choice wins.
  type: z.enum(["business", "private"]).optional(),
  contactName: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  address: z.string().default(""),
  postalCode: z.string().default(""),
  city: z.string().default(""),
  notes: z.string().optional(),
});
export type CreateCustomerRequest = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial();
export type UpdateCustomerRequest = z.infer<typeof updateCustomerSchema>;

export const contactPersonSchema = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
});
export type ContactPersonRequest = z.infer<typeof contactPersonSchema>;

export const locationSchema = z.object({
  label: z.string().optional(),
  address: z.string().min(1),
  postalCode: z.string().default(""),
  city: z.string().default(""),
});
export type LocationRequest = z.infer<typeof locationSchema>;

// --- Pre-job checklist items (admin-configurable, per org) ----------------

export const createPrejobItemSchema = z.object({
  label: z.string().min(1),
});
export type CreatePrejobItemRequest = z.infer<typeof createPrejobItemSchema>;

export const updatePrejobItemSchema = z.object({
  label: z.string().min(1).optional(),
  active: z.boolean().optional(),
});
export type UpdatePrejobItemRequest = z.infer<typeof updatePrejobItemSchema>;

export const reorderPrejobItemsSchema = z.object({
  orderedIds: z.array(z.string().min(1)),
});
export type ReorderPrejobItemsRequest = z.infer<typeof reorderPrejobItemsSchema>;

// --- Per-werkbon pre-job checklist items (admin, on the werkbon) ----------

export const addWorkOrderPrejobItemSchema = z.object({
  label: z.string().min(1),
});
export type AddWorkOrderPrejobItemRequest = z.infer<typeof addWorkOrderPrejobItemSchema>;

export const updateWorkOrderPrejobItemSchema = z.object({
  done: z.boolean().optional(),
  label: z.string().min(1).optional(),
});
export type UpdateWorkOrderPrejobItemRequest = z.infer<typeof updateWorkOrderPrejobItemSchema>;
