import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import { PAGE_PADDING_RESPONSIVE } from "../../../theme/tokens";
import { ProjectInfoPanel } from "./ProjectInfoPanel";
import { WorkOrderSideSheet } from "./WorkOrderSideSheet";
import type { ComponentProps } from "react";

// Projectinfo as a bottom sheet, for when the werkbon layout has collapsed to a
// single column (below lg). The panel is reference data a monteur needs WHILE
// working — customer, address, contact, planning, team — and inline it ends up
// roughly three screens down, past the whole werkbon body.
//
// `sheetBelow="lg"` rather than the default "sm": the problem this solves starts
// wherever the sidebar disappears, which is lg here, not at phone width.
export function ProjectInfoSheet({
  open,
  onClose,
  ...panel
}: {
  open: boolean;
  onClose: () => void;
} & Omit<ComponentProps<typeof ProjectInfoPanel>, "bare">) {
  const { t } = useTranslation();

  return (
    <WorkOrderSideSheet
      open={open}
      onClose={onClose}
      title={t("workOrderDetail.info.title")}
      closeLabel={t("common.actions.close")}
    >
      <Box sx={{ p: PAGE_PADDING_RESPONSIVE }}>
        <ProjectInfoPanel bare {...panel} />
      </Box>
    </WorkOrderSideSheet>
  );
}
