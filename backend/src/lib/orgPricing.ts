import type { UserRole } from "@opero/shared";
import { prisma } from "../db/client.js";

// Resolve the org's "hide prices from technicians" privacy flag for a request.
//
// The flag only changes what TECHNICIANS see — admins and clients always see
// prices — so we skip the DB read entirely for non-technician roles and return
// the conservative default (true = hide) only when it could matter.
//
// Pass the result as the third argument to canSeePrices(role, hidePrices) in
// the DTO mappers.
export async function resolveHidePrices(
  role: UserRole,
  orgId: string,
): Promise<boolean> {
  if (role !== "technician") return true; // value is irrelevant for these roles
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { hidePricesFromTechnicians: true },
  });
  // Default to hiding when the org is somehow missing — fail closed on privacy.
  return org?.hidePricesFromTechnicians ?? true;
}
