import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { WorkOrder } from "../api";
import { SortableZone } from "./SortableZone";
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
  onReorderZones,
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
  // Drag reorder: move activeTaskId into overTaskId's slot. Office-only.
  onReorderZones: (activeTaskId: string, overTaskId: string) => void;
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

  // Only the office can reorder (it's a scope change), and only when there's
  // more than one zone. A small activation distance so a tap that turns out to
  // be a click on a field inside the card doesn't start a drag.
  const canDrag = canManageZones && !busy && tasks.length > 1;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    onReorderZones(String(active.id), String(over.id));
  };

  const renderZone = (task: (typeof tasks)[number], dragHandle?: React.ReactNode) => (
    <ZoneCard
      task={task}
      canWrite={canWrite}
      canEditScope={canEditScope}
      canManageZones={canManageZones}
      showPrices={showPrices}
      showMargin={showMargin}
      busy={busy}
      dragHandle={dragHandle}
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
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {tasks.length === 0 ? (
        <Box sx={{ color: "text.secondary" }}>
          {t("workOrderDetail.zone.empty")}
        </Box>
      ) : canDrag ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tasks.map((zone) => zone.id)} strategy={verticalListSortingStrategy}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              {tasks.map((task) => (
                <SortableZone key={task.id} id={task.id}>
                  {(dragHandle) => renderZone(task, dragHandle)}
                </SortableZone>
              ))}
            </Box>
          </SortableContext>
        </DndContext>
      ) : (
        tasks.map((task) => <Box key={task.id}>{renderZone(task)}</Box>)
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
