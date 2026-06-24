import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";

// Right-side actions in the materials top bar: search + add material.
export function MaterialsActions() {
  return (
    <>
      <TextField
        size="small"
        placeholder="Zoek materiaal..."
        sx={{ width: { xs: 180, sm: 280 } }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      <Button variant="contained" startIcon={<AddIcon />}>
        Materiaal toevoegen
      </Button>
    </>
  );
}
