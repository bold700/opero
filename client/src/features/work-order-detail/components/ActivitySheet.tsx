import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import { ActivityPanel } from "../../../components/ActivityPanel";
import { PAGE_PADDING_RESPONSIVE } from "../../../theme/tokens";
import { WorkOrderSideSheet } from "./WorkOrderSideSheet";
import type { Activity } from "../api";

// Activiteit as a bottom sheet, for when the werkbon layout has collapsed to a
// single column (below lg). The log is reference data you consult on demand —
// "who changed this, and when" — and inline it sits at the very BOTTOM of the
// page, below the whole werkbon body plus Controle vooraf. Same treatment (and
// same breakpoint) as [ProjectInfoSheet].
export function ActivitySheet({
  open,
  onClose,
  activity,
}: {
  open: boolean;
  onClose: () => void;
  activity: Activity[];
}) {
  const { t } = useTranslation();

  return (
    <WorkOrderSideSheet
      open={open}
      onClose={onClose}
      title={t("workOrderDetail.activity.title")}
      closeLabel={t("common.actions.close")}
    >
      <Box sx={{ px: PAGE_PADDING_RESPONSIVE }}>
        <ActivityPanel activity={activity} bare />
      </Box>
    </WorkOrderSideSheet>
  );
}
