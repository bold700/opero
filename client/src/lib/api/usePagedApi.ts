import { useCallback, useEffect, useRef, useState } from "react";
import i18n from "../../i18n";
import { ApiError, type Page } from "./client";

// Cursor-paginated data hook. Fetches page 1 on mount and whenever `deps`
// change (e.g. the search term or an active filter), accumulating pages as the
// user loads more. Plain useState/useEffect — no data libraries, matching useApi.
//
//   const { items, loading, loadingMore, error, hasMore, loadMore, reload } =
//     usePagedApi<Row>(
//       (cursor) => getRowsPage({ cursor, search }),
//       [search],
//     );
//
// `fetchPage(cursor)` returns one Page<T>; the hook owns cursor/accumulation.
// When `deps` change the list RESETS to page 1 (fresh search/filter), so callers
// pass the search term / filter values in `deps`.
export type PagedState<T, M = unknown> = {
  items: T[];
  loading: boolean; // first page loading (show a spinner / skeleton)
  loadingMore: boolean; // a subsequent page is loading (show inline footer)
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
  // Extra fields off the page response beyond { items, nextCursor } — e.g. the
  // whole-set `counts`. Reflects the FIRST page of the current query (counts are
  // query-wide, so they don't change as you load more). null until page 1 lands.
  meta: M | null;
};

export function usePagedApi<T, M = unknown>(
  fetchPage: (cursor?: string) => Promise<Page<T> & M>,
  deps: unknown[] = [],
): PagedState<T, M> {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<M | null>(null);

  // Guards against out-of-order/stale responses: only the latest run may commit.
  const runId = useRef(0);
  // Latest fetcher without making it a dependency (it's recreated each render).
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const toMsg = (e: unknown) =>
    e instanceof ApiError ? e.message : i18n.t("common.states.loadFailed");

  // Load the first page (fresh): resets accumulation.
  const loadFirst = useCallback(() => {
    const myRun = ++runId.current;
    setLoading(true);
    setError(null);
    fetchRef
      .current(undefined)
      .then((page) => {
        if (myRun !== runId.current) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setMeta(page as M);
        setLoading(false);
      })
      .catch((e) => {
        if (myRun !== runId.current) return;
        setError(toMsg(e));
        setLoading(false);
      });
  }, []);

  // Load the next page and append.
  const loadMore = useCallback(() => {
    if (!cursor) return; // no more pages
    const myRun = runId.current; // must still be the active run when it resolves
    setLoadingMore(true);
    fetchRef
      .current(cursor)
      .then((page) => {
        if (myRun !== runId.current) return;
        setItems((prev) => [...prev, ...page.items]);
        setCursor(page.nextCursor);
        setLoadingMore(false);
      })
      .catch((e) => {
        if (myRun !== runId.current) return;
        setError(toMsg(e));
        setLoadingMore(false);
      });
  }, [cursor]);

  // (Re)load page 1 on mount and whenever deps change.
  useEffect(() => {
    loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore: cursor !== null,
    loadMore,
    reload: loadFirst,
    meta,
  };
}
