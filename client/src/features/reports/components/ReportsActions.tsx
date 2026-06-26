import Button from "@mui/material/Button";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { useTranslation } from "react-i18next";

// Right-side action in the reports top bar: export.
export function ReportsActions() {
  const { t } = useTranslation();
  return (
    <Button variant="contained" startIcon={<FileDownloadOutlinedIcon />}>
      {t("reports.actions.export")}
    </Button>
  );
}
