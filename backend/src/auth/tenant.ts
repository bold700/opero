import { Unauthorized } from "../lib/httpError.js";
import { tenantSlugFromHeader } from "../lib/tenantDomains.js";

export function assertTenantAccess(
  header: string | string[] | undefined,
  organizationSlug: string | null,
): void {
  if (header === undefined) return;

  const requestedSlug = tenantSlugFromHeader(header);
  if (!requestedSlug || requestedSlug !== organizationSlug) {
    // Keep the response generic: a workspace mismatch must not reveal which
    // organization owns an email address or active session.
    throw Unauthorized("Invalid workspace");
  }
}
