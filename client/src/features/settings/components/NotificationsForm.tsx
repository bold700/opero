import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import { GroupLabel } from "./GroupLabel";
import { ToggleRow } from "./ToggleRow";

// Notification rows — keys map to settings.notifications.<key>.{label,sub} translations.
const ROWS: { key: string; on: boolean }[] = [
  { key: "newWorkOrder", on: true },
  { key: "urgentOnSite", on: true },
  { key: "extraWorkApproval", on: true },
  { key: "weeklySummary", on: false },
];

export function NotificationsForm() {
  const { t } = useTranslation();
  return (
    <Box>
      <GroupLabel>{t("settings.notifications.preferences")}</GroupLabel>
      <Box>
        {ROWS.map((r, i) => (
          <Box key={r.key}>
            <ToggleRow
              label={t(`settings.notifications.${r.key}.label`)}
              sub={t(`settings.notifications.${r.key}.sub`)}
              on={r.on}
            />
            {i < ROWS.length - 1 ? <Divider /> : null}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
