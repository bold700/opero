import type { ContactPerson, Customer, Location, User } from "@prisma/client";

// DTO mappers — never return raw rows with internal columns to clients.

// The login account (if any) linked to this customer, so the UI can show login
// status and offer invite/resend/disable.
type LinkedUser = Pick<User, "id" | "status">;

function accountDto(users: LinkedUser[] | undefined) {
  const u = users?.[0];
  return u ? { userId: u.id, status: u.status } : null;
}

export function customerDto(c: Customer & { users?: LinkedUser[] }) {
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
    kvkNumber: c.kvkNumber ?? undefined,
    vatNumber: c.vatNumber ?? undefined,
    notes: c.notes ?? undefined,
    account: accountDto(c.users),
  };
}

// The shape the customer LIST view needs: base fields + derived work-order count
// and last-contact date (design requires these columns).
type CustomerWithStats = Customer & {
  users?: LinkedUser[];
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
