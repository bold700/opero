import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { ProjectInfoPanel } from "./ProjectInfoPanel";
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
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      sheetBelow="lg"
      stableHeight
      title={t("workOrderDetail.info.title")}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>{t("workOrderDetail.info.title")}</DialogTitle>
      {/* DialogContent is load-bearing, not decoration: the sheet only makes
          .MuiDialogContent-root scrollable, and this panel is far taller than
          the sheet's 92dvh cap. */}
      <DialogContent>
        <ProjectInfoPanel bare {...panel} />
      </DialogContent>
    </ResponsiveDialog>
  );
}
