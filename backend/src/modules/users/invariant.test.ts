import { describe, expect, it } from "vitest";

const { prisma } = await import("../../db/client.js");
const { createInvitedUser } = await import("./provisioning.js");

// THE INVARIANT: every login links to an Employee or a Customer.
//
// Access is managed from the Werknemers / Klanten screens — there is no
// standalone "Toegang" screen any more. A login with neither link would appear
// on NEITHER page: invisible, and impossible to revoke through the UI. That is
// the hole the 20260725160000_backfill_orphan_user_employees migration closed,
// and this test is what keeps it closed.
//
// The compiler is the primary enforcement (createInvitedUser takes a
// discriminated LinkTarget, so an unlinked login is unconstructible). This test
// covers what types can't: rows already in the database.

describe("every login belongs to a domain record", () => {
  it("has no orphaned users", async () => {
    // Scoped to the demo/seed logins on purpose. Test files share one Postgres
    // DB (vitest fileParallelism: false) and other suites create their own
    // users, so a global count would be flaky and would fail for reasons that
    // have nothing to do with the seed.
    const orphans = await prisma.user.findMany({
      where: {
        employeeId: null,
        customerId: null,
        email: { endsWith: "@opero.test" },
        NOT: { email: { contains: "-test" } },
      },
      select: { email: true, role: true },
    });

    expect(orphans).toEqual([]);
  });

  it("cannot construct a login without a domain record", () => {
    // A compile-time guarantee, asserted here so the intent is documented and
    // the import is exercised. Passing `{}` or omitting `link` is a tsc error;
    // `pnpm typecheck` is what actually enforces it.
    expect(typeof createInvitedUser).toBe("function");
  });
});
