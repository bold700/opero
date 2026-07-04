import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { ResponsiveDialog, useSheetMenuProps } from "../../../components/ResponsiveDialog";
import { SelectField } from "../../../components/SelectField";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { useApi } from "../../../lib/api/useApi";
import { getInvitable, type InviteInput, type InvitablePerson } from "../api";

// The invite dialog picks an EXISTING person (Employee or Customer) and
// provisions a login for them. Email/name/role come from that record — there is
// no free-typed email. Employees can be admin or technician; customers are
// always the client role.
//
// When launched from an Employee/Customer row the person is already known
// (`fixed`), so the picker is skipped and only the role choice (employees) shows.
export type InviteFixedTarget =
  | { kind: "employee"; id: string; name: string }
  | { kind: "customer"; id: string; name: string };

const EMPLOYEE_ROLES = ["technician", "admin"] as const;
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
  /** When set, the person is pre-chosen (from their row) and the picker is hidden. */
  fixed?: InviteFixedTarget | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: InviteInput) => void;
}) {
  const { t } = useTranslation();
  const sheetMenu = useSheetMenuProps();

  // Only the standalone (Access-tab) flow needs the invitable list. Fetch only
  // when the picker is actually shown (open + not a fixed target); don't key on
  // `open` alone or closing the dialog would refetch and flash a stale state.
  const needsPicker = open && !fixed;
  const { data, loading } = useApi<InvitablePerson[]>(getInvitable, [needsPicker]);
  // `data === null` means we haven't loaded yet — treat that as "still loading"
  // so the "nobody to invite" message never shows before the fetch resolves.
  const loaded = data !== null;
  const people = useMemo(() => (needsPicker ? (data ?? []) : []), [needsPicker, data]);

  const [selected, setSelected] = useState<InvitablePerson | null>(null);
  const [role, setRole] = useState<EmployeeRole>("technician");

  // Reset on (re)open.
  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setRole("technician");
  }, [open, fixed]);

  // The chosen person's kind decides whether a role choice applies (employees).
  const kind = fixed?.kind ?? selected?.kind;
  const isEmployee = kind === "employee";
  const displayName = fixed?.name ?? selected?.name ?? "";

  const canSubmit =
    !busy && (fixed ? true : selected !== null) && kind !== undefined;

  const handleSubmit = () => {
    if (fixed) {
      onSubmit(
        fixed.kind === "employee"
          ? { kind: "employee", employeeId: fixed.id, role }
          : { kind: "customer", customerId: fixed.id },
      );
      return;
    }
    if (!selected) return;
    onSubmit(
      selected.kind === "employee"
        ? { kind: "employee", employeeId: selected.id, role }
        : { kind: "customer", customerId: selected.id },
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
            // Person pre-chosen from their row — show who, no picker.
            <Alert severity="info" sx={{ py: 0.5 }}>
              {t("users.invite.linkedTo", { name: fixed.name })}
            </Alert>
          ) : !needsPicker || loading || !loaded ? (
            // Loading, or the dialog is closing — show a spinner, never the
            // "nobody to invite" message before the list has actually loaded.
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : people.length === 0 ? (
            <Alert severity="info">{t("users.invite.noInvitable")}</Alert>
          ) : (
            <Autocomplete
              options={people}
              value={selected}
              onChange={(_e, v) => setSelected(v)}
              disabled={busy}
              groupBy={(o) =>
                o.kind === "employee" ? t("users.invite.employees") : t("users.invite.customers")
              }
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.kind === b.kind && a.id === b.id}
              renderOption={(props, o) => (
                <Box component="li" {...props} key={`${o.kind}-${o.id}`}>
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>{o.name}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {o.email}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(params) => (
                <TextField {...params} label={t("users.invite.pickPerson")} size="small" autoFocus />
              )}
              slotProps={{ popper: { container: sheetMenu.container } }}
            />
          )}

          {/* Role only applies to employees (customers are always client). */}
          {isEmployee ? (
            <SelectField
              label={t("users.invite.role")}
              value={role}
              onChange={(v) => setRole(v as EmployeeRole)}
              disabled={busy}
              options={EMPLOYEE_ROLES.map((r) => ({ value: r, label: t(`users.roles.${r}`) }))}
            />
          ) : kind === "customer" ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {t("users.invite.clientRoleNote", { name: displayName })}
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
          disabled={!canSubmit}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("users.invite.send")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
