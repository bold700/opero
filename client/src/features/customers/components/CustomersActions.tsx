import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";

// Right-side actions in the customers top bar: search + new customer.
export function CustomersActions() {
  const { t } = useTranslation();
  return (
    <>
      <TextField
        size="small"
        placeholder={t("customers.actions.searchPlaceholder")}
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
        {t("customers.actions.newCustomer")}
      </Button>
    </>
  );
}
