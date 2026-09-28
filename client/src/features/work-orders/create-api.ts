import { api } from "../../lib/api/client";

// API calls used by the "Nieuwe werkbon" create flow: list customers, a
// customer's locations + projects; create project + work order. (Work type and
// technician are set per task in the detail screen, not here.)

export type CustomerOption = { id: string; name: string };
export type LocationOption = {
  id: string;
  label?: string;
  address: string;
  postalCode: string;
  city: string;
};

type ProjectSummary = {
  id: string;
  projectNumber: string;
  name?: string;
  customerId: string;
};

export type ProjectOption = {
  id: string;
  projectNumber: string;
  name?: string;
};

export type ContactPersonOption = {
  id: string;
  customerId: string;
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

export type DuplicateContact = {
  contact: ContactPersonOption;
  customer: { id: string; name: string };
  matchedFields: ("email" | "phone")[];
};

// Customer picker for the werkbon-create flow. The /customers endpoint is
// cursor-paginated; drain all pages so the dropdown has the full in-scope set.
export function getCustomers(): Promise<CustomerOption[]> {
  return api.getAll<CustomerOption>("/customers");
}

// A customer's saved job-site locations.
export function getCustomerLocations(
  customerId: string,
): Promise<LocationOption[]> {
  return api.get<LocationOption[]>(`/customers/${customerId}/locations`);
}

// Add a new saved location to a customer (admin). Returns the created row.
export function createCustomerLocation(
  customerId: string,
  input: { label?: string; address: string; postalCode: string; city: string },
): Promise<LocationOption> {
  return api.post<LocationOption>(`/customers/${customerId}/locations`, input);
}

export function getCustomerContacts(customerId: string): Promise<ContactPersonOption[]> {
  return api.get<ContactPersonOption[]>(`/customers/${customerId}/contacts`);
}

export function checkDuplicateContact(
  customerId: string,
  input: Pick<ContactPersonInput, "email" | "phone">,
): Promise<DuplicateContact | null> {
  return api
    .post<{ duplicate: DuplicateContact | null }>(
      `/customers/${customerId}/contacts/check-duplicate`,
      input,
    )
    .then((result) => result.duplicate);
}

export function createCustomerContact(
  customerId: string,
  input: ContactPersonInput,
): Promise<ContactPersonOption> {
  return api.post<ContactPersonOption>(`/customers/${customerId}/contacts`, input);
}

export function linkCustomerContact(
  customerId: string,
  contactId: string,
): Promise<ContactPersonOption> {
  return api.post<ContactPersonOption>(
    `/customers/${customerId}/contacts/${contactId}/link`,
    {},
  );
}

export function getProjectContacts(
  projectId: string,
): Promise<{ id: string }[]> {
  return api
    .get<{ contacts: { id: string }[] }>(`/projects/${projectId}`)
    .then((project) => project.contacts);
}

// The projects endpoint is cursor-paginated; drain all pages (this is a picker
// data source that needs the full in-scope set), then filter to the customer.
export async function getProjectsForCustomer(
  customerId: string,
): Promise<ProjectOption[]> {
  const all = await api.getAll<ProjectSummary>("/projects");
  return all
    .filter((p) => p.customerId === customerId)
    .map((p) => ({ id: p.id, projectNumber: p.projectNumber, name: p.name }));
}

export function createProject(input: {
  customerId: string;
  name: string;
  /** The client's own order/PO number. Omitted when blank. */
  referenceNumber?: string;
  locationId?: string;
  contactIds?: string[];
}): Promise<{ id: string }> {
  return api.post<{ id: string }>("/projects", input);
}

// Blank title/description are omitted rather than sent as "": the werkbon then
// falls back to its translated "Werkbon N" label and to the project's
// description on the printed sheet.
export function createWorkOrder(
  projectId: string,
  options: { contactPersonIds: string[]; title?: string; description?: string },
): Promise<{ id: string }> {
  return api.post<{ id: string }>("/work-orders", {
    projectId,
    contactPersonIds: options.contactPersonIds,
    ...(options.title ? { title: options.title } : {}),
    ...(options.description ? { description: options.description } : {}),
  });
}
