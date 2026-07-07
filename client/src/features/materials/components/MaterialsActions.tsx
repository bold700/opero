import { useTranslation } from "react-i18next";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Box from "@mui/material/Box";
import SearchIcon from "@mui/icons-material/Search";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import { NewButton } from "../../../components/NewButton";
import { TAP_TARGET } from "../../../theme/tokens";

// Right-side actions in the materials top bar: search + manage-categories + add
// material. Search is controlled by the page; manage/create are admin-only.
export function MaterialsActions({
  search,
  onSearch,
  onCreate,
  onManageCategories,
  canCreate,
}: {
  search: string;
  onSearch: (value: string) => void;
  onCreate: () => void;
  onManageCategories: () => void;
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
        <>
          {/* Manage categories — labeled on desktop, icon-only on mobile. */}
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            <Button
              variant="outlined"
              startIcon={<LabelOutlinedIcon />}
              onClick={onManageCategories}
              sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
            >
              {t("materials.categoryManager.open")}
            </Button>
          </Box>
          <Box sx={{ display: { xs: "block", sm: "none" } }}>
            <Tooltip title={t("materials.categoryManager.open")}>
              <IconButton
                aria-label={t("materials.categoryManager.open")}
                onClick={onManageCategories}
                sx={{ width: TAP_TARGET, height: TAP_TARGET }}
              >
                <LabelOutlinedIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <NewButton label={t("materials.addMaterial")} onClick={onCreate} />
        </>
      ) : null}
    </>
  );
}
