import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { StatusBadge } from "../../../components/StatusBadge";
import { STATUS_TONES, SPACING } from "../../../theme/tokens";
import type { CalEvent } from "../constants";

// Right-side details panel for the selected calendar event.
export function DetailsPanel({ event }: { event: CalEvent }) {
  const time = `${String(event.start).padStart(2, "0")}:00 — ${String(event.end).padStart(2, "0")}:00`;
  const dur = `${event.end - event.start}u 00m`;
  return (
    <Box sx={{ width: 320, flexShrink: 0, p: SPACING.pagePadding, bgcolor: "background.paper", borderLeft: "1px solid", borderColor: "divider" }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        Details
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {event.customer}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {event.type}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", color: "text.secondary" }}>
          <PlaceOutlinedIcon fontSize="small" />
          <Typography variant="body2" sx={{ color: "text.primary" }}>{event.address}</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", color: "text.secondary" }}>
          <AccessTimeIcon fontSize="small" />
          <Typography variant="body2" sx={{ color: "text.primary" }}>{time} ({dur})</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", color: "text.secondary" }}>
          <PersonOutlineIcon fontSize="small" />
          <Typography variant="body2" sx={{ color: "text.primary" }}>{event.monteur}</Typography>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <StatusBadge label={event.status} tone={STATUS_TONES.open} />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Button variant="contained" startIcon={<OpenInNewIcon />}>
          Werkbon openen
        </Button>
        <Button variant="outlined" startIcon={<EditOutlinedIcon />}>
          Bewerken
        </Button>
      </Box>
    </Box>
  );
}
