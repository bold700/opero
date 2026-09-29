import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import { NewButton } from "../../../components/NewButton";

// Right-side actions in the work orders top bar: search + new order.
// Search is controlled by the page (client-side filter); "Nieuwe werkbon"
// opens the create dialog. Create is hidden for clients (read-only role).
export function WorkOrdersActions({
  search,
  onSearch,
  onCreate,
  canCreate,
  filterAction,
}: {
  search: string;
  onSearch: (value: string) => void;
  onCreate: () => void;
  canCreate: boolean;
  filterAction?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <TextField
        size="small"
        placeholder={t("workOrders.actions.searchPlaceholder")}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        sx={{ flex: { xs: 1, sm: "0 0 auto" }, width: { sm: 280 }, minWidth: 0 }}
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
      {filterAction}
      {canCreate ? (
        <NewButton label={t("workOrders.actions.newWorkOrder")} onClick={onCreate} />
      ) : null}
    </>
  );
}
