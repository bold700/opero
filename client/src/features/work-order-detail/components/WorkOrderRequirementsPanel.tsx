import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Card } from "../../../components/Card";
import { SPACING } from "../../../theme/tokens";
import type { WorkOrder } from "../api";
import { RequirementsContent } from "./RequirementsContent";

export function WorkOrderRequirementsPanel({
  workOrder,
  canCheck,
  canManage,
  busy,
  onToggleTaskMaterial,
  onToggleManual,
  onAdd,
  onDelete,
}: {
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

  return (
    <Card>
      <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {t("workOrderDetail.requirements.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("workOrderDetail.requirements.description")}
          </Typography>
        </Box>
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
    </Card>
  );
}
