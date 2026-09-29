import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { ResponsiveList } from "../../../components/ResponsiveList";
import { StatusBadge } from "../../../components/StatusBadge";
import type { WorkOrderRow } from "../api";
import { STATUS, formatDate } from "../constants";

// The work orders list: a dense table on desktop, a stack of cards on mobile
// (via ResponsiveList). Row / card tap opens the work-order detail.
export function WorkOrdersTable({
  rows,
  onOpen,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  rows: WorkOrderRow[];
  onOpen: (id: string) => void;
  /** Staff only: mark undispatched rows. Release state is internal workflow,
   *  so client logins never get the chip. */
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const { t } = useTranslation();

  // Status (progress) plus, for staff, the release marker. Two chips, two
  // axes — dispatch is deliberately NOT a fifth status value.
  const statusCell = (r: WorkOrderRow) => (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
      <StatusBadge label={t(STATUS[r.status].labelKey)} tone={STATUS[r.status].tone} />
    </Box>
  );

  return (
    <ResponsiveList
      items={rows}
      keyOf={(r) => r.id}
      empty={t("workOrders.table.empty")}
      onRowClick={(r) => onOpen(r.id)}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      columns={[
        { header: t("workOrders.table.number"), sortValue: (r) => r.number, cell: (r) => <Box sx={{ fontWeight: 700 }}>{r.number}</Box> },
        {
          header: t("workOrders.table.name"),
          sortValue: (r) => r.title,
          cell: (r) => r.title || <Box sx={{ color: "text.disabled" }}>—</Box>,
        },
        { header: t("workOrders.table.customer"), sortValue: (r) => r.customerName, cell: (r) => r.customerName },
        { header: t("workOrders.table.location"), sortValue: (r) => r.city, cell: (r) => <Box sx={{ color: "text.secondary" }}>{r.city}</Box> },
        { header: t("workOrders.table.workType"), sortValue: (r) => r.workType, cell: (r) => <Box sx={{ color: "text.secondary" }}>{r.workType}</Box> },
        { header: t("workOrders.table.technician"), sortValue: (r) => r.technician, cell: (r) => <Box sx={{ color: "text.secondary" }}>{r.technician}</Box> },
        { header: t("workOrders.table.status"), sortValue: (r) => r.status, cell: statusCell },
        { header: t("workOrders.table.date"), sortValue: (r) => r.date, cell: (r) => <Box sx={{ color: "text.secondary" }}>{formatDate(r.date)}</Box> },
        {
          header: t("workOrders.table.action"),
          align: "right",
          cell: (r) => (
            <IconButton
              size="small"
              aria-label={t("workOrders.table.viewAria")}
              onClick={(e) => {
                e.stopPropagation();
                onOpen(r.id);
              }}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          ),
        },
      ]}
      renderCard={(r) => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {/* Top line: work order number + status */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }}>{r.number}</Typography>
              {r.title ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
                  {r.title}
                </Typography>
              ) : null}
            </Box>
            {statusCell(r)}
          </Box>
          {/* Customer + city */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "baseline" }}>
            <Typography sx={{ fontWeight: 600 }}>{r.customerName}</Typography>
            {r.city ? (
              <Typography sx={{ color: "text.secondary", fontSize: 13 }}>· {r.city}</Typography>
            ) : null}
          </Box>
          {/* Meta line: work type · technician · date */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, color: "text.secondary", fontSize: 13 }}>
            {r.workType ? <span>{r.workType}</span> : null}
            {r.technician ? (
              <>
                <span>·</span>
                <span>{r.technician}</span>
              </>
            ) : null}
            <span>·</span>
            <span>{formatDate(r.date)}</span>
          </Box>
        </Box>
      )}
    />
  );
}
