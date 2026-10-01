import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import { ActivityPanel } from "../../../components/ActivityPanel";
import { PAGE_PADDING_RESPONSIVE } from "../../../theme/tokens";
import { SideSheet } from "../../../components/SideSheet";
import type { Activity } from "../api";

// Activity remains an on-demand side sheet so it does not crowd the work-order
// sections. The shared sheet component adapts its presentation to the device.
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
    <SideSheet
      open={open}
      onClose={onClose}
      title={t("workOrderDetail.activity.title")}
      closeLabel={t("common.actions.close")}
    >
      <Box sx={{ px: PAGE_PADDING_RESPONSIVE }}>
        <ActivityPanel activity={activity} bare />
      </Box>
    </SideSheet>
  );
}
