import { useTranslation } from "react-i18next";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";

// Right-side actions in the work orders top bar: search + new order.
// Search is controlled by the page (client-side filter); "Nieuwe werkbon"
// opens the create dialog. Create is hidden for clients (read-only role).
export function WorkOrdersActions({
  search,
  onSearch,
  onCreate,
  canCreate,
}: {
  search: string;
  onSearch: (value: string) => void;
  onCreate: () => void;
  canCreate: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <TextField
        size="small"
        placeholder={t("workOrders.actions.searchPlaceholder")}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
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
      {canCreate ? (
        <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
          {t("workOrders.actions.newWorkOrder")}
        </Button>
      ) : null}
    </>
  );
}
