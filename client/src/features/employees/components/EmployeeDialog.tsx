import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { ResponsiveDialog, useSheetMenuProps } from "../../../components/ResponsiveDialog";
import { SelectField } from "../../../components/SelectField";
import { CheckboxGroupField } from "../../../components/CheckboxGroupField";
import { useForm } from "../../../lib/useForm";
import { useDirty } from "../../../lib/isDirty";
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

type Form = {
  name: string;
  phone: string;
  email: string;
  status: string;
};

const EMPTY: Form = { name: "", phone: "", email: "", status: "active" };

const RULES = { name: [required], email: [email] };

// Create / edit an employee. Name required; email validated; roles multi-select;
// status dropdown.
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
  onChangeRole,
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
  onSubmit: (input: EmployeeInput) => void;
  onDelete: () => void;
  onInvite: () => void;
  onResend: () => void;
  onDisable: () => void;
  onEnable: () => void;
  onChangeRole: (role: StaffRole) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const sheetMenu = useSheetMenuProps();
  const { values, setField, onBlur, errorFor, isValid, dirty, reset, touchAll } =
    useForm<Form>(EMPTY, RULES);
  // Roles aren't a plain string, so they live outside useForm — which means
  // useForm's `dirty` can't see them, and they need their own baseline.
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const initialRoles = useRef<TeamRole[]>([]);

  useEffect(() => {
    if (!open) return;
    reset(
      employee
        ? {
            name: employee.name,
            phone: employee.phone,
            email: employee.email ?? "",
            status: employee.status,
          }
        : EMPTY,
    );
    const seededRoles = (employee?.roles as TeamRole[]) ?? [];
    initialRoles.current = seededRoles;
    setRoles(seededRoles);
  }, [open, employee, reset]);

  // Roles are a set, so ticking and unticking the same one leaves the form
  // unchanged; isDirty compares array members order-insensitively.
  const rolesChanged = useDirty({ roles }, { roles: initialRoles.current });
  const hasChanges = dirty || rolesChanged;

  const err = (key: keyof Form) => {
    const k = errorFor(key);
    return { error: !!k, helperText: k ? t(k) : undefined };
  };

  const handleSave = () => {
    if (!isValid) {
      touchAll();
      return;
    }
    onSubmit({
      name: values.name.trim(),
      phone: values.phone,
      email: values.email.trim(),
      roles,
      status: values.status as EmployeeStatus,
    });
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

          {/* Roles. On mobile this is an INLINE checkbox list: inside the bottom
              sheet a Select's popover is clipped by the sheet's
              `overflow: hidden` and mis-anchored, so it renders as a flat panel
              over the form. Desktop keeps the compact chip Select. */}
          {isMobile ? (
            <CheckboxGroupField<TeamRole>
              label={t("employees.dialog.roles")}
              value={roles}
              onChange={setRoles}
              disabled={busy}
              columns={2}
              options={TEAM_ROLES.map((r) => ({
                value: r,
                label: t(ROLE_LABEL_KEY[r] ?? r),
              }))}
            />
          ) : (
            <FormControl size="small" disabled={busy}>
              <InputLabel id="employee-roles-label">
                {t("employees.dialog.roles")}
              </InputLabel>
              <Select
                labelId="employee-roles-label"
                multiple
                value={roles}
                onChange={(e) => setRoles(e.target.value as TeamRole[])}
                label={t("employees.dialog.roles")}
                MenuProps={{ container: sheetMenu.container }}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {(selected as TeamRole[]).map((r) => (
                      <Chip key={r} size="small" label={t(ROLE_LABEL_KEY[r] ?? r)} />
                    ))}
                  </Box>
                )}
              >
                {TEAM_ROLES.map((r) => (
                  <MenuItem key={r} value={r}>
                    <Checkbox checked={roles.includes(r)} size="small" />
                    <ListItemText primary={t(ROLE_LABEL_KEY[r] ?? r)} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

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
              onInvite={onInvite}
              onResend={onResend}
              onDisable={onDisable}
              onEnable={onEnable}
              onChangeRole={onChangeRole}
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
