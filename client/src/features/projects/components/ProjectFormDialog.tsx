import { useEffect, useRef, useState } from "react";
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
import { useDirty } from "../../../lib/isDirty";
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
  onUpdate: (patch: {
    name?: string;
    referenceNumber?: string;
    contactName?: string;
    contactPhone?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    description?: string;
    instructions?: string;
    workTypeId?: string | null;
    customerId?: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const editing = Boolean(project);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkTypeOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  // The CLIENT's own order/PO/dossier number — never Opero's projectNumber,
  // which is generated server-side and is not editable here.
  const [referenceNumber, setReferenceNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  // Job-site address — edit only. On create it is derived from the chosen
  // location / the customer (see projects/routes.ts), so the form doesn't ask.
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [workTypeId, setWorkTypeId] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");

  // What the dialog was seeded with, so an untouched edit can't be saved.
  const initialValues = useRef<{
    customerId: string;
    name: string;
    referenceNumber: string;
    contactName: string;
    contactPhone: string;
    address: string;
    postalCode: string;
    city: string;
    workTypeId: string;
    description: string;
    instructions: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    getCustomers().then(setCustomers).catch(() => setCustomers([]));
    getWorkTypes().then(setWorkTypes).catch(() => setWorkTypes([]));
    // Seed fields from the project when editing; clear when creating.
    const seeded = {
      customerId: project?.customerId ?? "",
      name: project?.name ?? "",
      referenceNumber: project?.referenceNumber ?? "",
      contactName: project?.contactName ?? "",
      contactPhone: project?.contactPhone ?? "",
      address: project?.address ?? "",
      postalCode: project?.postalCode ?? "",
      city: project?.city ?? "",
      workTypeId: project?.workTypeId ?? "",
      description: project?.description ?? "",
      instructions: project?.instructions ?? "",
    };
    initialValues.current = seeded;
    setCustomerId(seeded.customerId);
    setName(seeded.name);
    setReferenceNumber(seeded.referenceNumber);
    setContactName(seeded.contactName);
    setContactPhone(seeded.contactPhone);
    setAddress(seeded.address);
    setPostalCode(seeded.postalCode);
    setCity(seeded.city);
    setWorkTypeId(seeded.workTypeId);
    setDescription(seeded.description);
    setInstructions(seeded.instructions);
  }, [open, project]);

  const dirty = useDirty(
    {
      customerId,
      name,
      referenceNumber,
      contactName,
      contactPhone,
      address,
      postalCode,
      city,
      workTypeId,
      description,
      instructions,
    },
    initialValues.current,
  );
  // Create needs a customer; edit needs an actual change — this used to be a
  // flat `true`, which offered Save on a project nobody had touched.
  const canSubmit = editing ? dirty : Boolean(customerId);

  const submit = () => {
    if (editing) {
      onUpdate({
        name: name.trim() || undefined,
        // Sent even when empty so clearing the field clears it server-side.
        referenceNumber: referenceNumber.trim(),
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        address: address.trim(),
        postalCode: postalCode.trim(),
        city: city.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        // null clears the work type; undefined leaves it (but we always send it).
        workTypeId: workTypeId || null,
        // Only send the customer when it actually changed — the backend treats
        // a switch as an access change (audit + activity entry), so an
        // unchanged id shouldn't look like one.
        ...(customerId && customerId !== project?.customerId ? { customerId } : {}),
      });
    } else {
      onCreate({
        customerId,
        name: name.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        // Left blank on purpose = "use the customer's own contact details": the
        // backend seeds contactName/contactPhone from the customer when these
        // are omitted, so an empty field must not be sent as "".
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
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

          {/* The customer is switchable, including when editing: picking the
              wrong one is an ordinary mistake and the job shouldn't have to be
              recreated to fix it. Switching MOVES the job between client
              portals (project.customerId gates client access), so the caller
              confirms — see ProjectInfoPanel / the projects page. */}
          <SelectField
            label={t("projects.form.customer")}
            value={customerId}
            onChange={setCustomerId}
            disabled={busy}
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
          {/* Switching moves the job between client portals, which isn't
              visible from the field itself — say so before it's saved. */}
          {editing && customerId && customerId !== project?.customerId ? (
            <Alert severity="warning">
              {t("projects.form.customerSwitchWarning", {
                from: project?.customerName ?? "",
                to: customers.find((c) => c.id === customerId)?.name ?? "",
              })}
            </Alert>
          ) : null}

          <TextField
            label={t("projects.form.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            size="small"
            autoFocus={!editing}
          />

          {/* The CLIENT's own order/PO number, as they quote it on the phone.
              Opero's own projectNumber is generated server-side and is NOT
              editable — the helper text spells that difference out. */}
          <TextField
            label={t("projects.form.referenceNumber")}
            helperText={t("projects.form.referenceNumberHelp")}
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            disabled={busy}
            size="small"
          />

          {/* Site contact. Left blank on create, the backend copies the
              customer's own contact details. */}
          <TextField
            label={t("projects.form.contactName")}
            helperText={editing ? undefined : t("projects.form.contactHelp")}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            disabled={busy}
            size="small"
          />

          <TextField
            label={t("projects.form.contactPhone")}
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            disabled={busy}
            size="small"
          />

          {/* Job-site address — edit only. On create it is derived from the
              chosen customer location / the customer's own address, so asking
              here would just invite conflicting input. */}
          {editing ? (
            <>
              <TextField
                label={t("projects.form.address")}
                helperText={t("projects.form.addressHelp")}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={busy}
                size="small"
              />
              <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5 }}>
                <TextField
                  label={t("projects.form.postalCode")}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  disabled={busy}
                  size="small"
                  sx={{ width: { xs: "100%", sm: 140 } }}
                />
                <TextField
                  label={t("projects.form.city")}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={busy}
                  size="small"
                  sx={{ flex: 1 }}
                />
              </Box>
            </>
          ) : null}

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
