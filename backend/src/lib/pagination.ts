import type { Request } from "express";

// Cursor-based pagination for list endpoints. Every list returns a bounded page
// plus a `nextCursor` the client sends back to fetch the following page. Cursor
// (not offset) because lists are sorted by createdAt desc and rows are inserted
// constantly — offset paging double-shows/skips rows under inserts; cursors don't.

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export type PageParams = {
  limit: number;
  // Opaque cursor = the id of the last row from the previous page. Undefined on
  // the first page.
  cursor?: string;
  // Free-text search term (already trimmed). Empty string = no search.
  search: string;
};

// Read ?limit / ?cursor / ?search off the request, clamped to safe bounds.
export function parsePageParams(req: Request): PageParams {
  const rawLimit = Number(req.query.limit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const cursorRaw = req.query.cursor;
  const cursor =
    typeof cursorRaw === "string" && cursorRaw.length > 0 ? cursorRaw : undefined;

  const search = String(req.query.search ?? "").trim();

  return { limit, cursor, search };
}

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

// Run a cursor-paged findMany. Pass a `query(args)` that forwards `take`/`cursor`/
// `skip` into your prisma call (so you keep full control of where/orderBy/include).
// Fetches limit+1 to detect "has more" without a second count query. The cursor is
// the row's `id` (override via `idOf` if the row shape differs).
//
//   const page = await paginate({ limit, cursor, search }, (args) =>
//     prisma.employee.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], ...args }),
//   );
//
// IMPORTANT: the query's orderBy MUST be stable and end in a unique key (id), and
// the cursor must match that key, or paging will skip/repeat rows. For a
// createdAt-desc list use orderBy: [{ createdAt: "desc" }, { id: "desc" }].
export async function paginate<T extends { id: string }>(
  params: PageParams,
  query: (args: { take: number; cursor?: { id: string }; skip?: number }) => Promise<T[]>,
  idOf: (row: T) => string = (row) => row.id,
): Promise<Page<T>> {
  const args: { take: number; cursor?: { id: string }; skip?: number } = {
    take: params.limit + 1, // fetch one extra to know if there's a next page
  };
  if (params.cursor) {
    args.cursor = { id: params.cursor };
    args.skip = 1; // skip the cursor row itself
  }

  const rows = await query(args);
  const hasMore = rows.length > params.limit;
  const items = hasMore ? rows.slice(0, params.limit) : rows;
  const nextCursor = hasMore ? idOf(items[items.length - 1]) : null;
  return { items, nextCursor };
}
