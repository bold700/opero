import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import { GroupLabel } from "./GroupLabel";
import { ToggleRow } from "./ToggleRow";

export function NotificationsForm() {
  const rows = [
    { label: "Nieuwe werkbon toegewezen", sub: "Push en e-mail wanneer je een werkbon krijgt", on: true },
    { label: "Spoedmelding op locatie", sub: "Direct een melding bij een spoedgeval", on: true },
    { label: "Meerwerk wacht op goedkeuring", sub: "Wanneer een klant moet goedkeuren", on: true },
    { label: "Wekelijkse samenvatting", sub: "Elke maandag een overzicht per e-mail", on: false },
  ];
  return (
    <Box>
      <GroupLabel>Meldingsvoorkeuren</GroupLabel>
      <Box>
        {rows.map((r, i) => (
          <Box key={r.label}>
            <ToggleRow {...r} />
            {i < rows.length - 1 ? <Divider /> : null}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
