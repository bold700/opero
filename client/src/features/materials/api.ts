import { api } from "../../lib/api/client";

export type StockStatus = "ok" | "low" | "out_of_stock";

// Mirrors the backend materialListDto (backend/src/modules/materials/dto.ts).
export type MaterialRow = {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  supplier: string;
  status: StockStatus;
};

export function getMaterials(): Promise<MaterialRow[]> {
  return api.get<MaterialRow[]>("/materials");
}
