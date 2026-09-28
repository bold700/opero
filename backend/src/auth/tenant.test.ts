import { describe, expect, it } from "vitest";
import { assertTenantAccess } from "./tenant.js";

describe("tenant access", () => {
  it("allows the canonical client without a tenant header", () => {
    expect(() => assertTenantAccess(undefined, "wdbisolatie")).not.toThrow();
  });

  it("allows the matching workspace and rejects another workspace", () => {
    expect(() => assertTenantAccess("wdbisolatie", "wdbisolatie")).not.toThrow();
    expect(() => assertTenantAccess("another-company", "wdbisolatie")).toThrow("Invalid workspace");
  });
});
