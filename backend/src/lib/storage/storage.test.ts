import { afterAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalDiskStorage } from "./local.js";
import { buildObjectKey, normalizeExt, orgIdFromKey } from "./key.js";

const tmpRoot = path.join(os.tmpdir(), `opero-storage-test-${process.pid}`);

afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("buildObjectKey", () => {
  it("produces an org-scoped, scoped, unguessable key", () => {
    const key = buildObjectKey("org_123", "wo-task-before", "task_abc", "jpg");
    expect(key).toMatch(/^org_123\/wo-task-before\/task_abc\/[0-9a-f-]{36}\.jpg$/);
    expect(orgIdFromKey(key)).toBe("org_123");
  });

  it("normalizes jpeg→jpg and lowercases", () => {
    expect(normalizeExt(".JPEG")).toBe("jpg");
    expect(normalizeExt("PNG")).toBe("png");
  });

  it("rejects unsafe extensions", () => {
    expect(() => normalizeExt("exe")).toThrow();
    expect(() => normalizeExt("svg")).toThrow();
  });

  it("sanitizes id segments (no traversal)", () => {
    const key = buildObjectKey("org/../x", "survey", "../../etc", "png");
    // slashes/dots stripped → segments stay inside the layout
    expect(key.split("/").length).toBe(4);
    expect(key.startsWith("orgx/")).toBe(true);
  });
});

describe("LocalDiskStorage", () => {
  it("round-trips put → read → delete", async () => {
    const store = new LocalDiskStorage(tmpRoot, "http://localhost:8787");
    const key = buildObjectKey("org_1", "survey", "ent_1", "png");
    const bytes = Buffer.from("hello-bytes");

    await store.put(key, bytes, "image/png");
    expect(await store.read(key)).toEqual(bytes);
    expect(await store.url(key)).toBe(`http://localhost:8787/uploads/${key}`);

    await store.delete(key);
    await expect(store.read(key)).rejects.toThrow();
  });

  it("refuses paths that escape the root", async () => {
    const store = new LocalDiskStorage(tmpRoot, "http://localhost:8787");
    await expect(store.read("../../../etc/passwd")).rejects.toThrow(/escapes/);
  });
});
