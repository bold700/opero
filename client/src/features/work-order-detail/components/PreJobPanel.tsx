import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Chip from "@mui/material/Chip";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import { PREJOB_CHECK_ITEMS } from "@opero/shared";
import { Card } from "../../../components/Card";
import { PhotoGrid } from "../../../components/PhotoGrid";
import { HAIRLINE } from "../../../theme/tokens";
import type { WorkOrder } from "../api";

// Pre-job photo check — the dispatch gate. The office completes a short checklist
// and attaches at least one photo before a monteur is sent out. Admin-only
// dispatch button is disabled until the gate is satisfied. Once dispatched, the
// section is read-only.
export function PreJobPanel({
  workOrder,
  isAdmin,
  busy,
  onToggleCheck,
  onUploadPhoto,
  onDeletePhoto,
  onDispatch,
}: {
  workOrder: WorkOrder;
  isAdmin: boolean;
  busy: boolean;
  onToggleCheck: (key: string, done: boolean) => void;
  onUploadPhoto: (file: File) => void;
  onDeletePhoto: (key: string) => void;
  onDispatch: () => void;
}) {
  const { t } = useTranslation();
  const dispatched = Boolean(workOrder.dispatchedAt);
  const editable = isAdmin && !dispatched;

  return (
    <Card noPadding>
      <Box
        sx={{
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("workOrderDetail.prejob.title")}
        </Typography>
        {dispatched ? (
          <Chip
            size="small"
            color="success"
            icon={<CheckCircleOutlineIcon />}
            label={t("workOrderDetail.prejob.dispatched")}
          />
        ) : null}
      </Box>

      <Box sx={{ px: 3, py: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Typography variant="body2" color="text.secondary">
          {t("workOrderDetail.prejob.description")}
        </Typography>

        {/* Checklist */}
        <Box>
          {PREJOB_CHECK_ITEMS.map((key) => (
            <FormControlLabel
              key={key}
              control={
                <Checkbox
                  checked={workOrder.prejobCheck[key] === true}
                  disabled={!editable || busy}
                  onChange={(e) => onToggleCheck(key, e.target.checked)}
                />
              }
              label={t(`workOrderDetail.prejob.items.${key}`)}
              sx={{ display: "flex" }}
            />
          ))}
        </Box>

        {/* Photos */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
            {t("workOrderDetail.prejob.photos")}
          </Typography>
          <PhotoGrid
            photos={workOrder.prejobPhotos}
            canEdit={editable}
            busy={busy}
            onAdd={onUploadPhoto}
            onRemove={onDeletePhoto}
          />
        </Box>

        {/* Dispatch action (admin) */}
        {isAdmin && !dispatched ? (
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              startIcon={<LocalShippingOutlinedIcon />}
              disabled={busy || !workOrder.canDispatch}
              onClick={onDispatch}
            >
              {t("workOrderDetail.prejob.dispatch")}
            </Button>
          </Box>
        ) : null}
        {isAdmin && !dispatched && !workOrder.canDispatch ? (
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: "right" }}>
            {t("workOrderDetail.prejob.gateHint")}
          </Typography>
        ) : null}
      </Box>
    </Card>
  );
}
