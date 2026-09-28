/* eslint-disable no-console -- operator CLI reports its progress and failures */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { storage } from "../lib/storage/index.js";

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const sourceArgument = arg("--source");
const dryRun = process.argv.includes("--dry-run");
const strict = process.argv.includes("--strict");

if (!sourceArgument) {
  console.error(
    "Usage: pnpm storage:import -- --source <opero-files-directory> [--dry-run] [--strict]",
  );
  process.exit(1);
}

const source = path.resolve(sourceArgument);
const prisma = new PrismaClient();

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map(async (entry) => {
        const fullPath = path.join(directory, entry.name);
        return entry.isDirectory() ? filesBelow(fullPath) : [fullPath];
      }),
  );
  return nested.flat();
}

async function main() {
  const sourceStats = await stat(source);
  if (!sourceStats.isDirectory()) throw new Error("Source must be a directory.");
  if (storage.kind !== "s3" && !dryRun) {
    throw new Error("Configure all STORAGE_* variables before importing files.");
  }

  const organizationIds = new Set(
    (await prisma.organization.findMany({ select: { id: true } })).map(({ id }) => id),
  );
  const files = await filesBelow(source);
  if (files.length === 0) throw new Error("No files found below the source directory.");

  const candidates = files.map((file) => ({
    file,
    key: path.relative(source, file).split(path.sep).join("/"),
  }));
  const unknown = candidates.filter(
    ({ key }) => !organizationIds.has(key.split("/")[0]),
  );
  if (strict && unknown.length > 0) {
    throw new Error(
      `${unknown.length} files belong to organizations absent from the restored database.`,
    );
  }
  if (unknown.length > 0) {
    const prefixes = [...new Set(unknown.map(({ key }) => key.split("/")[0]))];
    console.warn(
      `Skipping ${unknown.length} orphaned files across ${prefixes.length} unknown organization prefixes.`,
    );
  }
  const importable = candidates.filter(
    ({ key }) => organizationIds.has(key.split("/")[0]),
  );
  if (importable.length === 0) {
    throw new Error("No files belong to an organization in the restored database.");
  }

  let imported = 0;
  for (const { file, key } of importable) {
    const contentType = CONTENT_TYPES[path.extname(file).toLowerCase()];
    if (!contentType) throw new Error(`Unsupported file type: ${key}`);

    if (!dryRun) await storage.put(key, await readFile(file), contentType);
    imported += 1;
    if (imported % 50 === 0 || imported === importable.length) {
      console.log(`${dryRun ? "Validated" : "Imported"} ${imported}/${importable.length}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
