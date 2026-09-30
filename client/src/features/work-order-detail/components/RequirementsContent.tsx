import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import HandymanOutlinedIcon from "@mui/icons-material/HandymanOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { HAIRLINE, SPACING, TAP_TARGET } from "../../../theme/tokens";
import type { WorkOrder, WorkOrderRequirement } from "../api";

export function RequirementsContent({
  workOrder,
  canCheck,
  canManage,
  busy,
  onToggleTaskMaterial,
  onToggleManual,
  onAdd,
  onDelete,
}: {
  workOrder: WorkOrder;
  canCheck: boolean;
  canManage: boolean;
  busy: boolean;
  onToggleTaskMaterial: (materialId: string, done: boolean) => void;
  onToggleManual: (requirementId: string, done: boolean) => void;
  onAdd: (input: {
    name: string;
    kind: "material" | "tool";
    quantity?: number;
    unit?: string;
  }) => void;
  onDelete: (requirementId: string) => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<"material" | "tool">("material");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");

  const taskMaterials = workOrder.tasks.flatMap((task) =>
    task.materials
      .filter((material) => !material.isExtraWork && (material.label || material.name).trim())
      .map((material) => ({ material, task })),
  );

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const parsedQuantity = quantity ? Number(quantity) : undefined;
    onAdd({
      name: trimmedName,
      kind,
      ...(parsedQuantity && parsedQuantity > 0 ? { quantity: parsedQuantity } : {}),
      ...(unit.trim() ? { unit: unit.trim() } : {}),
    });
    setName("");
    setQuantity("");
    setUnit("");
  };

  const manualItem = (item: WorkOrderRequirement) => (
    <ListItem
      key={item.id}
      disableGutters
      secondaryAction={
        canManage ? (
          <IconButton
            aria-label={t("workOrderDetail.requirements.delete")}
            disabled={busy}
            onClick={() => onDelete(item.id)}
            sx={{ width: TAP_TARGET, height: TAP_TARGET }}
          >
            <DeleteOutlineIcon />
          </IconButton>
        ) : undefined
      }
      sx={{ borderBottom: `1px solid ${HAIRLINE}`, pr: canManage ? 6 : 0 }}
    >
      <ListItemIcon sx={{ minWidth: TAP_TARGET }}>
        <Checkbox
          edge="start"
          checked={item.done}
          disabled={!canCheck || busy}
          onChange={(event) => onToggleManual(item.id, event.target.checked)}
          slotProps={{ input: { "aria-label": item.name } }}
        />
      </ListItemIcon>
      {item.kind === "tool" ? (
        <HandymanOutlinedIcon color="action" sx={{ mr: SPACING.itemGap }} />
      ) : (
        <Inventory2OutlinedIcon color="action" sx={{ mr: SPACING.itemGap }} />
      )}
      <ListItemText
        primary={item.name}
        secondary={
          item.quantity
            ? t("workOrderDetail.requirements.quantity", {
                quantity: item.quantity,
                unit: item.unit ?? "",
              })
            : t(`workOrderDetail.requirements.kind.${item.kind}`)
        }
        sx={{ textDecoration: item.done ? "line-through" : "none" }}
      />
    </ListItem>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {t("workOrderDetail.requirements.fromTasks")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("workOrderDetail.requirements.fromTasksHint")}
        </Typography>
        {taskMaterials.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: SPACING.itemGap }}>
            {t("workOrderDetail.requirements.noTaskMaterials")}
          </Typography>
        ) : (
          <List disablePadding sx={{ mt: SPACING.itemGap }}>
            {taskMaterials.map(({ material, task }) => (
              <ListItem
                key={material.id}
                disableGutters
                sx={{ borderBottom: `1px solid ${HAIRLINE}` }}
              >
                <ListItemIcon sx={{ minWidth: TAP_TARGET }}>
                  <Checkbox
                    edge="start"
                    checked={material.requirementDone}
                    disabled={!canCheck || busy}
                    onChange={(event) =>
                      onToggleTaskMaterial(material.id, event.target.checked)
                    }
                    slotProps={{
                      input: { "aria-label": material.label || material.name },
                    }}
                  />
                </ListItemIcon>
                <Inventory2OutlinedIcon color="action" sx={{ mr: SPACING.itemGap }} />
                <ListItemText
                  primary={material.label || material.name}
                  secondary={t("workOrderDetail.requirements.taskMaterialMeta", {
                    quantity: material.quantity,
                    unit: material.unit,
                    task: task.description || t("workOrderDetail.zone.untitled"),
                  })}
                  sx={{
                    textDecoration: material.requirementDone ? "line-through" : "none",
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {t("workOrderDetail.requirements.manual")}
        </Typography>
        {(workOrder.requirements ?? []).length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: SPACING.itemGap }}>
            {t("workOrderDetail.requirements.noManual")}
          </Typography>
        ) : (
          <List disablePadding sx={{ mt: SPACING.itemGap }}>
            {(workOrder.requirements ?? []).map(manualItem)}
          </List>
        )}
      </Box>

      {canManage ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.itemGap }}>
          <Divider />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t("workOrderDetail.requirements.addTitle")}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 2fr" },
              gap: SPACING.itemGap,
            }}
          >
            <TextField
              select
              label={t("workOrderDetail.requirements.kindLabel")}
              value={kind}
              onChange={(event) => setKind(event.target.value as "material" | "tool")}
              disabled={busy}
            >
              <MenuItem value="material">
                {t("workOrderDetail.requirements.kind.material")}
              </MenuItem>
              <MenuItem value="tool">
                {t("workOrderDetail.requirements.kind.tool")}
              </MenuItem>
            </TextField>
            <TextField
              label={t("workOrderDetail.requirements.nameLabel")}
              placeholder={t("workOrderDetail.requirements.namePlaceholder")}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
            />
            <TextField
              type="number"
              label={t("workOrderDetail.requirements.quantityLabel")}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              slotProps={{ htmlInput: { min: 0, step: "any" } }}
              disabled={busy}
            />
            <TextField
              label={t("workOrderDetail.requirements.unitLabel")}
              placeholder={t("workOrderDetail.requirements.unitPlaceholder")}
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              disabled={busy}
            />
          </Box>
          <Button variant="contained" onClick={submit} disabled={busy || !name.trim()}>
            {t("workOrderDetail.requirements.add")}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
