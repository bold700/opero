/* eslint-disable no-console -- operator CLI reports its progress and failures */
import { PrismaClient } from "@prisma/client";
import { normalizeTenantSlug } from "../lib/tenantDomains.js";

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const requestedSlug = arg("--slug");
const requestedOrganizationId = arg("--org");
const reserved = new Set(["api", "admin", "app", "staging", "api-staging", "www"]);

if (!requestedSlug) {
  console.error("Usage: pnpm org:set-slug -- --slug <slug> [--org <organization-id>]");
  process.exit(1);
}

const slug = normalizeTenantSlug(requestedSlug);
if (!slug || reserved.has(slug)) {
  console.error("Slug must be a valid, non-reserved DNS label.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  let organizationId = requestedOrganizationId;
  if (!organizationId) {
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
    if (organizations.length !== 1) {
      throw new Error(
        `Expected one organization; pass --org explicitly:\n${organizations
          .map((organization) =>
            `  ${organization.id}  ${organization.name}  ${organization.slug ?? "(no slug)"}`,
          )
          .join("\n")}`,
      );
    }
    organizationId = organizations[0].id;
  }

  const organization = await prisma.organization.update({
    where: { id: organizationId },
    data: { slug },
    select: { id: true, name: true, slug: true },
  });
  console.log(`${organization.name} (${organization.id}) -> ${organization.slug}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
