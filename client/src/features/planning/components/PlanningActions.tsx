import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { NewButton } from "../../../components/NewButton";
import {
  LAVENDER,
  LAVENDER_HOVER,
  SPACING,
} from "../../../theme/tokens";
import type { PlanningDisplay, PlanningPeriod } from "./CalendarView";

const PERIODS: { value: PlanningPeriod; labelKey: string }[] = [
  { value: "day", labelKey: "planning.views.day" },
  { value: "week", labelKey: "planning.views.week" },
  { value: "month", labelKey: "planning.views.month" },
];

const DISPLAYS: { value: PlanningDisplay; labelKey: string }[] = [
  { value: "agenda", labelKey: "planning.views.agenda" },
  { value: "list", labelKey: "planning.views.list" },
];

const toggleSx = {
  "& .MuiToggleButton-root": {
    textTransform: "none",
    px: SPACING.itemGap,
    "&.Mui-selected": {
      bgcolor: LAVENDER,
      color: "primary.main",
      "&:hover": { bgcolor: LAVENDER_HOVER },
    },
  },
};

export function PlanningActions({
  period,
  display,
  onPeriod,
  onDisplay,
  onCreate,
  canCreate,
  compact = false,
}: {
  period: PlanningPeriod;
  display: PlanningDisplay;
  onPeriod: (period: PlanningPeriod) => void;
  onDisplay: (display: PlanningDisplay) => void;
  onCreate: () => void;
  canCreate: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: SPACING.itemGap,
          flexWrap: "wrap",
        }}
      >
        {compact ? (
          <>
            <Select
              value={period}
              onChange={(event) => onPeriod(event.target.value as PlanningPeriod)}
              size="small"
              aria-label={t("planning.period")}
              sx={{ minWidth: "max-content", bgcolor: "background.paper" }}
            >
              {PERIODS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </MenuItem>
              ))}
            </Select>
            <Select
              value={display}
              onChange={(event) => onDisplay(event.target.value as PlanningDisplay)}
              size="small"
              aria-label={t("planning.display")}
              sx={{ minWidth: "max-content", bgcolor: "background.paper" }}
            >
              {DISPLAYS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </MenuItem>
              ))}
            </Select>
          </>
        ) : (
          <>
            <ToggleButtonGroup
              value={period}
              exclusive
              size="small"
              onChange={(_event, value) => value && onPeriod(value as PlanningPeriod)}
              aria-label={t("planning.period")}
              sx={toggleSx}
            >
              {PERIODS.map((option) => (
                <ToggleButton key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <ToggleButtonGroup
              value={display}
              exclusive
              size="small"
              onChange={(_event, value) => value && onDisplay(value as PlanningDisplay)}
              aria-label={t("planning.display")}
              sx={toggleSx}
            >
              {DISPLAYS.map((option) => (
                <ToggleButton key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </>
        )}
      </Box>
      {canCreate ? (
        <NewButton label={t("planning.newAppointment")} onClick={onCreate} />
      ) : null}
    </>
  );
}
