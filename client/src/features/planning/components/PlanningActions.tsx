import { useTranslation } from "react-i18next";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { LAVENDER, LAVENDER_HOVER } from "../../../theme/tokens";
import { NewButton } from "../../../components/NewButton";
import type { CalendarViewName } from "./CalendarView";

// Top-bar actions: the day/week/month/agenda view switcher + new appointment.
// The switcher is available on EVERY screen size (feature parity with desktop) —
// on desktop it's a 4-button toggle group; on mobile (`compact`) it's a compact
// dropdown offering the same four views so the phone header stays tidy.
const VIEWS: { value: CalendarViewName; labelKey: string }[] = [
  { value: "timeGridDay", labelKey: "planning.views.day" },
  { value: "timeGridWeek", labelKey: "planning.views.week" },
  { value: "dayGridMonth", labelKey: "planning.views.month" },
  { value: "listWeek", labelKey: "planning.views.list" },
];

export function PlanningActions({
  view,
  onView,
  onCreate,
  canCreate,
  compact = false,
}: {
  view: CalendarViewName;
  onView: (v: CalendarViewName) => void;
  onCreate: () => void;
  canCreate: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      {compact ? (
        // Mobile: a compact dropdown — all four views, fits the phone header.
        <Select
          value={view}
          onChange={(e) => onView(e.target.value as CalendarViewName)}
          size="small"
          aria-label={t("planning.view")}
          sx={{ flex: 1, minWidth: 0, bgcolor: "background.paper" }}
        >
          {VIEWS.map((v) => (
            <MenuItem key={v.value} value={v.value}>
              {t(v.labelKey)}
            </MenuItem>
          ))}
        </Select>
      ) : (
        <ToggleButtonGroup
          value={view}
          exclusive
          size="small"
          onChange={(_e, v) => v && onView(v as CalendarViewName)}
          sx={{ "& .MuiToggleButton-root": { textTransform: "none", px: 2, "&.Mui-selected": { bgcolor: LAVENDER, color: "primary.main", "&:hover": { bgcolor: LAVENDER_HOVER } } } }}
        >
          {VIEWS.map((v) => (
            <ToggleButton key={v.value} value={v.value}>
              {t(v.labelKey)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}
      {canCreate ? (
        <NewButton label={t("planning.newAppointment")} onClick={onCreate} />
      ) : null}
    </>
  );
}
