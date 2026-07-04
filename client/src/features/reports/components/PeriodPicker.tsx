import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CheckIcon from "@mui/icons-material/Check";
import {
  type Period,
  type PresetKey,
  PRESETS,
  presetPeriod,
  shiftMonth,
  periodLabel,
  matchingPreset,
} from "../constants";

// Period navigator: ◀ month ▶ + a presets dropdown. Drives the whole reports view.
export function PeriodPicker({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const active = matchingPreset(period);

  const pickPreset = (key: PresetKey) => {
    setAnchor(null);
    onChange(presetPeriod(key));
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        flexWrap: { xs: "wrap", sm: "nowrap" },
        width: { xs: "100%", sm: "auto" },
      }}
    >
      <IconButton
        size="small"
        aria-label={t("reports.period.previous")}
        onClick={() => onChange(shiftMonth(period, -1))}
      >
        <ChevronLeftIcon />
      </IconButton>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          minWidth: 150,
          flex: { xs: 1, sm: "0 0 auto" },
          justifyContent: "center",
        }}
      >
        <CalendarMonthIcon fontSize="small" sx={{ color: "text.secondary" }} />
        <Typography sx={{ fontWeight: 600, textTransform: "capitalize" }}>
          {periodLabel(period)}
        </Typography>
      </Box>

      <IconButton
        size="small"
        aria-label={t("reports.period.next")}
        onClick={() => onChange(shiftMonth(period, 1))}
      >
        <ChevronRightIcon />
      </IconButton>

      <Button
        size="small"
        variant="outlined"
        color="inherit"
        endIcon={<KeyboardArrowDownIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          ml: { xs: 0, sm: 0.5 },
          textTransform: "none",
          width: { xs: "100%", sm: "auto" },
          order: { xs: 1, sm: 0 },
        }}
      >
        {active ? t(`reports.period.${active}`) : t("reports.period.presets")}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {PRESETS.map((key) => (
          <MenuItem key={key} selected={key === active} onClick={() => pickPreset(key)}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              {key === active ? <CheckIcon fontSize="small" color="primary" /> : null}
            </ListItemIcon>
            <ListItemText>{t(`reports.period.${key}`)}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
