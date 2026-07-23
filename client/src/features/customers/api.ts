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
