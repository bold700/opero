import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import AddIcon from "@mui/icons-material/Add";
import { LAVENDER, LAVENDER_HOVER } from "../../../theme/tokens";

// Right-side actions in the planning top bar: day/week/month toggle + new appt.
export function PlanningActions({ view, onView }: { view: string; onView: (v: string) => void }) {
  return (
    <>
      <ToggleButtonGroup
        value={view}
        exclusive
        size="small"
        onChange={(_e, v) => v && onView(v)}
        sx={{ "& .MuiToggleButton-root": { textTransform: "none", px: 2, "&.Mui-selected": { bgcolor: LAVENDER, color: "primary.main", "&:hover": { bgcolor: LAVENDER_HOVER } } } }}
      >
        <ToggleButton value="dag">Dag</ToggleButton>
        <ToggleButton value="week">Week</ToggleButton>
        <ToggleButton value="maand">Maand</ToggleButton>
      </ToggleButtonGroup>
      <Button variant="contained" startIcon={<AddIcon />}>
        Nieuwe afspraak
      </Button>
    </>
  );
}
