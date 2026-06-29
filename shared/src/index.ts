// @opero/shared — single source of truth for domain types, catalog/mock data,
// and pure domain logic shared by the client (Next.js) and backend (Express).
//
// No React, no DOM, no DB, no HTTP — pure types + data + functions only.

// Domain types + constants (projectStatusIds, projectTypes, labels, ...).
export * from "./types";

// Catalog (CatalogItem[] + CatalogCategory) and the demo/seed dataset.
export * from "./catalog";
export * from "./mock-data";

// Pure domain logic: lifecycle stages, workflow predicates, pricing/derivation.
export * from "./domain/stages";
export * from "./domain/workflow";
export * from "./domain/pricing";

// Request/response zod schemas (auth + domain) — added incrementally.
export * from "./schemas";

// Spec Roles & Permissions matrix (shared by API guards + web nav gating).
export * from "./permissions";

// Pre-job photo check + dispatch gate (checklist keys + completeness logic).
export * from "./prejob";
