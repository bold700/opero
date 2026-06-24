import { api } from "../../lib/api/client";

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
};

export function getCustomers(): Promise<Customer[]> {
  return api.get<Customer[]>("/customers");
}
