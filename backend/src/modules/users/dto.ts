import type { User } from "@prisma/client";

// The login account (if any) linked to a domain record — shared by the employee
// and customer DTOs so both screens describe an account the same way.
//
// Access is managed from Werknemers / Klanten (there is no standalone Toegang
// screen), so this carries everything those panels show: status, the role the
// login grants, the address the invite went to, and when it was activated.

export const accountSelect = {
  id: true,
  email: true,
  role: true,
  roles: true,
  status: true,
  activatedAt: true,
} as const;

type LinkedUser = Pick<User, "id" | "email" | "role" | "roles" | "status" | "activatedAt">;

// A domain record has AT MOST one login. The relation is one-to-many in Prisma
// (the FK lives on User) and the invite routes reject a second, so taking the
// first is correct — but only if the query is ordered. Every `users:` include
// pairs this with `orderBy: { createdAt: "asc" }`.
export function accountDto(users: LinkedUser[] | undefined) {
  const u = users?.[0];
  return u
    ? {
        userId: u.id,
        email: u.email,
        role: u.role,
        roles: u.roles.length > 0 ? u.roles : [u.role],
        status: u.status,
        activatedAt: u.activatedAt ? u.activatedAt.toISOString() : undefined,
      }
    : null;
}

// The include fragment for a record's login. Ordered so `users[0]` is stable.
export const accountInclude = {
  select: accountSelect,
  orderBy: { createdAt: "asc" },
} as const;
