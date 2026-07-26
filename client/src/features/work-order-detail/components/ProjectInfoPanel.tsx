import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import { Card } from "../../../components/Card";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { SelectField } from "../../../components/SelectField";
import { useSheetMenuProps } from "../../../components/ResponsiveDialog";

// Must match `sheetBelow` on the Projectinfo sheet (ProjectInfoSheet.tsx).
// Anywhere the sheet renders, its `overflow: hidden` would clip an MUI menu —
// so the selects have to fall back to the native picker over the same range.
const SHEET_BREAKPOINT = "lg" as const;
import { getCustomers, type CustomerOption } from "../../work-orders/create-api";
import type {
  Project,
  ProjectSidebarPatch,
  WorkOrder,
  AssigneeOption,
} from "../api";
import { isZoneComplete } from "./zoneStatus";

// A labelled block.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

// Whole-number day span between two ISO dates, inclusive (matches opero-old).
function durationDays(start?: string, end?: string): number {
  if (!start) return 0;
  const e = end ?? start;
  return Math.round((Date.parse(e) - Date.parse(start)) / 86_400_000) + 1;
}

// The job-setup sidebar on the werkbon detail — "all the extra info on the side"
// (the opero-old prototype). Holds everything about setting up / planning the
// job: progress, urgency, dates, the TEAM (project leader + monteurs), address,
// contact, description and instructions. Project-level fields patch the project;
// the monteur crew is werkbon-level. The header stays lean (identity + status +
// actions). Work type is NOT here — it's derived from the line articles.
export function ProjectInfoPanel({
  project,
  workOrder,
  canEdit,
  busy,
  employees,
  onPatch,
  onAssignMonteurs,
  onSetSchedule,
  onSetTitle,
  bare = false,
}: {
  project: Project;
  workOrder: WorkOrder;
  canEdit: boolean;
  busy: boolean;
  employees: AssigneeOption[];
  onPatch: (patch: ProjectSidebarPatch) => void;
  onAssignMonteurs: (ids: string[]) => void;
  onSetSchedule: (patch: { plannedDate?: string | null; plannedEndDate?: string | null }) => void;
  /** Rename the werkbon (werkbon-level, not project). */
  onSetTitle: (title: string) => void;
  /**
   * Drop the Card chrome and the heading — for when this is already inside a
   * container that supplies both (the mobile Projectinfo sheet). Otherwise the
   * sheet shows a card inside a sheet, with the title twice.
   */
  bare?: boolean;
}) {
  const { t } = useTranslation();
  // Inside a bottom sheet, MUI menus must portal into the sheet's own subtree or
  // vaul blocks their pointer events and they open but can't be clicked. Returns
  // undefined outside a sheet, so this is a no-op on desktop.
  const sheetMenu = useSheetMenuProps();

  // Customer options for the Klant switcher, loaded once for admins (the only
  // role that can switch). `pendingCustomer` holds the picked id until the
  // confirm is accepted — the select never applies straight away.
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [pendingCustomer, setPendingCustomer] = useState<string | null>(null);
  useEffect(() => {
    if (!canEdit) return;
    getCustomers().then(setCustomers).catch(() => setCustomers([]));
  }, [canEdit]);

  const zones = workOrder.tasks;
  const doneCount = zones.filter(isZoneComplete).length;
  // Scheduling is per-WERKBON — dates come from the werkbon, not the project.
  const days = durationDays(workOrder.plannedDate, workOrder.plannedEndDate);
  const leaderName = employees.find((e) => e.id === project.projectLeaderId)?.name;

  // In a sheet the surrounding chrome already supplies the card and the title.
  const Shell = bare ? Box : Card;

  return (
    <Shell>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {bare ? null : (
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {t("workOrderDetail.info.title")}
          </Typography>
        )}

        {/* Progress — derived from this werkbon's zones. */}
        <Field label={t("workOrderDetail.info.progress")}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {t("workOrderDetail.info.progressValue", { done: doneCount, total: zones.length })}
          </Typography>
        </Field>

        {canEdit ? (
          <>
            {/* The werkbon's own name. Werkbon-level (not project) — it names
                THIS visit. Left empty the header falls back to "Werkbon N", so
                clearing it is a valid choice, not a broken state. */}
            <Field label={t("workOrderDetail.info.workOrderTitle")}>
              <TextField
                size="small"
                defaultValue={workOrder.title}
                key={`wt-${workOrder.id}-${workOrder.title}`}
                placeholder={t("workOrderDetail.header.defaultTitle", {
                  n: workOrder.ordinal + 1,
                })}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (workOrder.title ?? "")) onSetTitle(v);
                }}
                disabled={busy}
              />
            </Field>

            {/* KLANT — which customer this job is for. Switching moves the job
                (and its werkbonnen, invoices and meerwerk approvals) into that
                customer's portal, so it confirms before applying. */}
            <Field label={t("workOrderDetail.info.customer")}>
              <SelectField
                label=""
                value={project.customerId}
                onChange={(v) => setPendingCustomer(v)}
                disabled={busy}
                nativeBelow={SHEET_BREAKPOINT}
                options={customers.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>

            <Field label={t("workOrderDetail.info.urgency")}>
              <SelectField
                label=""
                value={project.urgency}
                onChange={(v) => onPatch({ urgency: v as ProjectSidebarPatch["urgency"] })}
                disabled={busy}
                nativeBelow={SHEET_BREAKPOINT}
                options={[
                  { value: "normal", label: t("workOrderDetail.urgency.normal") },
                  { value: "urgent", label: t("workOrderDetail.urgency.urgent") },
                  { value: "blocked", label: t("workOrderDetail.urgency.blocked") },
                ]}
              />
            </Field>

            {/* Planning — start is the primary field; a one-day job needs only
                the start (end defaults to "same day"). End is optional, for
                multi-day jobs. The live day-count sits muted underneath. */}
            <Field label={t("workOrderDetail.info.planning")}>
              {/* Two date inputs side by side: a `type="date"` has a wide
                  intrinsic minimum (the dd-mm-yyyy mask plus the picker icon),
                  so on a phone they can't both fit a row — stack them.
                  `mt: 1` pushes the fields down off the "PLANNING" caption: the
                  date fields' own floating labels (Startdatum/Einddatum) were
                  colliding with it. */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 1.5,
                  alignItems: "flex-end",
                  mt: 1,
                }}
              >
                <TextField
                  type="date"
                  size="small"
                  label={t("workOrderDetail.info.startDate")}
                  value={workOrder.plannedDate ?? ""}
                  onChange={(e) => onSetSchedule({ plannedDate: e.target.value || null })}
                  disabled={busy}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  type="date"
                  size="small"
                  label={t("workOrderDetail.info.endDateOptional")}
                  value={workOrder.plannedEndDate ?? ""}
                  onChange={(e) => onSetSchedule({ plannedEndDate: e.target.value || null })}
                  disabled={busy || !workOrder.plannedDate}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { min: workOrder.plannedDate, placeholder: t("workOrderDetail.info.sameDay") },
                  }}
                  sx={{ flex: 1 }}
                />
              </Box>
              {workOrder.plannedDate ? (
                <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.5 }}>
                  {t("workOrderDetail.info.daysValue", { count: days })}
                </Typography>
              ) : null}
            </Field>

            <Divider />

            {/* TEAM — project leader (project) + monteurs (werkbon). */}
            <Field label={t("workOrderDetail.info.projectLeader")}>
              <SelectField
                label=""
                value={project.projectLeaderId ?? ""}
                onChange={(v) => onPatch({ projectLeaderId: v || null })}
                disabled={busy}
                nativeBelow={SHEET_BREAKPOINT}
                options={[
                  { value: "", label: t("workOrderDetail.info.none") },
                  ...employees.map((e) => ({ value: e.id, label: e.name })),
                ]}
              />
            </Field>

            <Field label={t("workOrderDetail.info.monteurs")}>
              <Autocomplete
                multiple
                disableCloseOnSelect
                size="small"
                options={employees}
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={employees.filter((a) => workOrder.assignees.some((s) => s.id === a.id))}
                onChange={(_e, selected) => onAssignMonteurs(selected.map((s) => s.id))}
                disabled={busy}
                // No native equivalent for a multi-select, so it keeps the
                // portal — but the list must be bounded, or the sheet's
                // `overflow: hidden` clips whatever hangs past the bottom and
                // those options become unreachable.
                slotProps={{
                  popper: { container: sheetMenu.container },
                  paper: { sx: { maxHeight: "40dvh" } },
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={workOrder.assignees.length === 0 ? t("workOrderDetail.info.monteursPlaceholder") : undefined}
                  />
                )}
              />
            </Field>

            <Divider />

            <Field label={t("workOrderDetail.info.address")}>
              <TextField
                size="small"
                defaultValue={project.address}
                key={`addr-${project.address}`}
                onBlur={(e) => {
                  if (e.target.value !== project.address) onPatch({ address: e.target.value });
                }}
                disabled={busy}
              />
              <Box sx={{ display: "flex", gap: 1.5, mt: 1 }}>
                <TextField
                  size="small"
                  placeholder={t("workOrderDetail.info.postalCode")}
                  defaultValue={project.postalCode}
                  key={`pc-${project.postalCode}`}
                  onBlur={(e) => {
                    if (e.target.value !== project.postalCode) onPatch({ postalCode: e.target.value });
                  }}
                  disabled={busy}
                  sx={{ width: 120 }}
                />
                <TextField
                  size="small"
                  placeholder={t("workOrderDetail.info.city")}
                  defaultValue={project.city}
                  key={`city-${project.city}`}
                  onBlur={(e) => {
                    if (e.target.value !== project.city) onPatch({ city: e.target.value });
                  }}
                  disabled={busy}
                  sx={{ flex: 1 }}
                />
              </Box>
            </Field>

            <Field label={t("workOrderDetail.info.contact")}>
              <TextField
                size="small"
                placeholder={t("workOrderDetail.info.contactName")}
                defaultValue={project.contactName ?? ""}
                key={`cn-${project.contactName ?? ""}`}
                onBlur={(e) => {
                  if (e.target.value !== (project.contactName ?? "")) onPatch({ contactName: e.target.value });
                }}
                disabled={busy}
              />
              <TextField
                size="small"
                placeholder={t("workOrderDetail.info.contactPhone")}
                defaultValue={project.contactPhone ?? ""}
                key={`cp-${project.contactPhone ?? ""}`}
                onBlur={(e) => {
                  if (e.target.value !== (project.contactPhone ?? "")) onPatch({ contactPhone: e.target.value });
                }}
                disabled={busy}
                sx={{ mt: 1 }}
              />
            </Field>

            <Field label={t("workOrderDetail.info.description")}>
              <TextField
                size="small"
                multiline
                minRows={2}
                defaultValue={project.description ?? ""}
                key={`desc-${project.description ?? ""}`}
                onBlur={(e) => {
                  if (e.target.value !== (project.description ?? "")) onPatch({ description: e.target.value });
                }}
                disabled={busy}
              />
            </Field>

            <Field label={t("workOrderDetail.info.instructions")}>
              <TextField
                size="small"
                multiline
                minRows={2}
                defaultValue={project.instructions ?? ""}
                key={`instr-${project.instructions ?? ""}`}
                onBlur={(e) => {
                  if (e.target.value !== (project.instructions ?? "")) onPatch({ instructions: e.target.value });
                }}
                disabled={busy}
              />
            </Field>
          </>
        ) : (
          <>
            {workOrder.plannedDate ? (
              <Field label={t("workOrderDetail.info.date")}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {workOrder.plannedDate}
                  {workOrder.plannedEndDate ? ` – ${project.plannedEndDate}` : ""}
                  {days > 0 ? ` · ${t("workOrderDetail.info.daysValue", { count: days })}` : ""}
                </Typography>
              </Field>
            ) : null}
            {leaderName ? (
              <Field label={t("workOrderDetail.info.projectLeader")}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>{leaderName}</Typography>
              </Field>
            ) : null}
            {workOrder.assignees.length > 0 ? (
              <Field label={t("workOrderDetail.info.monteurs")}>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {workOrder.assignees.map((a) => (
                    <Chip key={a.id} size="small" label={a.name} />
                  ))}
                </Box>
              </Field>
            ) : null}
            <Field label={t("workOrderDetail.info.address")}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {project.address}, {project.postalCode} {project.city}
              </Typography>
            </Field>
            {(project.contactName || project.contactPhone) ? (
              <Field label={t("workOrderDetail.info.contact")}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {[project.contactName, project.contactPhone].filter(Boolean).join(" · ")}
                </Typography>
              </Field>
            ) : null}
            {project.description ? (
              <Field label={t("workOrderDetail.info.description")}>
                <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "pre-line" }}>
                  {project.description}
                </Typography>
              </Field>
            ) : null}
            {project.instructions ? (
              <Field label={t("workOrderDetail.info.instructions")}>
                <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "pre-line" }}>
                  {project.instructions}
                </Typography>
              </Field>
            ) : null}
          </>
        )}
      </Box>

      {/* Switching customer moves the job between client portals — not visible
          from the select itself, so name both sides before applying. */}
      <ConfirmDialog
        open={pendingCustomer !== null}
        title={t("workOrderDetail.info.customerSwitchTitle")}
        body={t("workOrderDetail.info.customerSwitchBody", {
          from: project.customerName,
          to: customers.find((c) => c.id === pendingCustomer)?.name ?? "",
        })}
        busy={busy}
        destructive
        onClose={() => setPendingCustomer(null)}
        onConfirm={() => {
          if (pendingCustomer) onPatch({ customerId: pendingCustomer });
          setPendingCustomer(null);
        }}
      />
    </Shell>
  );
}
