import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";

// Right-side actions in the materials top bar: search + (admin) "New material".
// The catalog is user-managed — admins create/edit/delete materials & variants.
export function MaterialsActions({
  search,
  onSearch,
  canCreate,
  onCreate,
  filterAction,
}: {
  search: string;
  onSearch: (value: string) => void;
  canCreate: boolean;
  onCreate: () => void;
  filterAction?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flex: { xs: 1, sm: "0 0 auto" } }}>
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
      {filterAction}
      {canCreate ? (
        <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate} sx={{ flexShrink: 0 }}>
          {t("materials.form.create")}
        </Button>
      ) : null}
    </Box>
  );
}
