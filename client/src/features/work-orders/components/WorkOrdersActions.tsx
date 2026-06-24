import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import AddIcon from "@mui/icons-material/Add";

// Right-side actions in the work orders top bar: search, favorites, new order.
export function WorkOrdersActions() {
  return (
    <>
      <TextField
        size="small"
        placeholder="Zoek op nummer of klant..."
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
      <IconButton aria-label="favorieten">
        <StarBorderIcon />
      </IconButton>
      <Button variant="contained" startIcon={<AddIcon />}>
        Nieuwe werkbon
      </Button>
    </>
  );
}
