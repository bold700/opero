import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import { useTranslation } from "react-i18next";
import { NewButton } from "../../../components/NewButton";

// Right-side actions in the projects top bar: search + new project (admin).
export function ProjectsActions({
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
        placeholder={t("projects.actions.searchPlaceholder")}
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
        <NewButton label={t("projects.actions.newProject")} onClick={onCreate} />
      ) : null}
    </>
  );
}
