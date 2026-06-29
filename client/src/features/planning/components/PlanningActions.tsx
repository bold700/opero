import { useTranslation } from "react-i18next";
import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import AddIcon from "@mui/icons-material/Add";
import { LAVENDER, LAVENDER_HOVER } from "../../../theme/tokens";
import type { CalendarViewName } from "./CalendarView";

// Top-bar actions: the real day/week/month/list view toggle + new appointment.
export function PlanningActions({
  view,
  onView,
  onCreate,
  canCreate,
}: {
  view: CalendarViewName;
  onView: (v: CalendarViewName) => void;
  onCreate: () => void;
  canCreate: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <ToggleButtonGroup
        value={view}
        exclusive
        size="small"
        onChange={(_e, v) => v && onView(v as CalendarViewName)}
        sx={{ "& .MuiToggleButton-root": { textTransform: "none", px: 2, "&.Mui-selected": { bgcolor: LAVENDER, color: "primary.main", "&:hover": { bgcolor: LAVENDER_HOVER } } } }}
      >
        <ToggleButton value="timeGridDay">{t("planning.views.day")}</ToggleButton>
        <ToggleButton value="timeGridWeek">{t("planning.views.week")}</ToggleButton>
        <ToggleButton value="dayGridMonth">{t("planning.views.month")}</ToggleButton>
        <ToggleButton value="listWeek">{t("planning.views.list")}</ToggleButton>
      </ToggleButtonGroup>
      {canCreate ? (
        <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
          {t("planning.newAppointment")}
        </Button>
      ) : null}
    </>
  );
}
