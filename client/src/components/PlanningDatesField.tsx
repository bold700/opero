import { useState } from "react";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { DateField } from "./DateField";
import { SPACING } from "../theme/tokens";

export function PlanningDatesField({
  value,
  onChange,
  disabled = false,
  minimumDate,
}: {
  value: string[];
  onChange: (dates: string[]) => void;
  disabled?: boolean;
  minimumDate?: string;
}) {
  const { t, i18n } = useTranslation();
  const [nextDate, setNextDate] = useState("");
  const dates = [...new Set(value)].sort();
  const dateInPast = Boolean(nextDate && minimumDate && nextDate < minimumDate);

  const addDate = () => {
    if (!nextDate || dateInPast || dates.includes(nextDate)) return;
    onChange([...dates, nextDate].sort());
    setNextDate("");
  };

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${date}T12:00:00`));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.itemGap }}>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {t("planning.schedule.daysHint")}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr auto" },
          gap: SPACING.itemGap,
          alignItems: "start",
        }}
      >
        <DateField
          label={t("planning.schedule.addDay")}
          value={nextDate}
          onChange={(event) => setNextDate(event.target.value)}
          disabled={disabled}
          size="small"
          error={dateInPast}
          helperText={dateInPast ? t("planning.schedule.dateInPast") : undefined}
          slotProps={{ htmlInput: { min: minimumDate } }}
        />
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addDate}
          disabled={disabled || !nextDate || dateInPast || dates.includes(nextDate)}
        >
          {t("planning.schedule.add")}
        </Button>
      </Box>
      {dates.length ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: SPACING.itemGap }}>
          {dates.map((date) => (
            <Chip
              key={date}
              label={formatDate(date)}
              onDelete={disabled ? undefined : () => onChange(dates.filter((item) => item !== date))}
            />
          ))}
        </Box>
      ) : (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {t("planning.schedule.noDays")}
        </Typography>
      )}
    </Box>
  );
}
