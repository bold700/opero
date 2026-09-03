import { api, type Page } from "../../lib/api/client";
import type { LinkedAccount } from "../users/api";

export type CustomerType = "business" | "private";

// Mirrors the backend customerListDto (backend/src/modules/customers/dto.ts).
export type Customer = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  type: CustomerType;
  workOrderCount: number;
  lastContact: string | null;
  kvkNumber?: string;
  vatNumber?: string;
  notes?: string;
  // The linked login account, if any (null = no portal login provisioned yet).
  account: LinkedAccount;
};

// Editable fields (the create/update schema). `name` is required; the rest
// default to empty. `type` is derived server-side from the name.
export type CustomerInput = {
  name: string;
  type?: CustomerType;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  notes?: string;
};

// Whole-set totals for the count pills. Always present even with a filter on.
export type CustomerCounts = { total: number; business: number; private: number };

// One page of the customers list plus the counts.
export type CustomerPage = Page<Customer> & { counts: CustomerCounts };

// Fetch one page. `filter` narrows by type server-side (undefined = all);
// `search` hits name/city/contactName/email server-side; `cursor` continues.
export function getCustomersPage(opts: {
  cursor?: string;
  search?: string;
  filter?: "business" | "private";
}): Promise<CustomerPage> {
  return api.getPage<Customer>("/customers", {
    cursor: opts.cursor,
    search: opts.search,
    params: { filter: opts.filter },
  }) as Promise<CustomerPage>;
}

// One customer, for the detail page. The detail DTO carries no list stats
// (workOrderCount/lastContact), so those come back as zero/null here.
export function getCustomer(id: string): Promise<Customer> {
  return api
    .get<Omit<Customer, "workOrderCount" | "lastContact">>(`/customers/${id}`)
    .then((c) => ({ workOrderCount: 0, lastContact: null, ...c }));
}

export function createCustomer(input: CustomerInput): Promise<Customer> {
  return api.post<Customer>("/customers", input);
}

export function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  return api.patch<Customer>(`/customers/${id}`, input);
}

export function deleteCustomer(id: string): Promise<void> {
  return api.delete<void>(`/customers/${id}`);
}

// --- Silvasoft Excel import ------------------------------------------------

export type ImportPreview = {
  willCreate: number;
  willUpdate: number;
  skipped: { row: number; reason: "no_name"; raw: string }[];
  unmappedColumns: string[];
  sample: {
    silvasoftId: string | null;
    name: string;
    city: string;
    email: string;
    type: "business" | "private";
  }[];
};

export type ImportResult = { created: number; updated: number; skipped: number };

// Dry run — reports what an import would do, writes nothing.
export function previewSilvasoftImport(file: File): Promise<ImportPreview> {
  return api.upload<ImportPreview>("/customers/import/preview", file);
}

// Commit — creates/updates customers from the same file.
export function commitSilvasoftImport(file: File): Promise<ImportResult> {
  return api.upload<ImportResult>("/customers/import/commit", file);
}

// --- Contact persons ------------------------------------------------------
// A customer's centrally managed contacts, reusable across projects.

export type ContactPerson = {
  id: string;
  customerId: string;
  // Display name ("firstName lastName"), what lists and werkbonnen show.
  name: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role?: string;
  notes?: string;
};

export type ContactPersonInput = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role?: string;
  notes?: string;
};

export function getContacts(customerId: string): Promise<ContactPerson[]> {
  return api.get<ContactPerson[]>(`/customers/${customerId}/contacts`);
}

export function createContact(
  customerId: string,
  input: ContactPersonInput,
): Promise<ContactPerson> {
  return api.post<ContactPerson>(`/customers/${customerId}/contacts`, input);
}

export function updateContact(
  customerId: string,
  contactId: string,
  input: Partial<ContactPersonInput>,
): Promise<ContactPerson> {
  return api.patch<ContactPerson>(`/customers/${customerId}/contacts/${contactId}`, input);
}

export function deleteContact(customerId: string, contactId: string): Promise<void> {
  return api.delete(`/customers/${customerId}/contacts/${contactId}`);
}
