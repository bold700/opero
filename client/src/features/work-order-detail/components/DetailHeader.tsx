import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import RequestQuoteOutlinedIcon from "@mui/icons-material/RequestQuoteOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import HistoryIcon from "@mui/icons-material/History";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import Tooltip from "@mui/material/Tooltip";
import Badge from "@mui/material/Badge";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { TAP_TARGET } from "../../../theme/tokens";
import { WorkOrderHeaderSummary } from "./WorkOrderHeaderSummary";
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
  canExportInvoice,
  finished,
  busy,
  exporting,
  exportingQuote,
  exportingInvoice,
  onBack,
  onDelete,
  onFinish,
  onReopen,
  onExportPdf,
  onExportQuotePdf,
  onExportInvoicePdf,
  onOpenInfo,
  onOpenAttachments,
  onOpenNotes,
  onOpenActivity,
  attachmentCount,
  noteCount,
  workflowAction,
}: {
  workOrder: WorkOrder;
  project: Project;
  /** Staff viewing an undispatched werkbon — shows the "Niet verzonden" chip.
   *  Computed by the page (role + dispatch state); clients never get it. */
  canDelete: boolean;
  canFinish: boolean;
  /** Admin-only: undoes a sign-off (clears the customer signature). */
  canReopen: boolean;
  /** Admin-only: the quote (offerte) PDF is a commercial document with prices. */
  canExportQuote: boolean;
  canExportInvoice: boolean;
  finished: boolean;
  busy: boolean;
  exporting: boolean;
  exportingQuote: boolean;
  exportingInvoice: boolean;
  onBack: () => void;
  onDelete: () => void;
  onFinish: () => void;
  onReopen: () => void;
  onExportPdf: () => void;
  onExportQuotePdf: () => void;
  onExportInvoicePdf: () => void;
  onOpenInfo: () => void;
  onOpenAttachments: () => void;
  onOpenNotes: () => void;
  onOpenActivity: () => void;
  attachmentCount: number;
  noteCount: number;
  workflowAction?: { label: string; onClick: () => void };
}) {
  const { t } = useTranslation();
  // THIS visit's priority (per-werkbon). Blocked is the project's separate
  // workflow axis — shown as its own chip, never as an urgency.
  // Admin export menu (offerte / werkbon in one button).
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const anyExporting = exporting || exportingQuote || exportingInvoice;

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        {/* Left: back · title · meta line (customer | stage). */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <IconButton
            aria-label={t("workOrderDetail.header.back")}
            onClick={onBack}
            sx={{ mt: -0.5, ml: -1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <WorkOrderHeaderSummary workOrder={workOrder} project={project} finished={finished} />
        </Box>

        {/* Right: icon actions (export, add-zone) then the primary button.
            Wraps and shrinks on narrow screens — at 320px these buttons are
            wider than the card, and `flexShrink: 0` made them overflow it. */}
        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "center",
            flexWrap: "wrap",
            rowGap: 1,
            minWidth: 0,
            flexShrink: { xs: 1, sm: 0 },
          }}
        >
          {/* Projectinfo — only below lg, where the sidebar has collapsed and the
              panel would otherwise sit ~3 screens down. Hidden by CSS (not
              unmounted) since it's a pure visibility toggle. */}
          <Box
            role="group"
            aria-label={t("workOrderDetail.header.sections")}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              flexWrap: "wrap",
            }}
          >
            <Tooltip title={t("workOrderDetail.header.info")}>
              <IconButton
                aria-label={t("workOrderDetail.header.info")}
                onClick={onOpenInfo}
                sx={{ width: TAP_TARGET, height: TAP_TARGET }}
              >
                <InfoOutlinedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("workOrderDetail.header.attachments")}>
              <IconButton
                aria-label={t("workOrderDetail.header.attachments")}
                onClick={onOpenAttachments}
                sx={{ width: TAP_TARGET, height: TAP_TARGET }}
              >
                <Badge badgeContent={attachmentCount} color="primary" max={99}>
                  <AttachFileOutlinedIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title={t("workOrderDetail.header.notes")}>
              <IconButton
                aria-label={t("workOrderDetail.header.notes")}
                onClick={onOpenNotes}
                sx={{ width: TAP_TARGET, height: TAP_TARGET }}
              >
                <Badge badgeContent={noteCount} color="primary" max={99}>
                  <NotesOutlinedIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title={t("workOrderDetail.activity.title")}>
              <IconButton
                aria-label={t("workOrderDetail.activity.title")}
                onClick={onOpenActivity}
                sx={{ width: TAP_TARGET, height: TAP_TARGET }}
              >
                <HistoryIcon />
              </IconButton>
            </Tooltip>

          {/* Export — ICON button like the old app. Technicians export the
              werkbon PDF directly; admins get the offerte/werkbon menu. */}
          {canExportQuote ? (
            <>
              <Tooltip title={t("workOrderDetail.header.export")}>
                <IconButton
                  aria-label={t("workOrderDetail.header.export")}
                  onClick={(e) => setExportAnchor(e.currentTarget)}
                  disabled={anyExporting}
                  sx={{ width: TAP_TARGET, height: TAP_TARGET }}
                >
                  {anyExporting ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <PictureAsPdfOutlinedIcon />
                  )}
                </IconButton>
              </Tooltip>
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
                {canExportInvoice ? (
                  <MenuItem
                    onClick={() => {
                      setExportAnchor(null);
                      onExportInvoicePdf();
                    }}
                  >
                    <ListItemIcon>
                      <ReceiptLongOutlinedIcon fontSize="small" />
                    </ListItemIcon>
                    {t("workOrderDetail.header.exportMenuInvoice")}
                  </MenuItem>
                ) : null}
              </Menu>
            </>
          ) : (
            <Tooltip title={t("workOrderDetail.header.exportPdf")}>
              <IconButton
                aria-label={t("workOrderDetail.header.exportPdf")}
                onClick={onExportPdf}
                disabled={exporting}
                sx={{ width: TAP_TARGET, height: TAP_TARGET }}
              >
                {exporting ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <PictureAsPdfOutlinedIcon />
                )}
              </IconButton>
            </Tooltip>
          )}

          {/* Delete the whole werkbon — admin only, and destructive, so it's a
              quiet icon that turns red on hover and always confirms first. */}
          {canDelete ? (
            <Tooltip title={t("workOrderDetail.header.delete")}>
              <IconButton
                aria-label={t("workOrderDetail.header.delete")}
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                sx={{
                  width: TAP_TARGET,
                  height: TAP_TARGET,
                  color: "text.secondary",
                  "&:hover": { color: "error.main" },
                }}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Tooltip>
          ) : null}

          </Box>

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
          {workflowAction ? (
            <Button variant="contained" onClick={workflowAction.onClick} disabled={busy}>
              {workflowAction.label}
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
    </>
  );
}
