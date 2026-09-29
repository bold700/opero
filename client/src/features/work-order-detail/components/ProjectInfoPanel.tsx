import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TIME_SLOTS, suggestEndTime } from "../../../lib/timeSlots";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import { Card } from "../../../components/Card";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { AutosaveDateField } from "../../../components/AutosaveDateField";
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
import { CustomerContactBlock } from "./CustomerContactBlock";
import { SelectedContactPersons } from "./SelectedContactPersons";
import { AttachmentsPanel } from "../../../components/AttachmentsPanel";

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
  projectLeaders,
  onPatch,
  onAssignMonteurs,
  onSetSchedule,
  onSetUrgency,
  onSetTitle,
  onSetDescription,
  onSetContacts,
  bare = false,
}: {
  project: Project;
  workOrder: WorkOrder;
  canEdit: boolean;
  busy: boolean;
  /** Technician-eligible staff — the monteur picker. */
  employees: AssigneeOption[];
  /** Project-leader-eligible staff — the projectleider picker. */
  projectLeaders: AssigneeOption[];
  onPatch: (patch: ProjectSidebarPatch) => void;
  onAssignMonteurs: (ids: string[]) => void;
  onSetSchedule: (patch: {
    plannedDate?: string | null;
    plannedEndDate?: string | null;
    startTime?: string;
    endTime?: string;
  }) => void;
  /** Set THIS visit's priority (per-werkbon). */
  onSetUrgency: (urgency: "normal" | "urgent") => void;
  /** Rename the werkbon (werkbon-level, not project). */
  onSetTitle: (title: string) => void;
  /**
   * Set THIS visit's own description (werkbon-level, not project). Blank is
   * valid — the printed werkbon then falls back to the project's description.
   */
  onSetDescription: (description: string) => void;
  onSetContacts: (contactPersonIds: string[]) => void;
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
  const hasOtherCustomerContacts = Boolean(
    workOrder.customer &&
      (workOrder.customer.contactName ||
        workOrder.customer.phone ||
        workOrder.customer.email ||
        workOrder.customer.contactPersons.some(
          (contact) => !workOrder.contactPersons.some((selected) => selected.id === contact.id),
        )),
  );
  // Moving the start past the current end would invert the slot (the backend
  // rejects that), so push the end along to start + 2h in the same patch —
  // the same suggestion the Planning dialog makes.
  const commitStartTime = (v: string) => {
    if (!v) return;
    if (workOrder.endTime && v >= workOrder.endTime) {
      onSetSchedule({ startTime: v, endTime: suggestEndTime(v) });
    } else {
      onSetSchedule({ startTime: v });
    }
  };
  // The leader picker is narrowed to project-leader-eligible staff, but an
  // already-assigned leader must stay selectable even if their job title
  // changed since — otherwise the select shows a blank value and saving any
  // other field would silently drop them.
  const leaderOptions = useMemo(() => {
    const assignedId = project.projectLeaderId;
    if (!assignedId || projectLeaders.some((e) => e.id === assignedId)) return projectLeaders;
    const incumbent = employees.find((e) => e.id === assignedId);
    return incumbent ? [incumbent, ...projectLeaders] : projectLeaders;
  }, [projectLeaders, employees, project.projectLeaderId]);

  const leaderName = leaderOptions.find((e) => e.id === project.projectLeaderId)?.name;

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

            {/* THIS VISIT's own description ("2e verdieping, week 38"). Distinct
                from the project's description further down: a project groups
                many werkbonnen, each covering a different part of the job. Left
                empty, the printed werkbon falls back to the project's. */}
            <Field label={t("workOrderDetail.info.workOrderDescription")}>
              <TextField
                size="small"
                multiline
                minRows={2}
                placeholder={t("workOrderDetail.info.workOrderDescriptionPlaceholder")}
                defaultValue={workOrder.description ?? ""}
                key={`wd-${workOrder.id}-${workOrder.description ?? ""}`}
                onBlur={(e) => {
                  if (e.target.value !== (workOrder.description ?? "")) {
                    onSetDescription(e.target.value);
                  }
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

            {/* THIS visit's priority — per-werkbon, so flagging floor 2's leak
                never stamps floor 1's routine job. "Blocked" is not an option:
                that's project workflow state (the blocker), not priority. */}
            <Field label={t("workOrderDetail.info.urgency")}>
              <SelectField
                label=""
                value={workOrder.urgency}
                onChange={(v) => onSetUrgency(v as "normal" | "urgent")}
                disabled={busy}
                nativeBelow={SHEET_BREAKPOINT}
                options={[
                  { value: "normal", label: t("workOrderDetail.urgency.normal") },
                  { value: "urgent", label: t("workOrderDetail.urgency.urgent") },
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
                {/* AutosaveDateField owns the commit timing so an open calendar
                    is never disturbed: picking a day saves ~0.5s later, while
                    stepping through months/years only restarts the debounce (in
                    some browsers each step fires a `change`, which is what used
                    to save + close the picker mid-navigation). It also refuses
                    to touch the input while it's focused — a remount or a
                    programmatic value write closes the picker just as surely.
                    `disabled` is permission-only, NEVER `busy`: an unrelated
                    concurrent mutation disabling this input would drop focus and
                    close the picker too. */}
                <AutosaveDateField
                  size="small"
                  label={t("workOrderDetail.info.startDate")}
                  value={workOrder.plannedDate ?? ""}
                  onCommit={(v) => onSetSchedule({ plannedDate: v || null })}
                  disabled={!canEdit}
                  sx={{ flex: 1 }}
                />
                <AutosaveDateField
                  size="small"
                  label={t("workOrderDetail.info.endDateOptional")}
                  value={workOrder.plannedEndDate ?? ""}
                  onCommit={(v) => onSetSchedule({ plannedEndDate: v || null })}
                  // No range without a start date — that half of the guard stays.
                  disabled={!canEdit || !workOrder.plannedDate}
                  slotProps={{
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
              {/* The visit's times — the same calendar slot the Planning screen
                  edits (one write path server-side, so they can't diverge).
                  Only offered once a date exists: a time without a scheduled
                  visit is meaningless and the backend rejects it. */}
              {workOrder.plannedDate ? (
                <Box sx={{ display: "flex", gap: 1.5, mt: 1.5 }}>
                  <SelectField
                    label={t("planning.schedule.startTime")}
                    value={workOrder.startTime ?? ""}
                    onChange={commitStartTime}
                    disabled={!canEdit}
                    nativeBelow={SHEET_BREAKPOINT}
                    sx={{ flex: 1 }}
                    options={TIME_SLOTS.map((s) => ({ value: s, label: s }))}
                  />
                  <SelectField
                    label={t("planning.schedule.endTime")}
                    value={workOrder.endTime ?? ""}
                    onChange={(v) => { if (v) onSetSchedule({ endTime: v }); }}
                    disabled={!canEdit}
                    nativeBelow={SHEET_BREAKPOINT}
                    sx={{ flex: 1 }}
                    options={TIME_SLOTS.filter(
                      (s) => !workOrder.startTime || s > workOrder.startTime,
                    ).map((s) => ({ value: s, label: s }))}
                  />
                </Box>
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
                  ...leaderOptions.map((e) => ({ value: e.id, label: e.name })),
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
                type="tel"
                defaultValue={project.contactPhone ?? ""}
                key={`cp-${project.contactPhone ?? ""}`}
                onBlur={(e) => {
                  if (e.target.value !== (project.contactPhone ?? "")) onPatch({ contactPhone: e.target.value });
                }}
                disabled={busy}
                sx={{ mt: 1 }}
              />
            </Field>

            {/* The CUSTOMER's own contact details (read-only here — they're
                edited on the customer record). Separate from the site contact
                above, which is per-project and may be someone else entirely. */}
            {workOrder.customer ? (
              <Field label={t("workOrderDetail.info.workOrderContact")}>
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  size="small"
                  options={workOrder.customer.contactPersons}
                  value={workOrder.contactPersons}
                  getOptionLabel={(contact) =>
                    contact.name ||
                    contact.phone ||
                    contact.email ||
                    t("customers.contacts.unnamed")
                  }
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  onChange={(_event, contacts) =>
                    onSetContacts(contacts.map(({ id }) => id))
                  }
                  disabled={busy}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("workOrderDetail.info.workOrderContactPicker")}
                      helperText={t("workOrderDetail.info.workOrderContactHint")}
                    />
                  )}
                />
              </Field>
            ) : null}
            {workOrder.customer && hasOtherCustomerContacts ? (
              <Field label={t("workOrderDetail.info.customerContact")}>
                <CustomerContactBlock
                  customer={workOrder.customer}
                  excludeIds={workOrder.contactPersons.map((contact) => contact.id)}
                />
              </Field>
            ) : null}

            {/* The PROJECT's description — the generic one, shared by every
                werkbon under this project. The per-visit text is the werkbon
                description near the top. */}
            <Field label={t("workOrderDetail.info.projectDescription")}>
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

            {/* The PROJECT's files — reference material shared by every werkbon
                under this project. Managed on the project page; read-only here. */}
            <Field label={t("workOrderDetail.info.projectFiles")}>
              <AttachmentsPanel
                bare
                attachments={workOrder.projectAttachments}
                canWrite={false}
                busy={busy}
                title=""
                emptyText={t("workOrderDetail.info.projectFilesEmpty")}
                addLabel=""
                onUpload={() => {}}
                onDelete={() => {}}
              />
            </Field>
          </>
        ) : (
          <>
            {workOrder.plannedDate ? (
              <Field label={t("workOrderDetail.info.date")}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {workOrder.plannedDate}
                  {workOrder.plannedEndDate ? ` – ${workOrder.plannedEndDate}` : ""}
                  {days > 0 ? ` · ${t("workOrderDetail.info.daysValue", { count: days })}` : ""}
                  {workOrder.startTime && workOrder.endTime
                    ? ` · ${workOrder.startTime}–${workOrder.endTime}`
                    : ""}
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
            {/* Site contact (per-project). The phone is a tel: link — the
                monteur reading this is on a phone. */}
            {(project.contactName || project.contactPhone) ? (
              <Field label={t("workOrderDetail.info.contact")}>
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  {project.contactName ? (
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {project.contactName}
                    </Typography>
                  ) : null}
                  {project.contactPhone ? (
                    <Link
                      href={`tel:${project.contactPhone.replace(/\s+/g, "")}`}
                      variant="body2"
                      underline="hover"
                      sx={{ alignSelf: "flex-start", py: 0.25 }}
                    >
                      {project.contactPhone}
                    </Link>
                  ) : null}
                </Box>
              </Field>
            ) : null}
            {/* The CUSTOMER's contact people — who to call when the site
                contact doesn't answer. Tappable tel:/mailto: links. */}
            {workOrder.contactPersons.length > 0 ? (
              <Field label={t("workOrderDetail.info.workOrderContact")}>
                <SelectedContactPersons contacts={workOrder.contactPersons} />
              </Field>
            ) : null}
            {workOrder.customer && hasOtherCustomerContacts ? (
              <Field label={t("workOrderDetail.info.customerContact")}>
                <CustomerContactBlock
                  customer={workOrder.customer}
                  excludeIds={workOrder.contactPersons.map((contact) => contact.id)}
                />
              </Field>
            ) : null}
            {/* THIS visit's own description first — it's the specific one. */}
            {workOrder.description ? (
              <Field label={t("workOrderDetail.info.workOrderDescription")}>
                <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "pre-line" }}>
                  {workOrder.description}
                </Typography>
              </Field>
            ) : null}
            {project.description ? (
              <Field label={t("workOrderDetail.info.projectDescription")}>
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
            {/* The PROJECT's files — shared by every werkbon under this project. */}
            {workOrder.projectAttachments.length > 0 ? (
              <Field label={t("workOrderDetail.info.projectFiles")}>
                <AttachmentsPanel
                  bare
                  attachments={workOrder.projectAttachments}
                  canWrite={false}
                  busy={busy}
                  title=""
                  emptyText=""
                  addLabel=""
                  onUpload={() => {}}
                  onDelete={() => {}}
                />
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
