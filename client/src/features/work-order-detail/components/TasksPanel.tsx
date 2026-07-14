import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import type { WorkOrder } from "../api";
import { ZoneCard } from "./ZoneCard";

// The zones section of a werkbon: one ZoneCard per WorkOrderTask, each holding
// its priced invoice-line rows (TAKEN), work description and photos. All
// mutations are lifted to the page (WorkOrderDetail), which refetches after each.
export function TasksPanel({
  workOrder,
  canWrite,
  showPrices,
  showMargin,
  busy,
  onAddZone,
  onRenameZone,
  onSetZoneNote,
  onDeleteZone,
  onAddLine,
  onDeleteLine,
  onToggleLine,
  onChangeLineQuantity,
  onChangeLineLabel,
  onUploadPhoto,
  onDeletePhoto,
}: {
  workOrder: WorkOrder;
  canWrite: boolean;
  showPrices: boolean;
  showMargin: boolean;
  busy: boolean;
  onAddZone: () => void;
  onRenameZone: (taskId: string, description: string) => void;
  onSetZoneNote: (taskId: string, note: string) => void;
  onDeleteZone: (taskId: string) => void;
  onAddLine: (taskId: string, input: { variantId: string; quantity: number }) => void;
  onDeleteLine: (matId: string) => void;
  onToggleLine: (matId: string) => void;
  onChangeLineQuantity: (matId: string, quantity: number) => void;
  onChangeLineLabel: (matId: string, label: string) => void;
  onUploadPhoto: (taskId: string, kind: "before" | "result", file: File) => void;
  onDeletePhoto: (taskId: string, key: string) => void;
}) {
  const { t } = useTranslation();
  const { tasks } = workOrder;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {tasks.length === 0 ? (
        <Box sx={{ color: "text.secondary" }}>
          {t("workOrderDetail.zone.empty")}
        </Box>
      ) : (
        tasks.map((task) => (
          <ZoneCard
            key={task.id}
            task={task}
            canWrite={canWrite}
            showPrices={showPrices}
            showMargin={showMargin}
            busy={busy}
            onRename={(desc) => onRenameZone(task.id, desc)}
            onSetNote={(note) => onSetZoneNote(task.id, note)}
            onDeleteZone={() => onDeleteZone(task.id)}
            onAddLine={(input) => onAddLine(task.id, input)}
            onDeleteLine={onDeleteLine}
            onToggleLine={onToggleLine}
            onChangeLineQuantity={onChangeLineQuantity}
            onChangeLineLabel={onChangeLineLabel}
            onUploadPhoto={(kind, file) => onUploadPhoto(task.id, kind, file)}
            onDeletePhoto={(key) => onDeletePhoto(task.id, key)}
          />
        ))
      )}

      {canWrite ? (
        <Box>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={onAddZone} disabled={busy}>
            {t("workOrderDetail.zone.add")}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
