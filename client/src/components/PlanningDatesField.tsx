import { useRef, useState } from "react";
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
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dates = [...new Set(value)].sort();
  const dateInPast = Boolean(nextDate && minimumDate && nextDate < minimumDate);

  const selectDate = (date: string) => {
    setNextDate(date);
    const selectedDateInPast = Boolean(date && minimumDate && date < minimumDate);
    if (!date || selectedDateInPast || dates.includes(date)) return;

    // A calendar selection is the complete action. Persist it immediately so
    // there is no hidden second confirmation step that can be missed.
    onChange([...dates, date].sort());
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
          onChange={(event) => selectDate(event.target.value)}
          inputRef={dateInputRef}
          disabled={disabled}
          size="small"
          error={dateInPast}
          helperText={dateInPast ? t("planning.schedule.dateInPast") : undefined}
          slotProps={{ htmlInput: { min: minimumDate } }}
        />
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => dateInputRef.current?.click()}
          disabled={disabled}
        >
          {t("planning.schedule.addDay")}
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
