import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SelectField } from "../../../components/SelectField";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Autocomplete from "@mui/material/Autocomplete";
import { useAuth } from "../../../auth/AuthContext";
import { isOffice } from "@opero/shared";
import {
  ContactPersonDialog,
  type ContactPersonDraft,
} from "../../../components/ContactPersonDialog";
import { FormSectionLabel } from "./FormSectionLabel";
import {
  getCustomers,
  getCustomerLocations,
  createCustomerLocation,
  getProjectsForCustomer,
  createProject,
  createWorkOrder,
  getCustomerContacts,
  getProjectContacts,
  checkDuplicateContact,
  createCustomerContact,
  linkCustomerContact,
  type CustomerOption,
  type LocationOption,
  type ProjectOption,
  type ContactPersonOption,
} from "../create-api";

const NEW_PROJECT = "__new__";
const NEW_LOCATION = "__new_location__";
const NEW_CONTACT = "__new_contact__";

type ContactPickerOption = ContactPersonOption & { createNew?: boolean };
const NEW_CONTACT_OPTION: ContactPickerOption = {
  id: NEW_CONTACT,
  customerId: "",
  name: "",
  firstName: "",
  lastName: "",
  createNew: true,
};

// "Nieuwe werkbon" flow: pick a customer → pick an existing project OR create a
// new one (name + job-site location) → create the work order. Work type +
// technician are set per task in the detail screen, not here.
export function CreateWorkOrderDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (workOrderId: string) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = isOffice(user?.role ?? "client");

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [contacts, setContacts] = useState<ContactPersonOption[]>([]);
  const [projectContactIds, setProjectContactIds] = useState<string[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [contactPersonIds, setContactPersonIds] = useState<string[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  // The CLIENT's own order/PO number for the new project — same field as the
  // full project form, so the inline shortcut doesn't create reference-less jobs.
  const [newProjectReference, setNewProjectReference] = useState("");
  const [locationId, setLocationId] = useState("");
  const [newLocation, setNewLocation] = useState({ label: "", address: "", postalCode: "", city: "" });
  const [title, setTitle] = useState("");
  // This visit's own description ("2e verdieping, week 38") — werkbon-level,
  // not the project's. Optional: left blank, the printed werkbon falls back to
  // the project's description.
  const [description, setDescription] = useState("");

  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [duplicateContact, setDuplicateContact] = useState<ContactPersonOption | null>(null);

  // Load customers when the dialog opens; reset everything when it closes.
  useEffect(() => {
    if (!open) {
      setCustomerId("");
      setProjects([]);
      setProjectId("");
      setContacts([]);
      setProjectContactIds([]);
      setContactPersonIds([]);
      setNewProjectName("");
      setNewProjectReference("");
      setLocationId("");
      setNewLocation({ label: "", address: "", postalCode: "", city: "" });
      setLocations([]);
      setTitle("");
      setDescription("");
      setError(null);
      setContactDialogOpen(false);
      setContactError(null);
      setDuplicateContact(null);
      return;
    }
    setLoadingCustomers(true);
    getCustomers()
      .then(setCustomers)
      .catch((e) => setError(e instanceof Error ? e.message : t("workOrders.create.customersLoadError")))
      .finally(() => setLoadingCustomers(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load that customer's projects + locations when the customer changes.
  useEffect(() => {
    if (!customerId) {
      setProjects([]);
      setProjectId("");
      setLocations([]);
      setLocationId("");
      setContacts([]);
      setProjectContactIds([]);
      setContactPersonIds([]);
      return;
    }
    setLoadingProjects(true);
    setProjectId("");
    setLocationId("");
    getProjectsForCustomer(customerId)
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : t("workOrders.create.projectsLoadError")))
      .finally(() => setLoadingProjects(false));
    getCustomerLocations(customerId).then(setLocations).catch(() => setLocations([]));
    getCustomerContacts(customerId)
      .then((rows) => {
        setContacts(rows);
        setContactPersonIds(rows.length === 1 ? [rows[0].id] : []);
      })
      .catch(() => setContacts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    if (!projectId || projectId === NEW_PROJECT) {
      setProjectContactIds([]);
      return;
    }
    let cancelled = false;
    getProjectContacts(projectId)
      .then((rows) => {
        if (cancelled) return;
        const ids = rows.map((row) => row.id);
        setProjectContactIds(ids);
        const available = contacts.filter((contact) => ids.includes(contact.id));
        setContactPersonIds((current) => {
          const validCurrent = current.filter((id) =>
            contacts.some((contact) => contact.id === id),
          );
          if (validCurrent.length > 0) {
            return validCurrent;
          }
          return available.length > 0
            ? available.map((contact) => contact.id)
            : contacts.length === 1
              ? [contacts[0].id]
              : [];
        });
      })
      .catch(() => setProjectContactIds([]));
    return () => {
      cancelled = true;
    };
  }, [projectId, contacts]);

  const creatingProject = projectId === NEW_PROJECT;
  const creatingLocation = locationId === NEW_LOCATION;

  const canSubmit = useMemo(() => {
    if (!customerId || !projectId) return false;
    if (creatingProject) {
      if (!newProjectName.trim()) return false;
      if (creatingLocation && !newLocation.address.trim()) return false;
    }
    return true;
  }, [customerId, projectId, creatingProject, newProjectName, creatingLocation, newLocation.address]);

  const saveNewContact = async (draft: ContactPersonDraft) => {
    if (!customerId) return;
    setContactBusy(true);
    setContactError(null);
    setDuplicateContact(null);
    const input = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      role: draft.role.trim() || undefined,
      email: draft.email.trim() || undefined,
      phone: draft.phone.trim() || undefined,
      notes: draft.notes.trim() || undefined,
    };
    try {
      const duplicate = await checkDuplicateContact(customerId, input);
      if (duplicate) {
        setDuplicateContact(duplicate.contact);
        setContactError(
          t("workOrders.create.contactDuplicate", {
            fields: duplicate.matchedFields
              .map((field) =>
                t(`workOrders.create.contactDuplicateField.${field}`),
              )
              .join(` ${t("workOrders.create.contactDuplicateAnd")} `),
            name: duplicate.contact.name || t("customers.contacts.unnamed"),
            customer: duplicate.customer.name,
          }),
        );
        return;
      }
      const created = await createCustomerContact(customerId, input);
      setContacts((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setContactPersonIds((current) => [...new Set([...current, created.id])]);
      setContactDialogOpen(false);
    } catch (e) {
      setContactError(
        e instanceof Error
          ? e.message
          : t("workOrders.create.contactCreateError"),
      );
    } finally {
      setContactBusy(false);
    }
  };

  const linkDuplicateContact = async () => {
    if (!customerId || !duplicateContact) return;
    setContactBusy(true);
    try {
      const linked = await linkCustomerContact(customerId, duplicateContact.id);
      setContacts((current) =>
        current.some((contact) => contact.id === linked.id)
          ? current
          : [...current, linked].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setContactPersonIds((current) => [...new Set([...current, linked.id])]);
      setDuplicateContact(null);
      setContactDialogOpen(false);
    } catch (e) {
      setContactError(
        e instanceof Error ? e.message : t("workOrders.create.contactCreateError"),
      );
    } finally {
      setContactBusy(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let targetProjectId = projectId;
      if (creatingProject) {
        // Create a new location first if the user is adding one inline.
        let resolvedLocationId = creatingLocation ? "" : locationId;
        if (creatingLocation && isAdmin) {
          const loc = await createCustomerLocation(customerId, {
            label: newLocation.label.trim() || undefined,
            address: newLocation.address.trim(),
            postalCode: newLocation.postalCode.trim(),
            city: newLocation.city.trim(),
          });
          resolvedLocationId = loc.id;
        }
        const project = await createProject({
          customerId,
          name: newProjectName.trim(),
          referenceNumber: newProjectReference.trim() || undefined,
          locationId: resolvedLocationId || undefined,
          contactIds: contactPersonIds,
        });
        targetProjectId = project.id;
      }
      const wo = await createWorkOrder(targetProjectId, {
        contactPersonIds,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      });
      onCreated(wo.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("workOrders.create.submitError"));
      setSubmitting(false);
    }
  };

  return (
    <>
      <ResponsiveDialog open={open && !contactDialogOpen} onClose={submitting ? undefined : onClose} maxWidth="sm" title={t("workOrders.create.title")} stableHeight>
      <DialogTitle sx={{ fontWeight: 700 }}>{t("workOrders.create.title")}</DialogTitle>
      <DialogContent>
        {/* One flat column of fields. Progressive disclosure (new project → new
            location) extends this same column with a light divider + label — no
            nested cards, and the sheet holds a stable height so nothing jumps. */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          {/* Customer */}
          <SelectField
            label={t("workOrders.create.customerLabel")}
            value={customerId}
            onChange={setCustomerId}
            disabled={loadingCustomers || submitting}
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />

          {/* Project — existing or new */}
          <SelectField
            label={t("workOrders.create.projectLabel")}
            value={projectId}
            onChange={setProjectId}
            disabled={!customerId || loadingProjects || submitting}
            options={[
              ...projects.map((p) => ({
                value: p.id,
                label: `${p.projectNumber}${p.name ? ` · ${p.name}` : ""}`,
              })),
              { value: NEW_PROJECT, label: t("workOrders.create.newProject"), emphasize: true },
            ]}
          />

          <Autocomplete<ContactPickerOption, true, false, false>
            multiple
            disableCloseOnSelect
            size="small"
            options={[...contacts, NEW_CONTACT_OPTION]}
            value={contacts.filter((contact) => contactPersonIds.includes(contact.id))}
            getOptionLabel={(contact) =>
              contact.createNew
                ? t("workOrders.create.newContact")
                : `${contact.name || contact.phone || contact.email || t("customers.contacts.unnamed")}${contact.role ? ` (${contact.role})` : ""}${projectContactIds.includes(contact.id) ? ` · ${t("workOrders.create.projectContact")}` : ""}`
            }
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_event, selected) => {
              if (selected.some((contact) => contact.createNew)) {
                setContactError(null);
                setDuplicateContact(null);
                setContactDialogOpen(true);
                return;
              }
              setContactPersonIds(selected.map((contact) => contact.id));
            }}
            disabled={!customerId || !projectId || submitting}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("workOrders.create.contactLabel")}
                helperText={
                  customerId && contacts.length === 0
                    ? t("workOrders.create.contactEmpty")
                    : t("workOrders.create.contactOptional")
                }
              />
            )}
          />

          {/* New-project fields — flat in the same column (no nested card) */}
          {creatingProject ? (
            <>
              <FormSectionLabel>{t("workOrders.create.newProjectSection")}</FormSectionLabel>

              <TextField
                label={t("workOrders.create.projectNameLabel")}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                disabled={submitting}
                size="small"
                autoFocus
              />

              {/* Same field as the full project form (projects.form.*): the
                  client's own order/PO number, never Opero's projectNumber. */}
              <TextField
                label={t("projects.form.referenceNumber")}
                value={newProjectReference}
                onChange={(e) => setNewProjectReference(e.target.value)}
                disabled={submitting}
                size="small"
              />

              <SelectField
                label={t("workOrders.create.locationLabel")}
                value={locationId}
                onChange={setLocationId}
                disabled={submitting}
                options={[
                  { value: "", label: t("workOrders.create.locationCustomerAddress") },
                  ...locations.map((l) => ({
                    value: l.id,
                    label: `${l.label ? `${l.label} · ` : ""}${l.address}, ${l.city}`,
                  })),
                  ...(isAdmin
                    ? [{ value: NEW_LOCATION, label: t("workOrders.create.locationNew"), emphasize: true }]
                    : []),
                ]}
              />

              {/* New-location fields — also flat in the same column */}
              {creatingLocation ? (
                <>
                  <TextField
                    label={t("workOrders.create.locationLabelName")}
                    value={newLocation.label}
                    onChange={(e) => setNewLocation((s) => ({ ...s, label: e.target.value }))}
                    disabled={submitting}
                    size="small"
                  />
                  <TextField
                    label={t("workOrders.create.locationAddress")}
                    value={newLocation.address}
                    onChange={(e) => setNewLocation((s) => ({ ...s, address: e.target.value }))}
                    disabled={submitting}
                    size="small"
                    required
                  />
                  <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5 }}>
                    <TextField
                      label={t("workOrders.create.locationPostalCode")}
                      value={newLocation.postalCode}
                      onChange={(e) => setNewLocation((s) => ({ ...s, postalCode: e.target.value }))}
                      disabled={submitting}
                      size="small"
                      sx={{ width: { xs: "100%", sm: 140 } }}
                    />
                    <TextField
                      label={t("workOrders.create.locationCity")}
                      value={newLocation.city}
                      onChange={(e) => setNewLocation((s) => ({ ...s, city: e.target.value }))}
                      disabled={submitting}
                      size="small"
                      sx={{ flex: 1 }}
                    />
                  </Box>
                </>
              ) : null}

              {/* Close the new-project group before the work-order title. */}
              <Divider sx={{ mt: 0.5 }} />
            </>
          ) : null}

          {/* Optional work-order title */}
          <TextField
            label={t("workOrders.create.workOrderTitleLabel")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />

          {/* Optional per-visit description — what THIS werkbon covers. Left
              blank, the printed werkbon falls back to the project's. */}
          <TextField
            label={t("workOrders.create.workOrderDescriptionLabel")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            size="small"
            multiline
            minRows={2}
            placeholder={t("workOrders.create.workOrderDescriptionPlaceholder")}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          {t("workOrders.create.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={!canSubmit || submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("workOrders.create.submit")}
        </Button>
      </DialogActions>
      </ResponsiveDialog>
      <ContactPersonDialog
        open={contactDialogOpen}
        busy={contactBusy}
        error={contactError}
        errorAction={
          duplicateContact
            ? {
                label: t("customers.contacts.linkExisting"),
                onClick: () => void linkDuplicateContact(),
              }
            : undefined
        }
        onClose={() => { setContactDialogOpen(false); setDuplicateContact(null); }}
        onSave={(draft) => void saveNewContact(draft)}
      />
    </>
  );
}
