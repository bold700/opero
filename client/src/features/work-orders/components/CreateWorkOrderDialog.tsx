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
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuth } from "../../../auth/AuthContext";
import { HAIRLINE, RADIUS } from "../../../theme/tokens";
import {
  getCustomers,
  getCustomerLocations,
  createCustomerLocation,
  getProjectsForCustomer,
  createProject,
  createWorkOrder,
  type CustomerOption,
  type LocationOption,
  type ProjectOption,
} from "../create-api";

const NEW_PROJECT = "__new__";
const NEW_LOCATION = "__new_location__";

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
  const isAdmin = user?.role === "admin";

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [locationId, setLocationId] = useState("");
  const [newLocation, setNewLocation] = useState({ label: "", address: "", postalCode: "", city: "" });
  const [title, setTitle] = useState("");

  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load customers when the dialog opens; reset everything when it closes.
  useEffect(() => {
    if (!open) {
      setCustomerId("");
      setProjects([]);
      setProjectId("");
      setNewProjectName("");
      setLocationId("");
      setNewLocation({ label: "", address: "", postalCode: "", city: "" });
      setLocations([]);
      setTitle("");
      setError(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

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
          locationId: resolvedLocationId || undefined,
        });
        targetProjectId = project.id;
      }
      const wo = await createWorkOrder(targetProjectId, title.trim() || undefined);
      onCreated(wo.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("workOrders.create.submitError"));
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" title={t("workOrders.create.title")}>
      <DialogTitle sx={{ fontWeight: 700 }}>{t("workOrders.create.title")}</DialogTitle>
      <DialogContent>
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

          {/* New-project sub-form: a distinct grouped block */}
          {creatingProject ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                p: 2,
                borderRadius: `${RADIUS.control}px`,
                border: `1px solid ${HAIRLINE}`,
                bgcolor: "#FAFAFB",
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.4 }}>
                {t("workOrders.create.newProjectSection")}
              </Typography>

              <TextField
                label={t("workOrders.create.projectNameLabel")}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                disabled={submitting}
                size="small"
                autoFocus
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

              {/* Inline new-location fields */}
              {creatingLocation ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
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
                </Box>
              ) : null}
            </Box>
          ) : null}

          {/* Optional work-order title */}
          <TextField
            label={t("workOrders.create.workOrderTitleLabel")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
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
  );
}
