import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import RequestQuoteOutlinedIcon from "@mui/icons-material/RequestQuoteOutlined";
import { Card } from "../../../components/Card";
import { StatusBadge } from "../../../components/StatusBadge";
import { URGENCY } from "../constants";
import { humanize } from "../../../lib/labels";
import { STATUS_TONES } from "../../../theme/tokens";
import type { Project, WorkOrder } from "../api";

// Detail header: back button, work-order title + number, customer/location,
// stage + urgency badges, and the "afronden" (sign-off) action.
export function DetailHeader({
  workOrder,
  project,
  canFinish,
  canExportQuote,
  finished,
  busy,
  exporting,
  exportingQuote,
  onBack,
  onFinish,
  onExportPdf,
  onExportQuotePdf,
}: {
  workOrder: WorkOrder;
  project: Project;
  canFinish: boolean;
  /** Admin-only: the quote (offerte) PDF is a commercial document with prices. */
  canExportQuote: boolean;
  finished: boolean;
  busy: boolean;
  exporting: boolean;
  exportingQuote: boolean;
  onBack: () => void;
  onFinish: () => void;
  onExportPdf: () => void;
  onExportQuotePdf: () => void;
}) {
  const { t } = useTranslation();
  const urgency = URGENCY[project.urgency] ?? URGENCY.normal;

  return (
    <Card>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1.5,
          flexWrap: { xs: "wrap", md: "nowrap" },
        }}
      >
        <IconButton aria-label={t("workOrderDetail.header.back")} onClick={onBack} sx={{ mt: -0.5, ml: -1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: { xs: "60%", md: 0 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {workOrder.title ||
                t("workOrderDetail.header.defaultTitle", { n: workOrder.ordinal + 1 })}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {project.projectNumber}
            </Typography>
          </Box>
          <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
            {project.customerName} · {project.address}, {project.city}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, mt: 1.25, flexWrap: "wrap", alignItems: "center" }}>
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

        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "center",
            flexShrink: 0,
            flexDirection: { xs: "column", sm: "row" },
            width: { xs: "100%", md: "auto" },
          }}
        >
          {/* Export the werkbon as a PDF (streamed from the server). */}
          <Button
            variant="outlined"
            startIcon={
              exporting ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfOutlinedIcon />
            }
            onClick={onExportPdf}
            disabled={exporting}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            {t("workOrderDetail.header.exportPdf")}
          </Button>
          {/* Export as a customer-facing quote (offerte) PDF — admin only. */}
          {canExportQuote ? (
            <Button
              variant="outlined"
              startIcon={
                exportingQuote ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <RequestQuoteOutlinedIcon />
                )
              }
              onClick={onExportQuotePdf}
              disabled={exportingQuote}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              {t("workOrderDetail.header.exportQuote")}
            </Button>
          ) : null}
          {canFinish && !finished ? (
            <Button
              variant="contained"
              onClick={onFinish}
              disabled={busy}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              {t("workOrderDetail.header.finish")}
            </Button>
          ) : null}
        </Box>
      </Box>
    </Card>
  );
}
