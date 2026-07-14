import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { Card } from "../../../components/Card";
import { HAIRLINE } from "../../../theme/tokens";
import { euro } from "../constants";
import type {
  WorkOrder,
  WorkOrderTask,
  WorkTypeOption,
  AssigneeOption,
} from "../api";
import { MaterialLine } from "./MaterialLine";
import { AddMaterialDialog } from "./AddMaterialDialog";

// The tasks (zones) panel: add tasks, rename them inline, toggle done, and
// manage each task's materials. `canWrite` gates editing; `showPrices` hides
// money for technicians. Every mutation returns the fresh work order via the
// callbacks, which the page refetches.
export function TasksPanel({
  workOrder,
  canWrite,
  showPrices,
  busy,
  workTypes,
  assignees,
  onAddTask,
  onRenameTask,
  onSetTaskType,
  onAssignTask,
  onDeleteTask,
  onToggleTask,
  onAddFromCatalog,
  onDeleteMaterial,
  onToggleMaterial,
}: {
  workOrder: WorkOrder;
  canWrite: boolean;
  showPrices: boolean;
  busy: boolean;
  workTypes: WorkTypeOption[];
  assignees: AssigneeOption[];
  onAddTask: () => void;
  onRenameTask: (taskId: string, description: string) => void;
  onSetTaskType: (taskId: string, workTypeId: string | null) => void;
  onAssignTask: (taskId: string, assigneeId: string | null) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onAddFromCatalog: (taskId: string, input: { variantId: string; quantity: number }) => void;
  onDeleteMaterial: (matId: string) => void;
  onToggleMaterial: (matId: string) => void;
}) {
  const { t } = useTranslation();
  const { tasks } = workOrder;

  return (
    <Card noPadding>
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("workOrderDetail.tasks.title")}
        </Typography>
        {canWrite ? (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={onAddTask}
            disabled={busy}
          >
            {t("workOrderDetail.tasks.addTask")}
          </Button>
        ) : null}
      </Box>

      {tasks.length === 0 ? (
        <Box sx={{ px: { xs: 2, md: 3 }, py: 4, color: "text.secondary" }}>
          {t("workOrderDetail.tasks.emptyHint", {
            hint: canWrite ? t("workOrderDetail.tasks.emptyHintAction") : "",
          })}
        </Box>
      ) : (
        tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            canWrite={canWrite}
            showPrices={showPrices}
            busy={busy}
            workTypes={workTypes}
            assignees={assignees}
            onRename={(desc) => onRenameTask(task.id, desc)}
            onSetType={(workTypeId) => onSetTaskType(task.id, workTypeId)}
            onAssign={(assigneeId) => onAssignTask(task.id, assigneeId)}
            onDeleteTask={() => onDeleteTask(task.id)}
            onToggleTask={() => onToggleTask(task.id)}
            onAddFromCatalog={(input) => onAddFromCatalog(task.id, input)}
            onDeleteMaterial={onDeleteMaterial}
            onToggleMaterial={onToggleMaterial}
          />
        ))
      )}
    </Card>
  );
}

function TaskRow({
  task,
  canWrite,
  showPrices,
  busy,
  workTypes,
  assignees,
  onRename,
  onSetType,
  onAssign,
  onDeleteTask,
  onToggleTask,
  onAddFromCatalog,
  onDeleteMaterial,
  onToggleMaterial,
}: {
  task: WorkOrderTask;
  canWrite: boolean;
  showPrices: boolean;
  busy: boolean;
  workTypes: WorkTypeOption[];
  assignees: AssigneeOption[];
  onRename: (description: string) => void;
  onSetType: (workTypeId: string | null) => void;
  onAssign: (assigneeId: string | null) => void;
  onDeleteTask: () => void;
  onToggleTask: () => void;
  onAddFromCatalog: (input: { variantId: string; quantity: number }) => void;
  onDeleteMaterial: (matId: string) => void;
  onToggleMaterial: (matId: string) => void;
}) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.description);

  const lineTotal = task.materials.reduce(
    (sum, m) => sum + m.quantity * (m.unitPrice ?? 0),
    0,
  );

  const startEditing = () => {
    if (!canWrite || busy) return;
    setDraft(task.description);
    setEditing(true);
  };

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    // Only fire the mutation if the description actually changed.
    if (next !== task.description) onRename(next);
  };

  // Aligns sub-rows under the task title (past the checkbox). Tightened on xs so
  // full-width material inputs have room next to the card padding.
  const INDENT = { xs: 1.5, md: 4.5 };

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5, borderBottom: `1px solid ${HAIRLINE}` }}>
      {/* Title row: checkbox · name · (right) total + delete */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Checkbox
          checked={task.done}
          onChange={onToggleTask}
          disabled={!canWrite || busy}
          sx={{ p: { xs: 1.25, md: 0.5 } }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <TextField
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                } else if (e.key === "Escape") {
                  setEditing(false);
                }
              }}
              placeholder={t("workOrderDetail.tasks.namePlaceholder")}
              size="small"
              fullWidth
              autoFocus
            />
          ) : (
            <Typography
              onClick={startEditing}
              title={canWrite ? t("workOrderDetail.tasks.renameHint") : undefined}
              sx={{
                fontWeight: 600,
                cursor: canWrite ? "text" : "default",
                textDecoration: task.done ? "line-through" : "none",
                color: task.description
                  ? task.done
                    ? "text.secondary"
                    : "text.primary"
                  : "text.disabled",
              }}
            >
              {task.description || t("workOrderDetail.tasks.unnamed")}
            </Typography>
          )}
        </Box>

        {showPrices && lineTotal > 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600, whiteSpace: "nowrap" }}>
            {euro(lineTotal)}
          </Typography>
        ) : null}
        {canWrite ? (
          <IconButton
            size="small"
            aria-label={t("workOrderDetail.task.delete")}
            onClick={onDeleteTask}
            disabled={busy}
            sx={{ p: { xs: 1.25, md: 0.5 } }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        ) : null}
      </Box>

      {/* Per-zone work type + assignee */}
      {canWrite ? (
        <Box sx={{ display: "flex", gap: 1.5, mt: 1.5, pl: INDENT, flexWrap: "wrap" }}>
          <TextField
            select
            size="small"
            label={t("workOrderDetail.tasks.workType")}
            value={task.workTypeId ?? ""}
            onChange={(e) => onSetType(e.target.value || null)}
            disabled={busy}
            sx={{ minWidth: { sm: 200 }, width: { xs: "100%", sm: "auto" }, flex: { sm: 1 } }}
          >
            <MenuItem value="">{t("workOrderDetail.tasks.workTypeNone")}</MenuItem>
            {workTypes.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={t("workOrderDetail.tasks.assignee")}
            value={task.assigneeId ?? ""}
            onChange={(e) => onAssign(e.target.value || null)}
            disabled={busy}
            sx={{ minWidth: { sm: 200 }, width: { xs: "100%", sm: "auto" }, flex: { sm: 1 } }}
          >
            <MenuItem value="">{t("workOrderDetail.tasks.assigneeNone")}</MenuItem>
            {assignees.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      ) : task.workTypeName || task.assigneeName ? (
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5, pl: INDENT }}>
          {[task.workTypeName, task.assigneeName].filter(Boolean).join(" · ")}
        </Typography>
      ) : null}

      {/* Materials */}
      <Box sx={{ pl: INDENT, mt: 2 }}>
        {task.materials.length > 0 ? (
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}
          >
            {t("workOrderDetail.tasks.materialsLabel")}
          </Typography>
        ) : null}
        {task.materials.map((m) => (
          <MaterialLine
            key={m.id}
            material={m}
            canWrite={canWrite}
            showPrices={showPrices}
            busy={busy}
            onToggle={() => onToggleMaterial(m.id)}
            onDelete={() => onDeleteMaterial(m.id)}
          />
        ))}

        {canWrite ? (
          // Single add flow: pick a part from the materials catalog (the
          // supplier price lists). Name/unit/price resolve server-side.
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setPickerOpen(true)}
            disabled={busy}
            sx={{ mt: 0.5 }}
          >
            {t("workOrderDetail.tasks.addMaterial")}
          </Button>
        ) : null}
      </Box>

      <AddMaterialDialog
        open={pickerOpen}
        busy={busy}
        onClose={() => setPickerOpen(false)}
        onAdd={(input) => {
          onAddFromCatalog(input);
          setPickerOpen(false);
        }}
      />
    </Box>
  );
}
