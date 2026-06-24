import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { DAYS } from "../constants";

// Month navigation header + the week's day chips.
export function DayStrip({ todayIndex }: { todayIndex: number }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <IconButton size="small"><ChevronLeftIcon /></IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Juni 2025</Typography>
        <IconButton size="small"><ChevronRightIcon /></IconButton>
      </Box>
      <Box sx={{ display: "flex", gap: 0.5 }}>
        {DAYS.map((d, i) => {
          const active = i === todayIndex;
          return (
            <Box
              key={d.date}
              sx={{
                width: 48,
                py: 0.75,
                borderRadius: 2,
                textAlign: "center",
                bgcolor: active ? "primary.main" : "transparent",
                color: active ? "#fff" : "text.secondary",
                border: active ? "none" : "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography variant="caption" sx={{ display: "block", lineHeight: 1.2 }}>{d.label}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{d.date}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
