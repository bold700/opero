import { useTranslation } from "react-i18next";
import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import AddIcon from "@mui/icons-material/Add";
import { LAVENDER, LAVENDER_HOVER } from "../../../theme/tokens";

// Right-side actions in the planning top bar: day/week/month toggle + new appt.
export function PlanningActions({ view, onView }: { view: string; onView: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <ToggleButtonGroup
        value={view}
        exclusive
        size="small"
        onChange={(_e, v) => v && onView(v)}
        sx={{ "& .MuiToggleButton-root": { textTransform: "none", px: 2, "&.Mui-selected": { bgcolor: LAVENDER, color: "primary.main", "&:hover": { bgcolor: LAVENDER_HOVER } } } }}
      >
        <ToggleButton value="day">{t("planning.views.day")}</ToggleButton>
        <ToggleButton value="week">{t("planning.views.week")}</ToggleButton>
        <ToggleButton value="month">{t("planning.views.month")}</ToggleButton>
      </ToggleButtonGroup>
      <Button variant="contained" startIcon={<AddIcon />}>
        {t("planning.newAppointment")}
      </Button>
    </>
  );
}
