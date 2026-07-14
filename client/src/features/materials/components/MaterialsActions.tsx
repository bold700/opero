import { useTranslation } from "react-i18next";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";

// Right-side actions in the materials top bar: search only (the catalog is
// read-only — parts come from the seeded price lists, not created here).
export function MaterialsActions({
  search,
  onSearch,
}: {
  search: string;
  onSearch: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <TextField
      size="small"
      placeholder={t("materials.searchPlaceholder")}
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
  );
}
