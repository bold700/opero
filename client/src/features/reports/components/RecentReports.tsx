import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AssignmentIcon from "@mui/icons-material/Assignment";
import { Card } from "../../../components/Card";
import { LAVENDER } from "../../../theme/tokens";
import { REPORTS } from "../constants";

// Recent reports list card.
export function RecentReports() {
  return (
    <Card sx={{ width: { xs: "100%", lg: 360 }, flexShrink: 0 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Recente rapporten
      </Typography>
      <Box>
        {REPORTS.map((r, i) => (
          <Box key={r.id}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5, cursor: "pointer" }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: LAVENDER, color: "primary.main" }}>
                <AssignmentIcon fontSize="small" />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Rapport {r.id}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Datum: {r.date}
                </Typography>
              </Box>
              <ChevronRightIcon sx={{ color: "text.disabled", fontSize: 20 }} />
            </Box>
            {i < REPORTS.length - 1 ? <Divider /> : null}
          </Box>
        ))}
      </Box>
    </Card>
  );
}
