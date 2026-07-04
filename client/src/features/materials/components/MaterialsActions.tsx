import { useTranslation } from "react-i18next";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import { NewButton } from "../../../components/NewButton";

// Right-side actions in the materials top bar: search + add material.
// Search is controlled by the page; create is admin-only.
export function MaterialsActions({
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
      {canCreate ? (
        <NewButton label={t("materials.addMaterial")} onClick={onCreate} />
      ) : null}
    </>
  );
}
