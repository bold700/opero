import Button from "@mui/material/Button";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";

// Right-side action in the reports top bar: export.
export function ReportsActions() {
  return (
    <Button variant="contained" startIcon={<FileDownloadOutlinedIcon />}>
      Export
    </Button>
  );
}
