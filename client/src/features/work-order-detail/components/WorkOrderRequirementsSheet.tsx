import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import { BottomSheet } from "../../../components/BottomSheet";
import { useIsMobile } from "../../../lib/useIsMobile";
import { HAIRLINE, PAGE_PADDING_RESPONSIVE, SPACING } from "../../../theme/tokens";
import type { WorkOrder } from "../api";
import { RequirementsContent } from "./RequirementsContent";
import { WorkOrderSideSheet } from "./WorkOrderSideSheet";

export function WorkOrderRequirementsSheet({
  open,
  onClose,
  workOrder,
  canCheck,
  canManage,
  busy,
  onToggleTaskMaterial,
  onToggleManual,
  onAdd,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  workOrder: WorkOrder;
  canCheck: boolean;
  canManage: boolean;
  busy: boolean;
  onToggleTaskMaterial: (materialId: string, done: boolean) => void;
  onToggleManual: (requirementId: string, done: boolean) => void;
  onAdd: (input: {
    name: string;
    kind: "material" | "tool";
    quantity?: number;
    unit?: string;
  }) => void;
  onDelete: (requirementId: string) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const content = (
    <Box sx={{ p: PAGE_PADDING_RESPONSIVE }}>
      <RequirementsContent
        workOrder={workOrder}
        canCheck={canCheck}
        canManage={canManage}
        busy={busy}
        onToggleTaskMaterial={onToggleTaskMaterial}
        onToggleManual={onToggleManual}
        onAdd={onAdd}
        onDelete={onDelete}
      />
    </Box>
  );

  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t("workOrderDetail.requirements.title")}
        scrollableContent
        header={
          <Box
            sx={{
              px: PAGE_PADDING_RESPONSIVE,
              py: SPACING.itemGap,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${HAIRLINE}`,
              flexShrink: 0,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t("workOrderDetail.requirements.title")}
            </Typography>
            <IconButton aria-label={t("common.actions.close")} onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        }
      >
        <Box sx={{ overflowY: "auto" }}>{content}</Box>
      </BottomSheet>
    );
  }

  return (
    <WorkOrderSideSheet
      open={open}
      onClose={onClose}
      title={t("workOrderDetail.requirements.title")}
      closeLabel={t("common.actions.close")}
    >
      {content}
    </WorkOrderSideSheet>
  );
}
