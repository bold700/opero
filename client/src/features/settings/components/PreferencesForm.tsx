import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import { GroupLabel } from "./GroupLabel";
import { ToggleRow } from "./ToggleRow";
import { fieldGrid } from "../constants";

export function PreferencesForm() {
  return (
    <Box>
      <GroupLabel>Weergave</GroupLabel>
      <Box sx={fieldGrid}>
        <TextField label="Taal" defaultValue="nl" select fullWidth>
          <MenuItem value="nl">Nederlands</MenuItem>
          <MenuItem value="en">Engels</MenuItem>
        </TextField>
        <TextField label="Thema" defaultValue="light" select fullWidth>
          <MenuItem value="light">Licht</MenuItem>
          <MenuItem value="dark">Donker</MenuItem>
          <MenuItem value="system">Systeem</MenuItem>
        </TextField>
      </Box>
      <Divider sx={{ my: 3 }} />
      <GroupLabel>Privacy</GroupLabel>
      <ToggleRow label="Prijzen tonen aan monteurs" sub="Monteurs zien bedragen op werkbonnen" on={false} />
    </Box>
  );
}
