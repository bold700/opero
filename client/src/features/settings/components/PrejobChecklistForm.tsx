import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import CircularProgress from "@mui/material/CircularProgress";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { GroupLabel } from "./GroupLabel";
import { HAIRLINE } from "../../../theme/tokens";
import {
  getPrejobItems,
  createPrejobItem,
  updatePrejobItem,
  reorderPrejobItems,
  deletePrejobItem,
  type PrejobItem,
} from "../api";

// Admin edits the org's pre-job checklist (Controle vooraf on every werkbon).
// Only ACTIVE items are shown/managed here — removing an item is a soft remove
// server-side, so history stays intact. Order = drag-free up/down buttons,
// matching the app's other reorder UIs.
export function PrejobChecklistForm() {
  const { t } = useTranslation();
  const [items, setItems] = useState<PrejobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    try {
      const all = await getPrejobItems();
      setItems(all.filter((i) => i.active).sort((a, b) => a.ordinal - b.ordinal));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.prejobChecklist.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run a mutation, refresh, surface errors.
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      setToast(t("settings.prejobChecklist.saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.prejobChecklist.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    void run(async () => {
      await createPrejobItem(label);
      setNewLabel("");
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void run(() => reorderPrejobItems(next.map((i) => i.id)));
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <GroupLabel>{t("settings.prejobChecklist.itemsLabel")}</GroupLabel>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        {t("settings.prejobChecklist.help")}
      </Typography>

      {items.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {t("settings.prejobChecklist.empty")}
        </Typography>
      ) : (
        <Box sx={{ mb: 2 }}>
          {items.map((item, i) => (
            <Box
              key={item.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: 1,
                borderBottom: `1px solid ${HAIRLINE}`,
              }}
            >
              <TextField
                variant="standard"
                defaultValue={item.label}
                key={`${item.id}-${item.label}`}
                disabled={busy}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== item.label) void run(() => updatePrejobItem(item.id, { label: v }));
                }}
                sx={{ flex: 1 }}
              />
              <IconButton size="small" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={t("settings.prejobChecklist.moveUp")}>
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" disabled={busy || i === items.length - 1} onClick={() => move(i, 1)} aria-label={t("settings.prejobChecklist.moveDown")}>
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" color="error" disabled={busy} onClick={() => void run(() => deletePrejobItem(item.id))} aria-label={t("settings.prejobChecklist.remove")}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {/* Add a new item */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <TextField
          size="small"
          placeholder={t("settings.prejobChecklist.addPlaceholder")}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          disabled={busy}
          sx={{ flex: 1 }}
        />
        <Button variant="outlined" startIcon={<AddIcon />} onClick={add} disabled={busy || !newLabel.trim()}>
          {t("settings.prejobChecklist.add")}
        </Button>
      </Box>

      <Snackbar open={toast !== null} autoHideDuration={3000} onClose={() => setToast(null)} message={toast ?? ""} />
    </Box>
  );
}
