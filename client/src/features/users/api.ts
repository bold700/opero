import { api } from "../../lib/api/client";
import type { UserRole } from "@opero/shared";

// Login-account lifecycle. Mirrors the backend users module
// (backend/src/modules/users/routes.ts). "Account" = a login (User), distinct
// from the domain record (Employee/Customer) it links to.
//
// There is no page for this module: access is managed from the Werknemers /
// Klanten screens, which import these calls and the components alongside them.

export type AccountStatus = "invited" | "active" | "disabled";

export type UserAccount = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roles: UserRole[];
  status: AccountStatus;
  employeeId?: string;
  customerId?: string;
  createdAt: string;
  activatedAt?: string;
};

// The `account` shape embedded on employee/customer rows. Carries everything
// the account panel shows, since access is managed from Werknemers / Klanten.
export type LinkedAccount = {
  userId: string;
  email: string;
  role: UserRole;
  roles: UserRole[];
  status: AccountStatus;
  activatedAt?: string;
} | null;

// A login is always provisioned for an existing person. Employee → any staff
// role (admin/office/foreman/technician); Customer → always client (role
// derived server-side). Mirrors inviteUserSchema in shared/src/schemas.ts.
export type InviteInput =
  | { kind: "employee"; employeeId: string; role: "admin" | "office" | "foreman" | "technician" }
  | { kind: "customer"; customerId: string };

export function inviteUser(input: InviteInput): Promise<UserAccount> {
  return api.post<UserAccount>("/users/invite", input);
}

// Change an existing login's ACCESS LEVEL. `client` is absent on purpose: it
// pairs structurally with a Customer record, so it's not a level you move to.
export type StaffRole = "admin" | "office" | "foreman" | "technician";

export function updateUserRoles(id: string, roles: StaffRole[]): Promise<UserAccount> {
  return api.patch<UserAccount>(`/users/${id}`, { roles });
}

export function resendInvite(id: string): Promise<void> {
  return api.post<void>(`/users/${id}/resend-invite`);
}

export function disableUser(id: string): Promise<UserAccount> {
  return api.post<UserAccount>(`/users/${id}/disable`);
}

export function enableUser(id: string): Promise<UserAccount> {
  return api.post<UserAccount>(`/users/${id}/enable`);
}
