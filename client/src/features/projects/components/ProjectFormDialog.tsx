import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SelectField } from "../../../components/SelectField";
import { getCustomers, type CustomerOption } from "../../work-orders/create-api";
import { getWorkTypes, type WorkTypeOption } from "../../work-order-detail/api";
import type { ProjectDetail, ProjectInput } from "../api";

// Create or edit a project. Create needs a customer + name + optional work type;
// edit keeps the customer fixed and lets you change name / work type / notes.
// A werkbon is added later from the project detail screen.
export function ProjectFormDialog({
  open,
  project,
  busy,
  error,
  onClose,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  /** Pass a project to edit, omit/null to create. */
  project?: ProjectDetail | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: ProjectInput) => void;
  onUpdate: (patch: { name?: string; description?: string; instructions?: string; workTypeId?: string | null }) => void;
}) {
  const { t } = useTranslation();
  const editing = Boolean(project);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkTypeOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [workTypeId, setWorkTypeId] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    if (!open) return;
    getCustomers().then(setCustomers).catch(() => setCustomers([]));
    getWorkTypes().then(setWorkTypes).catch(() => setWorkTypes([]));
    // Seed fields from the project when editing; clear when creating.
    setCustomerId(project?.customerId ?? "");
    setName(project?.name ?? "");
    setWorkTypeId(project?.workTypeId ?? "");
    setDescription(project?.description ?? "");
    setInstructions(project?.instructions ?? "");
  }, [open, project]);

  // Create needs a customer; edit has one already — always submittable.
  const canSubmit = editing ? true : Boolean(customerId);

  const submit = () => {
    if (editing) {
      onUpdate({
        name: name.trim() || undefined,
        description: description.trim(),
        instructions: instructions.trim(),
        // null clears the work type; undefined leaves it (but we always send it).
        workTypeId: workTypeId || null,
      });
    } else {
      onCreate({
        customerId,
        name: name.trim() || undefined,
        workTypeId: workTypeId || undefined,
        notes: description.trim() || undefined,
      });
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      title={editing ? t("projects.form.editTitle") : t("projects.form.createTitle")}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        {editing ? t("projects.form.editTitle") : t("projects.form.createTitle")}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          {editing ? (
            <TextField
              label={t("projects.form.customer")}
              value={project?.customerName ?? ""}
              disabled
              size="small"
            />
          ) : (
            <SelectField
              label={t("projects.form.customer")}
              value={customerId}
              onChange={setCustomerId}
              disabled={busy}
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
          )}

          <TextField
            label={t("projects.form.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            size="small"
            autoFocus={!editing}
          />

          <SelectField
            label={t("projects.form.workType")}
            value={workTypeId}
            onChange={setWorkTypeId}
            disabled={busy}
            options={[
              { value: "", label: t("projects.form.workTypeNone") },
              ...workTypes.map((w) => ({ value: w.id, label: w.name })),
            ]}
          />

          <TextField
            label={t("projects.form.description")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
            size="small"
            multiline
            minRows={2}
          />

          {/* Work instructions are a project-level field, editable when editing. */}
          {editing ? (
            <TextField
              label={t("projects.detail.instructions")}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={busy}
              size="small"
              multiline
              minRows={2}
            />
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={!canSubmit || busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {editing ? t("common.actions.save") : t("projects.form.create")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
