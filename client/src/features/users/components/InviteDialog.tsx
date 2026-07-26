import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SelectField } from "../../../components/SelectField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import type { InviteInput } from "../api";

// Provision a login for an EXISTING person (Employee or Customer). Email, name
// and role come from that record — there is never a free-typed address.
// Employees can be admin or technician; customers are always the client role.
//
// The person is ALWAYS known: this is launched from their row on Werknemers /
// Klanten, which is the only place access is managed. (There used to be a
// standalone Toegang screen with a person picker; with it gone, so is the
// picker — and the GET /users/invitable endpoint that fed it.)
export type InviteFixedTarget =
  | { kind: "employee"; id: string; name: string }
  | { kind: "customer"; id: string; name: string };

// Ordered least → most privileged. `admin` is the OWNER: everything, including
// provisioning logins and org settings. `office` is staff: the full operational
// app, no account management.
const EMPLOYEE_ROLES = ["technician", "office", "admin"] as const;
type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export function InviteDialog({
  open,
  fixed,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** The pre-chosen person. Null only while the dialog is closed. */
  fixed: InviteFixedTarget | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: InviteInput) => void;
}) {
  const { t } = useTranslation();
  const [role, setRole] = useState<EmployeeRole>("technician");

  // Reset on (re)open.
  useEffect(() => {
    if (!open) return;
    setRole("technician");
  }, [open, fixed]);

  const isEmployee = fixed?.kind === "employee";

  const handleSubmit = () => {
    if (!fixed) return;
    onSubmit(
      fixed.kind === "employee"
        ? { kind: "employee", employeeId: fixed.id, role }
        : { kind: "customer", customerId: fixed.id },
    );
  };

  return (
    <ResponsiveDialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" title={t("users.invite.title")}>
      <DialogTitle sx={{ fontWeight: 700 }}>{t("users.invite.title")}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {t("users.invite.subtitle")}
          </Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}

          {fixed ? (
            <Alert severity="info" sx={{ py: 0.5 }}>
              {t("users.invite.linkedTo", { name: fixed.name })}
            </Alert>
          ) : null}

          {/* Role only applies to employees (customers are always client). */}
          {isEmployee ? (
            <SelectField
              label={t("users.invite.role")}
              value={role}
              onChange={(v) => setRole(v as EmployeeRole)}
              disabled={busy}
              options={EMPLOYEE_ROLES.map((r) => ({ value: r, label: t(`users.roles.${r}`) }))}
            />
          ) : fixed ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {t("users.invite.clientRoleNote", { name: fixed.name })}
            </Typography>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={busy || !fixed}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("users.invite.send")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
