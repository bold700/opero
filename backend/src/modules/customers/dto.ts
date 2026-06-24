import type { ContactPerson, Customer, Location } from "@prisma/client";

// DTO mappers — never return raw rows with internal columns to clients.

export function customerDto(c: Customer) {
  return {
    id: c.id,
    name: c.name,
    contactName: c.contactName,
    email: c.email,
    phone: c.phone,
    address: c.address,
    postalCode: c.postalCode,
    city: c.city,
    notes: c.notes ?? undefined,
  };
}

export function contactPersonDto(c: ContactPerson) {
  return {
    id: c.id,
    customerId: c.customerId,
    name: c.name,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    role: c.role ?? undefined,
  };
}

export function locationDto(l: Location) {
  return {
    id: l.id,
    customerId: l.customerId,
    label: l.label ?? undefined,
    address: l.address,
    postalCode: l.postalCode,
    city: l.city,
  };
}
