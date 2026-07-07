import { useEffect, useState } from "react";
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
import { useForm } from "../../../lib/useForm";
import { required, email } from "../../../lib/validation";
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
  onClose,
  onSubmit,
}: {
  open: boolean;
  employee?: EmployeeRow | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: EmployeeInput) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const sheetMenu = useSheetMenuProps();
  const { values, setField, onBlur, errorFor, isValid, reset, touchAll } = useForm<Form>(
    EMPTY,
    RULES,
  );
  // Roles aren't a plain string, so they live outside useForm.
  const [roles, setRoles] = useState<TeamRole[]>([]);

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
    setRoles((employee?.roles as TeamRole[]) ?? []);
  }, [open, employee, reset]);

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

          {/* Roles — multi-select with chips */}
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
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={busy || !isValid}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("common.actions.save")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
