import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import SearchIcon from "@mui/icons-material/Search";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { useTranslation } from "react-i18next";
import { NewButton } from "../../../components/NewButton";

// Right-side actions in the customers top bar: search + import + new customer.
// Search is controlled by the page (client-side filter); import + create are
// admin-only. Import pulls the customer list in from a Silvasoft Excel export.
export function CustomersActions({
  search,
  onSearch,
  onCreate,
  onImport,
  canCreate,
}: {
  search: string;
  onSearch: (value: string) => void;
  onCreate: () => void;
  onImport: () => void;
  canCreate: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <TextField
        size="small"
        placeholder={t("customers.actions.searchPlaceholder")}
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
      {canCreate ? (
        <Button
          variant="outlined"
          startIcon={<UploadFileOutlinedIcon />}
          onClick={onImport}
          sx={{ flexShrink: 0 }}
        >
          {t("customers.actions.import")}
        </Button>
      ) : null}
      {canCreate ? (
        <NewButton label={t("customers.actions.newCustomer")} onClick={onCreate} />
      ) : null}
    </>
  );
}
