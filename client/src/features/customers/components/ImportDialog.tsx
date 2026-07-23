import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import {
  previewSilvasoftImport,
  commitSilvasoftImport,
  type ImportPreview,
} from "../api";

// Import customers from a Silvasoft "Export → Excel" file. Two-step so the
// office sees what will happen before anything is written:
//   1. pick a .xlsx → we PREVIEW it (parse only, no writes)
//   2. review the counts (create / update / skipped) → confirm → COMMIT
// Re-importing the same file updates matched customers (by Silvasoft number)
// rather than duplicating them.
export function ImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  // Fires after a successful commit so the list can refresh + toast.
  onImported: (result: { created: number; updated: number }) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setBusy(false);
    setError(null);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!f) return;
    setFile(f);
    setPreview(null);
    setError(null);
    setBusy(true);
    try {
      setPreview(await previewSilvasoftImport(f));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("customers.import.previewError"));
      setFile(null);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await commitSilvasoftImport(file);
      onImported(result);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("customers.import.commitError"));
    } finally {
      setBusy(false);
    }
  };

  const canCommit =
    preview !== null && (preview.willCreate > 0 || preview.willUpdate > 0) && !busy;

  return (
    <ResponsiveDialog open={open} onClose={close} title={t("customers.import.title")}>
      <DialogTitle sx={{ fontWeight: 700 }}>{t("customers.import.title")}</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        {/* Pick file */}
        <Button
          variant="outlined"
          startIcon={<UploadFileOutlinedIcon />}
          onClick={pick}
          disabled={busy}
        >
          {file ? file.name : t("customers.import.pickFile")}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={onFile}
        />

        {busy && !preview ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {t("customers.import.reading")}
            </Typography>
          </Box>
        ) : null}

        {/* Preview summary */}
        {preview ? (
          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="body2">
              {t("customers.import.willCreate", { count: preview.willCreate })}
              {" · "}
              {t("customers.import.willUpdate", { count: preview.willUpdate })}
            </Typography>

            {preview.skipped.length > 0 ? (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {t("customers.import.skipped", { count: preview.skipped.length })}
                </Typography>
                {/* List the actual rows so the office knows WHICH customers
                    didn't import — "3 skipped" alone is useless. Backend sends
                    the sheet row number + whatever address it could find. */}
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {preview.skipped.map((s) => (
                    <Box component="li" key={s.row}>
                      <Typography variant="caption">
                        {t("customers.import.skippedRow", { row: s.row, detail: s.raw })}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Alert>
            ) : null}

            {preview.unmappedColumns.length > 0 ? (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {t("customers.import.unmapped", {
                  cols: preview.unmappedColumns.slice(0, 6).join(", "),
                })}
              </Typography>
            ) : null}

            {/* A short sample so the mapping is visible before committing. */}
            {preview.sample.length > 0 ? (
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                {preview.sample.map((c, i) => (
                  <Box
                    key={`${c.silvasoftId ?? "new"}-${i}`}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 1,
                      px: 1.5,
                      py: 0.75,
                      borderBottom: i < preview.sample.length - 1 ? "1px solid" : "none",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="body2" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", flexShrink: 0 }}>
                      {c.city}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : null}
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        <Button variant="contained" onClick={commit} disabled={!canCommit}>
          {busy && preview ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            t("customers.import.commit")
          )}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
