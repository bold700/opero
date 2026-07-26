import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import RequestQuoteOutlinedIcon from "@mui/icons-material/RequestQuoteOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Tooltip from "@mui/material/Tooltip";
import { Card } from "../../../components/Card";
import { StatusBadge } from "../../../components/StatusBadge";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { URGENCY } from "../constants";
import { humanize } from "../../../lib/labels";
import { STATUS_TONES } from "../../../theme/tokens";
import type { Project, WorkOrder } from "../api";

// Detail header — mirrors opero-old's project-detail header (the layout the
// client prefers):
//   [← back]  Title                              [export] [Werkbon afronden]
//             customer · | · stage-badge
// Compact title, a single meta line with a divider before the stage badge, and
// the export icon + primary afronden/heropenen button. Adding a zone lives in
// the task list ("Zone toevoegen"), not here. Job setup stays in the sidebar.
export function DetailHeader({
  workOrder,
  project,
  canDelete,
  canFinish,
  canReopen,
  canExportQuote,
  finished,
  busy,
  exporting,
  exportingQuote,
  onBack,
  onDelete,
  onFinish,
  onReopen,
  onExportPdf,
  onExportQuotePdf,
  onOpenInfo,
}: {
  workOrder: WorkOrder;
  project: Project;
  canDelete: boolean;
  canFinish: boolean;
  /** Admin-only: undoes a sign-off (clears the customer signature). */
  canReopen: boolean;
  /** Admin-only: the quote (offerte) PDF is a commercial document with prices. */
  canExportQuote: boolean;
  finished: boolean;
  busy: boolean;
  exporting: boolean;
  exportingQuote: boolean;
  onBack: () => void;
  onDelete: () => void;
  onFinish: () => void;
  onReopen: () => void;
  onExportPdf: () => void;
  onExportQuotePdf: () => void;
  /**
   * Opens the Projectinfo sheet. Only passed where the layout has collapsed to
   * one column and the panel isn't on screen; omit it and no icon renders.
   */
  onOpenInfo?: () => void;
}) {
  const { t } = useTranslation();
  const urgency = URGENCY[project.urgency] ?? URGENCY.normal;
  // Admin export menu (offerte / werkbon in one button).
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const anyExporting = exporting || exportingQuote;

  return (
    <Card>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        {/* Left: back · title · meta line (customer | stage). */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <IconButton aria-label={t("workOrderDetail.header.back")} onClick={onBack} sx={{ ml: -1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {workOrder.title ||
                t("workOrderDetail.header.defaultTitle", { n: workOrder.ordinal + 1 })}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25, flexWrap: "wrap" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {project.customerName}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.disabled" }}>
                |
              </Typography>
              <StatusBadge
                label={t(`workOrderDetail.stage.${project.stage}`, {
                  defaultValue: humanize(project.stage),
                })}
                tone={STATUS_TONES.open}
              />
              <StatusBadge label={t(`workOrderDetail.urgency.${urgency.key}`)} tone={urgency.tone} />
              {finished ? (
                <StatusBadge label={t("workOrderDetail.header.signed")} tone={STATUS_TONES.success} />
              ) : null}
              {finished && workOrder.signedByName ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {t("workOrderDetail.header.signedBy", { name: workOrder.signedByName })}
                </Typography>
              ) : null}
            </Box>
          </Box>
        </Box>

        {/* Right: icon actions (export, add-zone) then the primary button. */}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexShrink: 0 }}>
          {/* Projectinfo — only below lg, where the sidebar has collapsed and the
              panel would otherwise sit ~3 screens down. Hidden by CSS (not
              unmounted) since it's a pure visibility toggle. */}
          {onOpenInfo ? (
            <Tooltip title={t("workOrderDetail.header.info")}>
              <IconButton
                aria-label={t("workOrderDetail.header.info")}
                onClick={onOpenInfo}
                sx={{ display: { xs: "inline-flex", lg: "none" } }}
              >
                <InfoOutlinedIcon />
              </IconButton>
            </Tooltip>
          ) : null}

          {/* Export — ICON button like the old app. Technicians export the
              werkbon PDF directly; admins get the offerte/werkbon menu. */}
          {canExportQuote ? (
            <>
              <IconButton
                aria-label={t("workOrderDetail.header.export")}
                onClick={(e) => setExportAnchor(e.currentTarget)}
                disabled={anyExporting}
              >
                {anyExporting ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <PictureAsPdfOutlinedIcon />
                )}
              </IconButton>
              <Menu
                anchorEl={exportAnchor}
                open={exportAnchor !== null}
                onClose={() => setExportAnchor(null)}
              >
                <MenuItem
                  onClick={() => {
                    setExportAnchor(null);
                    onExportQuotePdf();
                  }}
                >
                  <ListItemIcon>
                    <RequestQuoteOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  {t("workOrderDetail.header.exportMenuQuote")}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setExportAnchor(null);
                    onExportPdf();
                  }}
                >
                  <ListItemIcon>
                    <PictureAsPdfOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  {t("workOrderDetail.header.exportMenuWorkOrder")}
                </MenuItem>
              </Menu>
            </>
          ) : (
            <IconButton
              aria-label={t("workOrderDetail.header.exportPdf")}
              onClick={onExportPdf}
              disabled={exporting}
            >
              {exporting ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <PictureAsPdfOutlinedIcon />
              )}
            </IconButton>
          )}

          {/* Delete the whole werkbon — admin only, and destructive, so it's a
              quiet icon that turns red on hover and always confirms first. */}
          {canDelete ? (
            <Tooltip title={t("workOrderDetail.header.delete")}>
              <IconButton
                aria-label={t("workOrderDetail.header.delete")}
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Tooltip>
          ) : null}

          {canFinish && !finished ? (
            <Button variant="contained" onClick={onFinish} disabled={busy}>
              {t("workOrderDetail.header.finish")}
            </Button>
          ) : null}
          {canReopen && finished ? (
            <Button variant="outlined" onClick={() => setConfirmReopen(true)} disabled={busy}>
              {t("workOrderDetail.header.reopen")}
            </Button>
          ) : null}
        </Box>
      </Box>

      <ConfirmDialog
        open={confirmReopen}
        title={t("workOrderDetail.header.reopenTitle")}
        body={t("workOrderDetail.header.reopenBody")}
        confirmLabel={t("workOrderDetail.header.reopen")}
        busy={busy}
        destructive
        onClose={() => setConfirmReopen(false)}
        onConfirm={() => {
          onReopen();
          setConfirmReopen(false);
        }}
      />

      {/* Deleting a werkbon takes its zones, lines, photos and billing with it,
          so the body names the werkbon and spells out what goes. */}
      <ConfirmDialog
        open={confirmDelete}
        title={t("workOrderDetail.header.deleteTitle")}
        body={t("workOrderDetail.header.deleteBody", {
          name:
            workOrder.title ||
            t("workOrderDetail.header.defaultTitle", { n: workOrder.ordinal + 1 }),
        })}
        confirmLabel={t("common.actions.delete")}
        busy={busy}
        destructive
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          onDelete();
          setConfirmDelete(false);
        }}
      />
    </Card>
  );
}
