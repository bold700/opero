import { PrismaClient, type TeamRole } from "@prisma/client";
import { hashPassword } from "../auth/service.js";

// Create an office login directly against a database, for environments where
// you can't invite one through the UI (a fresh deploy with no admin yet, or a
// staging box seeded without demo users).
//
// Deliberately NOT wired into package.json scripts: it writes a privileged
// account, so it should be an explicit, deliberate command — never something
// that runs as part of a routine task.
//
// THE INVARIANT: every login links to an Employee or a Customer (see seed.ts).
// A user with neither is invisible on Werknemers / Klanten — which means it
// can't be revoked through the UI either. So this creates the Employee record
// alongside, in one transaction.
//
// Usage:
//   DATABASE_URL="postgresql://..." \
//   corepack pnpm exec tsx src/db/create-office-user.ts \
//     --email office@example.com --password 'secret' [--name 'Office Demo'] [--org <orgId>]
//
// Idempotent: re-running with the same email updates the password and ensures
// the role/status/link are right, rather than failing on the unique constraint.

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const email = arg("--email")?.trim().toLowerCase();
const password = arg("--password");
const name = arg("--name") ?? "Office";
const orgArg = arg("--org");

if (!email || !password) {
  console.error(
    "Usage: tsx src/db/create-office-user.ts --email <email> --password <password> [--name <name>] [--org <orgId>]",
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  // Fail loudly on an ambiguous org rather than silently picking one — putting
  // the account in the wrong tenant would be invisible until someone logs in
  // and sees an empty app.
  let orgId = orgArg;
  if (!orgId) {
    const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
    if (orgs.length === 0) throw new Error("No organization exists; seed the database first.");
    if (orgs.length > 1) {
      throw new Error(
        `Multiple organizations — pass --org <id>:\n${orgs
          .map((o) => `  ${o.id}  ${o.name}`)
          .join("\n")}`,
      );
    }
    orgId = orgs[0].id;
  }

  const passwordHash = await hashPassword(password!);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email: email! },
      select: { id: true, orgId: true, employeeId: true },
    });

    // Re-run on an existing login: reset the password and make sure the role,
    // status and employee link are what this script promises.
    if (existing) {
      if (existing.orgId !== orgId) {
        throw new Error(
          `${email} already exists in a different organization (${existing.orgId}). ` +
            "Email is globally unique, so pick another address.",
        );
      }
      let employeeId = existing.employeeId;
      if (!employeeId) {
        const emp = await tx.employee.create({
          data: {
            orgId: orgId!,
            name,
            phone: "",
            email: email!,
            role: "Office" as TeamRole,
            status: "active",
          },
        });
        employeeId = emp.id;
      }
      const u = await tx.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: "office",
          roles: ["office"],
          status: "active",
          employeeId,
        },
        select: { id: true, email: true, role: true, status: true },
      });
      return { ...u, created: false };
    }

    // An employee record may already exist for this address (imported staff who
    // never got a login) — reuse it rather than creating a duplicate person.
    const employee =
      (await tx.employee.findFirst({
        where: { orgId, email: email!, deletedAt: null },
        select: { id: true },
      })) ??
      (await tx.employee.create({
        data: {
          orgId: orgId!,
          name,
          phone: "",
          email: email!,
          role: "Office" as TeamRole,
          status: "active",
        },
        select: { id: true },
      }));

    const u = await tx.user.create({
      data: {
        orgId: orgId!,
        email: email!,
        passwordHash,
        name,
        role: "office",
        roles: ["office"],
        status: "active",
        totpEnabled: false,
        employeeId: employee.id,
      },
      select: { id: true, email: true, role: true, status: true },
    });
    return { ...u, created: true };
  });

  console.log(
    `${result.created ? "Created" : "Updated"} ${result.role} login ${result.email} ` +
      `(${result.status}) in org ${orgId}`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
