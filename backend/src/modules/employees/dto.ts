import type { Employee } from "@prisma/client";

// DTO mapper — never return raw rows with internal columns to clients.

export function employeeDto(e: Employee) {
  return {
    id: e.id,
    name: e.name,
    phone: e.phone,
    email: e.email ?? undefined,
    roles: e.roles,
  };
}
