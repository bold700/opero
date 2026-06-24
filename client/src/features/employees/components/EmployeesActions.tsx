import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";

// Right-side actions in the employees top bar: search + new employee.
export function EmployeesActions() {
  return (
    <>
      <TextField
        size="small"
        placeholder="Zoek medewerker..."
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
        Nieuwe medewerker
      </Button>
    </>
  );
}
