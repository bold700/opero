import { describe, expect, it } from "vitest";
import {
  isAllowedWebOrigin,
  normalizeTenantSlug,
  tenantAppUrl,
} from "./tenantDomains.js";

describe("tenant domains", () => {
  it("accepts an exact origin and a valid HTTPS customer subdomain", () => {
    expect(
      isAllowedWebOrigin("https://staging.example.com", ["https://staging.example.com"], "alpero.nl"),
    ).toBe(true);
    expect(
      isAllowedWebOrigin("https://wdbisolatie.alpero.nl", [], "alpero.nl"),
    ).toBe(true);
  });

  it("rejects insecure, nested, and lookalike tenant origins", () => {
    expect(isAllowedWebOrigin("http://wdbisolatie.alpero.nl", [], "alpero.nl")).toBe(false);
    expect(isAllowedWebOrigin("https://team.wdbisolatie.alpero.nl", [], "alpero.nl")).toBe(false);
    expect(isAllowedWebOrigin("https://wdbisolatie.alpero.nl.evil.test", [], "alpero.nl")).toBe(false);
  });

  it("builds customer email links only for valid slugs", () => {
    expect(tenantAppUrl("wdbisolatie", "alpero.nl")).toBe("https://wdbisolatie.alpero.nl");
    expect(normalizeTenantSlug("../../api")).toBeNull();
  });
});
