import { useTranslation } from "react-i18next";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import { NewButton } from "../../../components/NewButton";

// Right-side actions in the material-detail top bar: search the material's
// variants + (admin) add a variant. Same shape as every other list screen, so
// the drill-down doesn't lose the search/add affordances the list has.
export function MaterialDetailActions({
  search,
  onSearch,
  canCreate,
  onCreate,
}: {
  search: string;
  onSearch: (value: string) => void;
  canCreate: boolean;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <TextField
        size="small"
        placeholder={t("materials.detail.searchPlaceholder")}
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
        <NewButton label={t("materials.variantForm.create")} onClick={onCreate} />
      ) : null}
    </>
  );
}
