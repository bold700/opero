import { useTranslation } from "react-i18next";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";

// Right-side actions in the materials top bar: search + add material.
export function MaterialsActions() {
  const { t } = useTranslation();
  return (
    <>
      <TextField
        size="small"
        placeholder={t("materials.searchPlaceholder")}
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
        {t("materials.addMaterial")}
      </Button>
    </>
  );
}
