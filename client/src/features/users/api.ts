import { api, type Page } from "../../lib/api/client";
import type { UserRole } from "@opero/shared";

// Login-account lifecycle. Mirrors the backend users module
// (backend/src/modules/users/routes.ts). "Account" = a login (User), distinct
// from the domain record (Employee/Customer) it may link to.

export type AccountStatus = "invited" | "active" | "disabled";

export type UserAccount = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: AccountStatus;
  employeeId?: string;
  customerId?: string;
  createdAt: string;
  activatedAt?: string;
};

// The compact `account` shape embedded on employee/customer rows.
export type LinkedAccount = { userId: string; status: AccountStatus } | null;

// A login is always provisioned for an existing person. Employee → admin or
// technician; Customer → always client (role derived server-side).
export type InviteInput =
  | { kind: "employee"; employeeId: string; role: "admin" | "technician" }
  | { kind: "customer"; customerId: string };

// A person eligible for a login: has an email, no login yet.
export type InvitablePerson =
  | { kind: "employee"; id: string; name: string; email: string; roles: string[] }
  | { kind: "customer"; id: string; name: string; email: string; contactName: string };

// Fetch one page of the access list. `filter` narrows server-side by account
// status (undefined = all); `search` hits name/email; `cursor` continues the
// list. NO counts — the Users screen has status chips but no count pills.
export function getUsersPage(opts: {
  cursor?: string;
  search?: string;
  filter?: "active" | "invited" | "disabled";
}): Promise<Page<UserAccount>> {
  return api.getPage<UserAccount>("/users", {
    cursor: opts.cursor,
    search: opts.search,
    params: { filter: opts.filter },
  });
}

export function getInvitable(): Promise<InvitablePerson[]> {
  return api.get<InvitablePerson[]>("/users/invitable");
}

export function inviteUser(input: InviteInput): Promise<UserAccount> {
  return api.post<UserAccount>("/users/invite", input);
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
