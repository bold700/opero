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
  canEditScope,
  canManageZones,
  showPrices,
  showMargin,
  busy,
  onAddZone,
  onRenameZone,
  onSetZoneNote,
  onDeleteZone,
  onAddLine,
  onAddCustomLine,
  onEditLine,
  onEditCustomLine,
  onDeleteLine,
  onToggleLine,
  onChangeLineQuantity,
  onUploadPhoto,
  onDeletePhoto,
}: {
  workOrder: WorkOrder;
  // Register on-site facts (technicians included). See WorkOrderDetail.
  canWrite: boolean;
  // Change what was sold: zone titles, line add/edit/delete. Office only.
  canEditScope: boolean;
  // Admin-only: adding/removing a zone. See ZoneCard's canManageZones.
  canManageZones: boolean;
  // 3-way price rule (admin: price+margin, client: price, technician: none).
  showPrices: boolean;
  showMargin: boolean;
  busy: boolean;
  onAddZone: () => void;
  onRenameZone: (taskId: string, description: string) => void;
  onSetZoneNote: (taskId: string, note: string) => void;
  onDeleteZone: (taskId: string) => void;
  onAddLine: (taskId: string, input: { variantId: string; quantity: number }) => void;
  onAddCustomLine: (
    taskId: string,
    input: { name: string; quantity: number; unit: string; unitPrice?: number },
  ) => void;
  onEditLine: (matId: string, input: { variantId: string; quantity: number }) => void;
  onEditCustomLine: (
    matId: string,
    input: { name: string; quantity: number; unit: string; unitPrice?: number },
  ) => void;
  onDeleteLine: (matId: string) => void;
  onToggleLine: (matId: string) => void;
  onChangeLineQuantity: (matId: string, quantity: number) => void;
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
            canEditScope={canEditScope}
            canManageZones={canManageZones}
            showPrices={showPrices}
            showMargin={showMargin}
            busy={busy}
            onRename={(desc) => onRenameZone(task.id, desc)}
            onSetNote={(note) => onSetZoneNote(task.id, note)}
            onDeleteZone={() => onDeleteZone(task.id)}
            onAddLine={(input) => onAddLine(task.id, input)}
            onAddCustomLine={(input) => onAddCustomLine(task.id, input)}
            onEditLine={onEditLine}
            onEditCustomLine={onEditCustomLine}
            onDeleteLine={onDeleteLine}
            onToggleLine={onToggleLine}
            onChangeLineQuantity={onChangeLineQuantity}
            onUploadPhoto={(kind, file) => onUploadPhoto(task.id, kind, file)}
            onDeletePhoto={(key) => onDeletePhoto(task.id, key)}
          />
        ))
      )}

      {canManageZones ? (
        <Box>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={onAddZone} disabled={busy}>
            {t("workOrderDetail.zone.add")}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
