import { z } from "zod";

// Shared request/response zod schemas, consumed by both the backend (validation)
// and the client (form/typing). Domain-module schemas are added in Phase 3.

// --- Auth (Phase 2) -------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginSchema>;

export const login2faSchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().min(6).max(10),
});
export type Login2faRequest = z.infer<typeof login2faSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export type RefreshRequest = z.infer<typeof refreshSchema>;

export const logoutSchema = z.object({ refreshToken: z.string().min(1) });
export type LogoutRequest = z.infer<typeof logoutSchema>;

export const forgotPasswordSchema = z.object({ email: z.string().email() });
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;

export const enable2faSchema = z.object({ code: z.string().min(6).max(10) });
export type Enable2faRequest = z.infer<typeof enable2faSchema>;

export const disable2faSchema = z.object({ password: z.string().min(1) });
export type Disable2faRequest = z.infer<typeof disable2faSchema>;

// User DTO returned by /auth endpoints (mirrors backend AuthUser).
export const userRoleSchema = z.enum(["admin", "technician", "client"]);
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
