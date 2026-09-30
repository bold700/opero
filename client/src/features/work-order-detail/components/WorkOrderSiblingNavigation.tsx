import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { SPACING, TAP_TARGET } from "../../../theme/tokens";

export type WorkOrderSiblingNavigationProps = {
  current: number;
  total: number;
  onPrevious?: () => void;
  onNext?: () => void;
};

export function WorkOrderSiblingNavigation({
  current,
  total,
  onPrevious,
  onNext,
}: WorkOrderSiblingNavigationProps) {
  const { t } = useTranslation();

  if (total <= 1) return null;

  return (
    <Box
      role="group"
      aria-label={t("workOrderDetail.header.siblingNavigation")}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: SPACING.itemGap,
        color: "text.secondary",
      }}
    >
      <Tooltip title={t("workOrderDetail.header.previousWorkOrder")}>
        <span>
          <IconButton
            size="small"
            aria-label={t("workOrderDetail.header.previousWorkOrder")}
            disabled={!onPrevious}
            onClick={onPrevious}
            sx={{ width: TAP_TARGET, height: TAP_TARGET }}
          >
            <ChevronLeftIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Typography variant="body2">
        {t("workOrderDetail.header.projectPosition", { current, total })}
      </Typography>
      <Tooltip title={t("workOrderDetail.header.nextWorkOrder")}>
        <span>
          <IconButton
            size="small"
            aria-label={t("workOrderDetail.header.nextWorkOrder")}
            disabled={!onNext}
            onClick={onNext}
            sx={{ width: TAP_TARGET, height: TAP_TARGET }}
          >
            <ChevronRightIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
