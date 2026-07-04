import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
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
  finished,
  busy,
  onBack,
  onFinish,
}: {
  workOrder: WorkOrder;
  project: Project;
  canFinish: boolean;
  finished: boolean;
  busy: boolean;
  onBack: () => void;
  onFinish: () => void;
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
          {/* Export PDF (spec) — wired in a later phase; disabled placeholder. */}
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfOutlinedIcon />}
            disabled
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            {t("workOrderDetail.header.exportPdf")}
          </Button>
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
