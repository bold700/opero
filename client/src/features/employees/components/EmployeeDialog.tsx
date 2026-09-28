import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SelectField } from "../../../components/SelectField";
import { useForm } from "../../../lib/useForm";
import { required, email } from "../../../lib/validation";
import { AccountSection } from "../../users/components/AccountSection";
import type { StaffRole } from "../../users/api";
import {
  TEAM_ROLES,
  EMPLOYEE_STATUSES,
  type EmployeeRow,
  type EmployeeInput,
  type TeamRole,
  type EmployeeStatus,
} from "../api";
import { ROLE_LABEL_KEY } from "../constants";
import { useIsMobile } from "../../../lib/useIsMobile";

// `role` is the single job title. "" means none set — the picker's first
// option — which is sent to the API as null.
type Form = {
  name: string;
  phone: string;
  email: string;
  role: string;
  status: string;
};

const EMPTY: Form = { name: "", phone: "", email: "", role: "", status: "active" };

const RULES = { name: [required], email: [email] };

// Create / edit an employee. Name required; email validated; a single job-title
// dropdown; status dropdown.
export function EmployeeDialog({
  open,
  employee,
  busy,
  error,
  canManage,
  canDelete,
  accountBusy,
  isSelf,
  onClose,
  onSubmit,
  onDelete,
  onInvite,
  onResend,
  onDisable,
  onEnable,
}: {
  open: boolean;
  employee?: EmployeeRow | null;
  busy: boolean;
  error: string | null;
  canManage: boolean;
  /**
   * Deleting cascades into revoking this person's login, so you can't remove
   * someone at or above your own level — office can't delete an admin.
   */
  canDelete: boolean;
  accountBusy: boolean;
  isSelf: boolean;
  onClose: () => void;
  /**
   * Save. `accessRole` is the staged account level, present only when it was
   * actually changed — the caller then commits it alongside the record.
   */
  onSubmit: (input: EmployeeInput, accessRoles?: StaffRole[]) => void;
  onDelete: () => void;
  onInvite: () => void;
  onResend: () => void;
  onDisable: () => void;
  onEnable: () => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { values, setField, onBlur, errorFor, isValid, dirty, reset, touchAll } =
    useForm<Form>(EMPTY, RULES);

  // The account's access level is STAGED like every other field in this dialog:
  // picking one used to PATCH immediately, so a control that looks like a form
  // field committed on change and Annuleren could not undo it. It is not part
  // of `useForm` because it belongs to the linked login, not the employee
  // record, and is saved through a different endpoint.
  const [accessRoles, setAccessRoles] = useState<StaffRole[]>([]);

  useEffect(() => {
    if (!open) return;
    reset(
      employee
        ? {
            name: employee.name,
            phone: employee.phone,
            email: employee.email ?? "",
            role: employee.role ?? "",
            status: employee.status,
          }
        : EMPTY,
    );
    // Re-seeded whenever the account changes underneath us too (an invite or a
    // disable resolves while the dialog is open), so a stale staged level can
    // never be saved against a login that has moved on.
    setAccessRoles(
      (employee?.account?.roles?.length
        ? employee.account.roles
        : employee?.account
          ? [employee.account.role]
          : []) as StaffRole[],
    );
  }, [open, employee, reset]);

  // The job title is a plain string field now, so useForm tracks its dirtiness
  // like every other field — no separate baseline needed. The staged access
  // level is tracked separately so it enables Opslaan on its own.
  const currentAccessRoles = employee?.account
    ? (employee.account.roles?.length ? employee.account.roles : [employee.account.role])
    : [];
  const accessRolesChanged =
    !!employee?.account &&
    (accessRoles.length !== currentAccessRoles.length ||
      accessRoles.some((role) => !currentAccessRoles.includes(role)));
  const hasChanges = dirty || accessRolesChanged;

  const err = (key: keyof Form) => {
    const k = errorFor(key);
    return { error: !!k, helperText: k ? t(k) : undefined };
  };

  const handleSave = () => {
    if (!isValid) {
      touchAll();
      return;
    }
    onSubmit(
      {
        name: values.name.trim(),
        phone: values.phone,
        email: values.email.trim(),
        // "" is "no job title" — send it as an explicit null so clearing sticks.
        role: values.role ? (values.role as TeamRole) : null,
        status: values.status as EmployeeStatus,
      },
      // Only when it actually moved: an unchanged level must not cost a PATCH
      // on someone the actor may not act on.
      accessRolesChanged ? accessRoles : undefined,
    );
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      title={employee ? t("employees.dialog.editTitle") : t("employees.dialog.newTitle")}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        {employee ? t("employees.dialog.editTitle") : t("employees.dialog.newTitle")}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label={t("employees.dialog.name")}
            value={values.name}
            onChange={setField("name")}
            onBlur={onBlur("name")}
            disabled={busy}
            required
            autoFocus={!isMobile}
            size="small"
            {...err("name")}
          />
          <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2 }}>
            <TextField
              label={t("employees.dialog.phone")}
              value={values.phone}
              onChange={setField("phone")}
              disabled={busy}
              size="small"
              sx={{ flex: 1 }}
            />
            <TextField
              label={t("employees.dialog.email")}
              value={values.email}
              onChange={setField("email")}
              disabled={busy}
              size="small"
              sx={{ flex: 1 }}
              {...err("email")}
            />
          </Box>

          {/* Job title — ONE per employee. This replaces the old multi-select
              (a mobile checkbox list + a desktop chip Select): a person has one
              function, and every screen already showed only one anyway.
              SelectField handles both platforms, so there is no longer a
              mobile/desktop split to maintain here. */}
          <SelectField
            label={t("employees.dialog.role")}
            value={values.role}
            onChange={(v) => setField("role")({ target: { value: v } })}
            disabled={busy}
            options={[
              { value: "", label: t("employees.dialog.noRole") },
              ...TEAM_ROLES.map((r) => ({
                value: r,
                label: t(ROLE_LABEL_KEY[r] ?? r),
              })),
            ]}
          />

          {/* Status */}
          <SelectField
            label={t("employees.dialog.status")}
            value={values.status}
            onChange={(v) => setField("status")({ target: { value: v } })}
            disabled={busy}
            options={EMPLOYEE_STATUSES.map((s) => ({
              value: s,
              label: t(`employees.status.${s}`),
            }))}
          />

          {/* Login account — only for an existing employee, admins only. Reads
              the live email field so a just-typed address enables Uitnodigen
              (the invite is sent against the saved record).

              There is deliberately no access-level picker on create: an
              employee record grants nothing, and the level is chosen when
              access actually is granted, in the invite dialog behind the
              Uitnodigen button. */}
          {employee && canManage ? (
            <AccountSection
              account={employee.account}
              email={values.email}
              busy={accountBusy}
              labelKeys="employees.dialog.account"
              isSelf={isSelf}
              rolesValue={accessRoles}
              onInvite={onInvite}
              onResend={onResend}
              onDisable={onDisable}
              onEnable={onEnable}
              // Stage only — committed by Opslaan below, with the record.
              onChangeRoles={setAccessRoles}
            />
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {/* Destructive action, pushed away from the confirming ones so it can't
            be hit on the way to Opslaan. Only when editing, and only if this
            person is one you're allowed to remove. */}
        {employee && canDelete ? (
          <>
            <Button color="error" onClick={onDelete} disabled={busy}>
              {t("common.actions.delete")}
            </Button>
            <Box sx={{ flex: 1 }} />
          </>
        ) : null}
        <Button onClick={onClose} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        {/* `hasChanges` covers the roles picker too, which lives outside
            useForm — otherwise toggling only a role would leave Save dead. */}
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={busy || !isValid || !hasChanges}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("common.actions.save")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
