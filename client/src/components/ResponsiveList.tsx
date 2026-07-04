import type { ReactNode } from "react";
import Box from "@mui/material/Box";
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
// Usage:
//   <ResponsiveList
//     items={rows}
//     keyOf={(r) => r.id}
//     columns={[
//       { header: t("employees.table.name"), cell: (r) => r.name },
//       { header: t("employees.table.status"), cell: (r) => <StatusBadge .../> },
//       { header: t("common.action"), align: "right", cell: (r) => <RowMenu .../> },
//     ]}
//     renderCard={(r) => <EmployeeCard employee={r} />}
//     empty={t("employees.empty")}
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
}: {
  items: T[];
  keyOf: (item: T) => string;
  columns: ResponsiveColumn<T>[];
  renderCard: (item: T) => ReactNode;
  empty: ReactNode;
  /** Optional row/card tap handler (e.g. navigate to detail). */
  onRowClick?: (item: T) => void;
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
      </Box>
    </>
  );
}
