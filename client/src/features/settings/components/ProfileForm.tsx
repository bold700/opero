import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import { GroupLabel } from "./GroupLabel";
import { fieldGrid } from "../constants";

export function ProfileForm({ name }: { name: string }) {
  const [first = "Jan", last = "de Vries"] = name.split(" ");
  return (
    <Box>
      {/* Profile photo block */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
        <Avatar sx={{ width: 88, height: 88, bgcolor: "primary.main", fontWeight: 700, fontSize: 30 }}>
          {(first[0] ?? "") + (last[0] ?? "")}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.25 }}>Profielfoto</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            JPG of PNG, max 2 MB
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="contained" size="small">Foto wijzigen</Button>
            <Button variant="outlined" size="small" color="error">Verwijderen</Button>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      <GroupLabel>Persoonlijke gegevens</GroupLabel>
      <Box sx={fieldGrid}>
        <TextField label="Voornaam" defaultValue={first} fullWidth />
        <TextField label="Achternaam" defaultValue={last} fullWidth />
        <TextField label="E-mailadres" type="email" defaultValue="jan.devries@werkbonapp.nl" fullWidth sx={{ gridColumn: { sm: "1 / -1" } }} />
        <TextField label="Telefoonnummer" defaultValue="+31 6 12345678" fullWidth />
        <TextField label="Functie" defaultValue="Admin / Eigenaar" fullWidth />
      </Box>
    </Box>
  );
}
