import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import {
  ActivityPanel,
  type ActivityEntry,
} from "../../../components/ActivityPanel";
import { SideSheet } from "../../../components/SideSheet";
import { PAGE_PADDING_RESPONSIVE } from "../../../theme/tokens";

export function ProjectActivitySheet({
  open,
  onClose,
  activity,
  onAddComment,
}: {
  open: boolean;
  onClose: () => void;
  activity: ActivityEntry[];
  onAddComment?: (body: string) => Promise<void>;
}) {
  const { t } = useTranslation();

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={t("activity.title")}
      closeLabel={t("common.actions.close")}
    >
      <Box sx={{ px: PAGE_PADDING_RESPONSIVE }}>
        <ActivityPanel activity={activity} onAddComment={onAddComment} bare />
      </Box>
    </SideSheet>
  );
}
