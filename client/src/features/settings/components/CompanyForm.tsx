import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import { GroupLabel } from "./GroupLabel";
import { fieldGrid } from "../constants";

export function CompanyForm() {
  return (
    <Box>
      <GroupLabel>Bedrijfsgegevens</GroupLabel>
      <Box sx={fieldGrid}>
        <TextField label="Bedrijfsnaam" defaultValue="Isolatie BV" fullWidth />
        <TextField label="Bedrijfse-mail" type="email" defaultValue="info@isolatiebv.nl" fullWidth />
        <TextField label="Bedrijfsadres" defaultValue="Industrieweg 2, Rotterdam" fullWidth sx={{ gridColumn: { sm: "1 / -1" } }} />
      </Box>
      <Divider sx={{ my: 3 }} />
      <GroupLabel>Facturatie</GroupLabel>
      <Box sx={fieldGrid}>
        <TextField label="Telefoonnummer" defaultValue="010 123 4567" fullWidth />
        <TextField label="BTW / Belastingnummer" defaultValue="NL001234567B01" fullWidth />
      </Box>
    </Box>
  );
}
