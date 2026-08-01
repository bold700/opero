import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { ActivityPanel } from "./ActivityPanel";
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
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      sheetBelow="lg"
      stableHeight
      title={t("workOrderDetail.activity.title")}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>{t("workOrderDetail.activity.title")}</DialogTitle>
      {/* DialogContent is load-bearing, not decoration: the sheet only makes
          .MuiDialogContent-root scrollable, and a long log is far taller than
          the sheet's height cap. */}
      <DialogContent>
        <ActivityPanel activity={activity} bare />
      </DialogContent>
    </ResponsiveDialog>
  );
}
