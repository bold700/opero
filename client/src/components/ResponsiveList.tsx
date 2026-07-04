import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import { Card } from "./Card";

// A list that renders as a DENSE TABLE on desktop (md+) and a STACK OF CARDS on
// mobile (xs–sm). Almost every list screen (Employees, Customers, Users,
// Work orders, Materials) is "rows with a few columns + a status + actions" —
// this is the one shared table→card pattern so mobile stays consistent.
//
// Desktop uses the app's standard table styling (hairline borders, 13px 600 head).
// Mobile renders `renderCard(item)` inside a tapable Card. Provide a stable
// `keyOf` per row.
//
// Pagination: when the list is cursor-paged, pass `hasMore` + `onLoadMore`
// (+ `loadingMore`). A footer renders an auto-loading sentinel (IntersectionObserver)
// AND a visible "Load more" button as the fallback — identical on mobile + desktop.
//
// Usage:
//   <ResponsiveList
//     items={rows}
//     keyOf={(r) => r.id}
//     columns={[...]}
//     renderCard={(r) => <EmployeeCard employee={r} />}
//     empty={t("employees.empty")}
//     hasMore={hasMore}
//     loadingMore={loadingMore}
//     onLoadMore={loadMore}
//   />

export type ResponsiveColumn<T> = {
  header: ReactNode;
  cell: (item: T) => ReactNode;
  align?: "left" | "right" | "center";
};

export function ResponsiveList<T>({
  items,
  keyOf,
  columns,
  renderCard,
  empty,
  onRowClick,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  items: T[];
  keyOf: (item: T) => string;
  columns: ResponsiveColumn<T>[];
  renderCard: (item: T) => ReactNode;
  empty: ReactNode;
  /** Optional row/card tap handler (e.g. navigate to detail). */
  onRowClick?: (item: T) => void;
  /** Whether another page is available (enables the load-more footer). */
  hasMore?: boolean;
  /** Whether the next page is currently loading. */
  loadingMore?: boolean;
  /** Fetch the next page. Required for the load-more footer to appear. */
  onLoadMore?: () => void;
}) {
  // --- Empty state (shared) ---
  if (items.length === 0) {
    return (
      <Card noPadding>
        <Box sx={{ color: "text.secondary", textAlign: "center", py: 5, px: 3 }}>
          {empty}
        </Box>
      </Card>
    );
  }

  const footer =
    onLoadMore && hasMore ? (
      <LoadMoreFooter loadingMore={loadingMore} onLoadMore={onLoadMore} />
    ) : null;

  return (
    <>
      {/* Desktop: table (hidden on xs) */}
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <Card noPadding>
          <Table
            sx={{
              "& th, & td": { borderColor: "#F0EDF1", px: 3 },
              "& th": { py: 2 },
              "& td": { py: 2 },
            }}
          >
            <TableHead>
              <TableRow sx={{ "& th": { color: "text.secondary", fontWeight: 600, fontSize: 13 } }}>
                {columns.map((c, i) => (
                  <TableCell key={i} align={c.align ?? "left"}>
                    {c.header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={keyOf(item)}
                  hover
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  sx={{
                    "&:last-child td": { border: 0 },
                    ...(onRowClick ? { cursor: "pointer" } : {}),
                  }}
                >
                  {columns.map((c, i) => (
                    <TableCell key={i} align={c.align ?? "left"}>
                      {c.cell(item)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        {footer}
      </Box>

      {/* Mobile: card stack (hidden on md+) */}
      <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column", gap: 1.5 }}>
        {items.map((item) => (
          <Card
            key={keyOf(item)}
            onClick={onRowClick ? () => onRowClick(item) : undefined}
            sx={{
              p: 2,
              ...(onRowClick
                ? { cursor: "pointer", "&:active": { bgcolor: "#FAFAFB" } }
                : {}),
            }}
          >
            {renderCard(item)}
          </Card>
        ))}
        {footer}
      </Box>
    </>
  );
}

// Load-more footer: an invisible sentinel that auto-loads the next page when it
// scrolls into view, plus a tappable "Load more" button (the honest fallback for
// when auto-load doesn't fire — e.g. the sentinel never enters the viewport, or
// reduced-motion / no-observer environments). Same on mobile and desktop.
function LoadMoreFooter({
  loadingMore,
  onLoadMore,
}: {
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useTranslation();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Keep the latest onLoadMore/loadingMore without re-subscribing the observer.
  const loadRef = useRef(onLoadMore);
  loadRef.current = onLoadMore;
  const loadingRef = useRef(loadingMore);
  loadingRef.current = loadingMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Fire only when visible and not already loading a page.
        if (entries[0]?.isIntersecting && !loadingRef.current) {
          loadRef.current();
        }
      },
      { rootMargin: "200px" }, // prefetch slightly before it's on screen
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        py: 2,
        gap: 1,
      }}
    >
      <Box ref={sentinelRef} sx={{ height: 1, width: 1 }} aria-hidden />
      {loadingMore ? (
        <CircularProgress size={22} />
      ) : (
        <Button variant="text" onClick={onLoadMore} sx={{ borderRadius: 100 }}>
          {t("common.list.loadMore")}
        </Button>
      )}
    </Box>
  );
}
