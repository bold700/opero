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
    type: c.type,
    notes: c.notes ?? undefined,
  };
}

// The shape the customer LIST view needs: base fields + derived work-order count
// and last-contact date (design requires these columns).
type CustomerWithStats = Customer & {
  projects: { _count: { workOrders: number }; activity: { createdAt: Date }[] }[];
};

export function customerListDto(c: CustomerWithStats) {
  const workOrderCount = c.projects.reduce((sum, p) => sum + p._count.workOrders, 0);
  const lastContact = c.projects
    .map((p) => p.activity[0]?.createdAt)
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return {
    ...customerDto(c),
    workOrderCount,
    lastContact: lastContact ? lastContact.toISOString() : null,
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
