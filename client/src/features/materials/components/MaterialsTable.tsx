import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { ResponsiveList } from "../../../components/ResponsiveList";
import { StatusBadge } from "../../../components/StatusBadge";
import type { MaterialRow } from "../api";
import { STATUS, swatchColor } from "../constants";

// The materials list: a table on desktop (md+), a stack of cards on mobile
// (xs–sm) via ResponsiveList. Edit/delete row actions are admin only.
export function MaterialsTable({
  rows,
  canManage,
  onEdit,
  onDelete,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  rows: MaterialRow[];
  canManage: boolean;
  onEdit: (m: MaterialRow) => void;
  onDelete: (m: MaterialRow) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const { t } = useTranslation();

  const swatch = (r: MaterialRow, size: number) => (
    <Box
      sx={{ width: size, height: size, borderRadius: 1.5, bgcolor: swatchColor(r.name), flexShrink: 0 }}
    />
  );

  const category = (r: MaterialRow) => t(`materials.category.${r.category}`, { defaultValue: r.category });

  // "€ 18,00" when a price is present (admin only — stripped for technicians).
  const price = (r: MaterialRow) =>
    r.unitPrice != null
      ? `€ ${r.unitPrice.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`
      : "—";

  const nameCell = (r: MaterialRow) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      {swatch(r, 36)}
      <Typography sx={{ fontWeight: 600 }}>{r.name}</Typography>
    </Box>
  );

  const statusBadge = (r: MaterialRow) => (
    <StatusBadge label={t(STATUS[r.status].labelKey)} tone={STATUS[r.status].tone} />
  );

  const actionsCell = (r: MaterialRow) =>
    canManage ? (
      <Box sx={{ display: "inline-flex", gap: 0.5 }}>
        <IconButton size="small" aria-label={t("common.actions.edit")} onClick={() => onEdit(r)}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label={t("common.actions.delete")} onClick={() => onDelete(r)}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>
    ) : null;

  return (
    <ResponsiveList
      items={rows}
      keyOf={(r) => r.id}
      empty={t("materials.empty")}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      columns={[
        { header: t("materials.columns.name"), cell: nameCell },
        { header: t("materials.columns.category"), cell: (r) => <Box sx={{ color: "text.secondary" }}>{category(r)}</Box> },
        { header: t("materials.columns.unit"), cell: (r) => <Box sx={{ color: "text.secondary" }}>{r.unit}</Box> },
        { header: t("materials.columns.unitPrice"), cell: (r) => <Box sx={{ color: "text.secondary" }}>{price(r)}</Box> },
        { header: t("materials.columns.stock"), cell: (r) => <Box sx={{ color: "text.secondary" }}>{r.stock}</Box> },
        { header: t("materials.columns.minStock"), cell: (r) => <Box sx={{ color: "text.secondary" }}>{r.minStock}</Box> },
        { header: t("materials.columns.status"), cell: statusBadge },
        { header: t("materials.columns.action"), align: "right", cell: actionsCell },
      ]}
      renderCard={(r) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {swatch(r, 44)}
          {/* Name + stock/unit + category */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 600 }} noWrap>
              {r.name}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, color: "text.secondary", fontSize: 13 }}>
              <span>
                {r.stock} {r.unit}
              </span>
              <span>·</span>
              <span>{category(r)}</span>
              {r.unitPrice != null ? (
                <>
                  <span>·</span>
                  <span>{price(r)}</span>
                </>
              ) : null}
            </Box>
          </Box>
          {/* Status + actions */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
            {statusBadge(r)}
            {actionsCell(r)}
          </Box>
        </Box>
      )}
    />
  );
}
