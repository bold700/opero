import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { BottomSheet } from "../../../components/BottomSheet";
import { useIsMobile } from "../../../lib/useIsMobile";
import { HAIRLINE, PAGE_PADDING_RESPONSIVE, SPACING, TAP_TARGET } from "../../../theme/tokens";
import type {
  CompleteWorkDayEntry,
  StartWorkDayEntry,
  WorkDay,
  WorkOrder,
} from "../api";
import { WorkOrderSideSheet } from "./WorkOrderSideSheet";

function localIsoDay(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function numberValue(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

type EditableStartEntry = StartWorkDayEntry & { key: string };
type EditableCompleteEntry = CompleteWorkDayEntry & {
  name: string;
  unit: string;
  kind: string;
};

export function WorkDayMaterialSheet({
  open,
  mode,
  workOrder,
  workDay,
  busy,
  onClose,
  onStart,
  onComplete,
}: {
  open: boolean;
  mode: "start" | "complete" | "correct";
  workOrder: WorkOrder;
  workDay?: WorkDay;
  busy: boolean;
  onClose: () => void;
  onStart: (day: string, entries: StartWorkDayEntry[]) => Promise<void>;
  onComplete: (day: string, entries: CompleteWorkDayEntry[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [startEntries, setStartEntries] = useState<EditableStartEntry[]>([]);
  const [completeEntries, setCompleteEntries] = useState<EditableCompleteEntry[]>([]);
  const [extraName, setExtraName] = useState("");
  const [extraUnit, setExtraUnit] = useState("");
  const [extraKind, setExtraKind] = useState<"consumable" | "tool" | "other">("consumable");
  const [extraOpening, setExtraOpening] = useState("");
  const [extraBrought, setExtraBrought] = useState("");

  useEffect(() => {
    if (!open) return;
    if (mode === "start") {
      setStartEntries(
        workOrder.materialPlan
          .filter((item) => item.remainingQuantity > 0 || item.openingOnSite > 0 || Boolean(item.requirementId))
          .map((item, index) => ({
          key: item.taskMaterialId ?? item.requirementId ?? `carry-${index}`,
          taskMaterialId: item.taskMaterialId,
          requirementId: item.requirementId,
          name: item.name,
          unit: item.unit,
          kind: item.kind,
          plannedQuantity: item.plannedQuantity,
          openingOnSite: item.openingOnSite,
          brought: item.suggestedBrought,
          })),
      );
    } else if (workDay) {
      setCompleteEntries(
        workDay.entries.map((entry) => ({
          id: entry.id,
          name: entry.name,
          unit: entry.unit,
          kind: entry.kind,
          openingOnSite: entry.openingOnSite,
          brought: entry.brought,
          delivered: entry.delivered,
          installed: entry.installed,
          waste: entry.waste,
          leftOnSite: entry.leftOnSite,
          returned: entry.returned,
        })),
      );
    }
  }, [mode, open, workDay, workOrder.materialPlan]);

  const balanceErrors = useMemo(
    () => completeEntries.filter((entry) => {
      const available = entry.openingOnSite + entry.brought + entry.delivered;
      const accounted = entry.installed + entry.waste + entry.leftOnSite + entry.returned;
      return Math.abs(available - accounted) > 0.01;
    }),
    [completeEntries],
  );

  const updateStart = (key: string, field: "openingOnSite" | "brought", value: string) => {
    setStartEntries((entries) => entries.map((entry) =>
      entry.key === key ? { ...entry, [field]: numberValue(value) } : entry,
    ));
  };
  const updateComplete = (
    id: string,
    field: keyof CompleteWorkDayEntry,
    value: string,
  ) => {
    setCompleteEntries((entries) => entries.map((entry) =>
      entry.id === id ? { ...entry, [field]: numberValue(value) } : entry,
    ));
  };
  const addExtra = () => {
    const name = extraName.trim();
    if (!name) return;
    setStartEntries((entries) => [...entries, {
      key: `extra-${Date.now()}`,
      name,
      unit: extraUnit.trim(),
      kind: extraKind,
      openingOnSite: numberValue(extraOpening),
      brought: numberValue(extraBrought),
    }]);
    setExtraName("");
    setExtraUnit("");
    setExtraOpening("");
    setExtraBrought("");
  };

  const title = t(`workOrderDetail.workDay.sheet.${mode}Title`);
  const content = (
    <Box sx={{ p: PAGE_PADDING_RESPONSIVE, display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
      <Box>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t(`workOrderDetail.workDay.sheet.${mode}Hint`)}
        </Typography>
      </Box>

      {mode === "start" ? (
        <>
          {startEntries.map((entry) => (
            <Box key={entry.key} sx={{ pb: SPACING.sectionGap, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: SPACING.itemGap, mb: SPACING.itemGap }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{entry.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`workOrderDetail.workDay.kind.${entry.kind}`)}
                    {entry.plannedQuantity !== undefined
                      ? ` · ${t("workOrderDetail.workDay.planned", { quantity: entry.plannedQuantity, unit: entry.unit ?? "" })}`
                      : ""}
                  </Typography>
                </Box>
                {!entry.taskMaterialId && !entry.requirementId ? (
                  <IconButton
                    aria-label={t("workOrderDetail.workDay.removeExtra")}
                    onClick={() => setStartEntries((entries) => entries.filter((item) => item.key !== entry.key))}
                    sx={{ width: TAP_TARGET, height: TAP_TARGET }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                ) : null}
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: SPACING.itemGap }}>
                <TextField
                  type="number"
                  label={t("workOrderDetail.workDay.openingOnSite")}
                  value={entry.openingOnSite}
                  onChange={(event) => updateStart(entry.key, "openingOnSite", event.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: "any" } }}
                />
                <TextField
                  type="number"
                  label={t("workOrderDetail.workDay.brought")}
                  value={entry.brought}
                  onChange={(event) => updateStart(entry.key, "brought", event.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: "any" } }}
                />
              </Box>
            </Box>
          ))}

          <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.itemGap }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {t("workOrderDetail.workDay.addOther")}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: SPACING.itemGap }}>
              <TextField label={t("workOrderDetail.workDay.name")} value={extraName} onChange={(event) => setExtraName(event.target.value)} />
              <TextField select label={t("workOrderDetail.workDay.type")} value={extraKind} onChange={(event) => setExtraKind(event.target.value as typeof extraKind)}>
                <MenuItem value="consumable">{t("workOrderDetail.workDay.kind.consumable")}</MenuItem>
                <MenuItem value="tool">{t("workOrderDetail.workDay.kind.tool")}</MenuItem>
                <MenuItem value="other">{t("workOrderDetail.workDay.kind.other")}</MenuItem>
              </TextField>
              <TextField label={t("workOrderDetail.workDay.unit")} value={extraUnit} onChange={(event) => setExtraUnit(event.target.value)} />
              <TextField type="number" label={t("workOrderDetail.workDay.openingOnSite")} value={extraOpening} onChange={(event) => setExtraOpening(event.target.value)} slotProps={{ htmlInput: { min: 0, step: "any" } }} />
              <TextField type="number" label={t("workOrderDetail.workDay.brought")} value={extraBrought} onChange={(event) => setExtraBrought(event.target.value)} slotProps={{ htmlInput: { min: 0, step: "any" } }} />
            </Box>
            <Button startIcon={<AddIcon />} onClick={addExtra} disabled={!extraName.trim()}>
              {t("workOrderDetail.workDay.add")}
            </Button>
          </Box>

          <Button
            variant="contained"
            disabled={busy || startEntries.length === 0}
            onClick={async () => {
              await onStart(localIsoDay(), startEntries.map(({ key: _key, ...entry }) => entry));
              onClose();
            }}
          >
            {t("workOrderDetail.workDay.confirmStart")}
          </Button>
        </>
      ) : (
        <>
          {completeEntries.map((entry) => {
            const available = entry.openingOnSite + entry.brought + entry.delivered;
            const accounted = entry.installed + entry.waste + entry.leftOnSite + entry.returned;
            const difference = available - accounted;
            return (
              <Box key={entry.id} sx={{ pb: SPACING.sectionGap, borderBottom: `1px solid ${HAIRLINE}` }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{entry.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("workOrderDetail.workDay.available", { quantity: available, unit: entry.unit })}
                </Typography>
                <Box sx={{ mt: SPACING.itemGap, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 1fr" }, gap: SPACING.itemGap }}>
                  <TextField type="number" label={t("workOrderDetail.workDay.openingOnSite")} value={entry.openingOnSite} onChange={(event) => updateComplete(entry.id, "openingOnSite", event.target.value)} slotProps={{ htmlInput: { min: 0, step: "any" } }} />
                  <TextField type="number" label={t("workOrderDetail.workDay.brought")} value={entry.brought} onChange={(event) => updateComplete(entry.id, "brought", event.target.value)} slotProps={{ htmlInput: { min: 0, step: "any" } }} />
                  <TextField type="number" label={t("workOrderDetail.workDay.delivered")} value={entry.delivered} onChange={(event) => updateComplete(entry.id, "delivered", event.target.value)} slotProps={{ htmlInput: { min: 0, step: "any" } }} />
                  {entry.kind !== "tool" ? (
                    <>
                      <TextField type="number" label={t("workOrderDetail.workDay.installed")} value={entry.installed} onChange={(event) => updateComplete(entry.id, "installed", event.target.value)} slotProps={{ htmlInput: { min: 0, step: "any" } }} />
                      <TextField type="number" label={t("workOrderDetail.workDay.waste")} value={entry.waste} onChange={(event) => updateComplete(entry.id, "waste", event.target.value)} slotProps={{ htmlInput: { min: 0, step: "any" } }} />
                    </>
                  ) : null}
                  <TextField type="number" label={t("workOrderDetail.workDay.leftOnSite")} value={entry.leftOnSite} onChange={(event) => updateComplete(entry.id, "leftOnSite", event.target.value)} slotProps={{ htmlInput: { min: 0, step: "any" } }} />
                  <TextField type="number" label={t("workOrderDetail.workDay.returned")} value={entry.returned} onChange={(event) => updateComplete(entry.id, "returned", event.target.value)} slotProps={{ htmlInput: { min: 0, step: "any" } }} />
                </Box>
                <Typography variant="caption" color={Math.abs(difference) <= 0.01 ? "success.main" : "error.main"} sx={{ display: "block", mt: SPACING.itemGap }}>
                  {Math.abs(difference) <= 0.01
                    ? t("workOrderDetail.workDay.balanceClosed")
                    : t("workOrderDetail.workDay.balanceDifference", { quantity: Math.abs(difference), unit: entry.unit })}
                </Typography>
              </Box>
            );
          })}
          {balanceErrors.length > 0 ? (
            <Alert severity="warning">{t("workOrderDetail.workDay.balanceHint")}</Alert>
          ) : null}
          <Button
            variant="contained"
            disabled={busy || completeEntries.length === 0 || balanceErrors.length > 0 || !workDay}
            onClick={async () => {
              if (!workDay) return;
              await onComplete(workDay.day, completeEntries.map(({ name: _name, unit: _unit, kind: _kind, ...entry }) => entry));
              onClose();
            }}
          >
            {mode === "correct" ? t("workOrderDetail.workDay.saveCorrection") : t("workOrderDetail.workDay.confirmComplete")}
          </Button>
        </>
      )}
    </Box>
  );

  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={title}
        maxHeight="96dvh"
        scrollableContent
        header={
          <Box sx={{ px: PAGE_PADDING_RESPONSIVE, py: SPACING.itemGap, display: "flex", justifyContent: "flex-end", borderBottom: `1px solid ${HAIRLINE}` }}>
            <IconButton aria-label={t("common.actions.close")} onClick={onClose}><CloseIcon /></IconButton>
          </Box>
        }
      >
        <Box sx={{ overflowY: "auto" }}>{content}</Box>
      </BottomSheet>
    );
  }

  return (
    <WorkOrderSideSheet open={open} onClose={onClose} title={title} closeLabel={t("common.actions.close")}>
      {content}
    </WorkOrderSideSheet>
  );
}
