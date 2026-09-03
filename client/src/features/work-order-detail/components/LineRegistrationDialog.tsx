import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { HAIRLINE } from "../../../theme/tokens";
import type { WorkOrderMaterial } from "../api";

// Everything a monteur REGISTERS on one line, in one place, opened from the
// line itself: progress per day (Voortgang) and stock in/out (Voorraad). The
// same two-tab shape as the line-add dialog. Ticking a line done stays on the
// row; changing what was sold stays in the edit dialog.
export function LineRegistrationDialog({
  material,
  canWrite,
  canDeleteEntries,
  busy,
  onClose,
  onLogProgress,
  onDeleteProgress,
  onSaveStock,
}: {
  /** The line being registered; null → closed. */
  material: WorkOrderMaterial | null;
  canWrite: boolean;
  canDeleteEntries: boolean;
  busy: boolean;
  onClose: () => void;
  onLogProgress: (input: { amount: number; day?: string }) => void;
  onDeleteProgress: (entryId: string) => void;
  onSaveStock: (input: { used?: number; issued?: number; returned?: number }) => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"progress" | "stock">("progress");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [issued, setIssued] = useState("");
  const [used, setUsed] = useState("");
  const [returned, setReturned] = useState("");

  // Seed per line (not per refetch: the row object is replaced after every
  // mutation while the dialog stays open on the same line).
  useEffect(() => {
    if (!material) return;
    setTab("progress");
    setAmount("");
    setDay(new Date().toISOString().slice(0, 10));
    setIssued(material.issuedQuantity != null ? String(material.issuedQuantity) : "");
    setUsed(material.usedQuantity != null ? String(material.usedQuantity) : "");
    setReturned(material.returnedQuantity != null ? String(material.returnedQuantity) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material?.id]);

  if (!material) return null;
  const m = material;

  // --- Voortgang ---
  const amountNum = Number(amount.trim().replace(",", "."));
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;
  const pct = m.quantity > 0 ? Math.min(100, Math.round((m.progressTotal / m.quantity) * 100)) : 0;
  const log = () => {
    if (!amountOk) return;
    onLogProgress({ amount: amountNum, day: day || undefined });
    setAmount("");
  };

  // --- Voorraad ---
  const parse = (raw: string): number | undefined => {
    const s = raw.trim().replace(",", ".");
    if (s === "") return undefined;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const issuedNum = parse(issued);
  const usedNum = parse(used);
  const returnedNum = parse(returned);
  const stockInvalid =
    (issued.trim() !== "" && issuedNum === undefined) ||
    (used.trim() !== "" && usedNum === undefined) ||
    (returned.trim() !== "" && returnedNum === undefined);
  const stockAny = issuedNum !== undefined || usedNum !== undefined || returnedNum !== undefined;
  const unaccounted =
    issuedNum !== undefined ? issuedNum - (usedNum ?? 0) - (returnedNum ?? 0) : null;

  const title = m.name || m.label || t("workOrderDetail.line.unnamed");

  return (
    <ResponsiveDialog open onClose={busy ? undefined : onClose} maxWidth="sm" title={title} stableHeight>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={tab}
          onChange={(_, v) => {
            if (v) setTab(v as "progress" | "stock");
          }}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="progress">{t("workOrderDetail.progress.title")}</ToggleButton>
          <ToggleButton value="stock">{t("workOrderDetail.stock.title")}</ToggleButton>
        </ToggleButtonGroup>

        {tab === "progress" ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                {t("workOrderDetail.progress.status", { total: m.progressTotal, target: m.quantity, unit: m.unit })}
              </Typography>
              <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4 }} />
            </Box>

            {m.progressEntries.length > 0 ? (
              <Box>
                {m.progressEntries.map((e) => (
                  <Box
                    key={e.id}
                    sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.75, borderBottom: `1px solid ${HAIRLINE}`, "&:last-of-type": { borderBottom: 0 } }}
                  >
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {e.day} · {e.amount} {m.unit}
                      {e.employeeName ? (
                        <Box component="span" sx={{ color: "text.secondary" }}>{` · ${e.employeeName}`}</Box>
                      ) : null}
                    </Typography>
                    {canDeleteEntries ? (
                      <IconButton size="small" aria-label={t("common.actions.delete")} onClick={() => onDeleteProgress(e.id)} disabled={busy}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {t("workOrderDetail.progress.empty")}
              </Typography>
            )}

            {canWrite ? (
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                <TextField
                  label={t("workOrderDetail.progress.amountLabel", { unit: m.unit })}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={busy}
                  size="small"
                  slotProps={{ htmlInput: { inputMode: "decimal" } }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label={t("workOrderDetail.progress.dayLabel")}
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  disabled={busy}
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ width: 170 }}
                />
                <Button variant="contained" onClick={log} disabled={busy || !amountOk}>
                  {t("workOrderDetail.progress.log")}
                </Button>
              </Box>
            ) : null}
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {t("workOrderDetail.stock.needed", { quantity: m.quantity, unit: m.unit })}
              {m.onSite ? ` · ${t("workOrderDetail.stock.onSiteHint")}` : ""}
            </Typography>
            <TextField
              label={t("workOrderDetail.stock.issued")}
              value={issued}
              onChange={(e) => setIssued(e.target.value)}
              disabled={busy || !canWrite}
              size="small"
              slotProps={{ htmlInput: { inputMode: "decimal" } }}
            />
            <TextField
              label={t("workOrderDetail.stock.used")}
              value={used}
              onChange={(e) => setUsed(e.target.value)}
              disabled={busy || !canWrite}
              size="small"
              slotProps={{ htmlInput: { inputMode: "decimal" } }}
            />
            <TextField
              label={t("workOrderDetail.stock.returned")}
              value={returned}
              onChange={(e) => setReturned(e.target.value)}
              disabled={busy || !canWrite}
              size="small"
              slotProps={{ htmlInput: { inputMode: "decimal" } }}
            />
            {unaccounted !== null ? (
              <Typography variant="body2" sx={{ fontWeight: 600, color: unaccounted > 0 ? "warning.main" : "text.secondary" }}>
                {unaccounted > 0
                  ? t("workOrderDetail.stock.unaccounted", { quantity: unaccounted, unit: m.unit })
                  : t("workOrderDetail.stock.accounted")}
              </Typography>
            ) : null}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {tab === "stock" && canWrite ? (
          <>
            <Button onClick={onClose} disabled={busy}>{t("common.actions.cancel")}</Button>
            <Button
              variant="contained"
              onClick={() => onSaveStock({ issued: issuedNum, used: usedNum, returned: returnedNum })}
              disabled={busy || stockInvalid || !stockAny}
            >
              {t("common.actions.save")}
            </Button>
          </>
        ) : (
          <Button onClick={onClose} disabled={busy}>{t("common.actions.close")}</Button>
        )}
      </DialogActions>
    </ResponsiveDialog>
  );
}
