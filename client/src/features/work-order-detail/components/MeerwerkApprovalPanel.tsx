import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { Card } from "../../../components/Card";
import { StatusBadge } from "../../../components/StatusBadge";
import { HAIRLINE, TAP_TARGET } from "../../../theme/tokens";
import { euro, extraWorkBadge } from "../constants";
import { canApproveAsOffice, type UserRole } from "@opero/shared";
import type { WorkOrder, WorkOrderMaterial } from "../api";

// Meerwerk awaiting THIS user's approval, gathered from every zone.
//
// Meerwerk lines live inline in their zone now (they're ordinary lines with a
// flag), which is right for reading the werkbon but buries the one action a
// CLIENT ever takes in this product: approving extra work. This panel puts that
// back — it only appears when something is actually waiting on you, and it
// links each line to the money it commits.
export function MeerwerkApprovalPanel({
  workOrder,
  role,
  showPrices,
  busy,
  onApproveOffice,
  onApproveClient,
  onReject,
}: {
  workOrder: WorkOrder;
  role: UserRole;
  showPrices: boolean;
  busy: boolean;
  onApproveOffice: (matId: string) => void;
  onApproveClient: (matId: string) => void;
  onReject: (matId: string) => void;
}) {
  const { t } = useTranslation();

  // Only office and client ever approve; a technician reports meerwerk but
  // never signs it off.
  if (role === "technician") return null;

  const lines: { zone: string; m: WorkOrderMaterial }[] = [];
  for (const task of workOrder.tasks) {
    for (const m of task.materials) {
      if (!m.isExtraWork || m.rejected) continue;
      // "Waiting on me" differs by role: the office signs first, then the
      // client. Office staff must land in the OFFICE branch — treating them as
      // the client would leave them waiting on an approval they owe.
      const waiting = canApproveAsOffice(role)
        ? !m.approvedByOffice
        : m.approvedByOffice && !m.approvedByClient;
      if (waiting) lines.push({ zone: task.description, m });
    }
  }

  if (lines.length === 0) return null;

  const total = lines.reduce(
    (sum, { m }) => sum + (m.unitPrice != null ? m.quantity * m.unitPrice : 0),
    0,
  );

  return (
    <Card noPadding>
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("workOrderDetail.meerwerkApproval.title", { count: lines.length })}
        </Typography>
        {showPrices && total > 0 ? (
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {euro(total)}
          </Typography>
        ) : null}
      </Box>

      <Box sx={{ px: { xs: 2, md: 3 }, py: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t(
            canApproveAsOffice(role)
              ? "workOrderDetail.meerwerkApproval.officeHint"
              : "workOrderDetail.meerwerkApproval.clientHint",
          )}
        </Typography>

        {lines.map(({ zone, m }) => {
          const badge = extraWorkBadge(m);
          const lineTotal = m.unitPrice != null ? m.quantity * m.unitPrice : null;
          return (
            <Box
              key={m.id}
              sx={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1,
                py: 1.25,
                borderBottom: `1px solid ${HAIRLINE}`,
                "&:last-of-type": { borderBottom: "none" },
              }}
            >
              <Box sx={{ flex: 1, minWidth: { xs: "100%", sm: 160 } }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {m.label?.trim() || m.name || t("workOrderDetail.line.unnamed")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {[zone, `${m.quantity} ${m.unit}`.trim()].filter(Boolean).join(" · ")}
                </Typography>
              </Box>
              <StatusBadge
                label={t(`workOrderDetail.extraWorkStatus.${badge.key}`)}
                tone={badge.tone}
              />
              {showPrices && lineTotal != null ? (
                <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                  {euro(lineTotal)}
                </Typography>
              ) : null}
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {canApproveAsOffice(role) ? (
                  <>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => onApproveOffice(m.id)}
                      disabled={busy}
                      sx={{ minHeight: { xs: TAP_TARGET, sm: "auto" } }}
                    >
                      {t("workOrderDetail.extraWork.officeApprove")}
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => onReject(m.id)}
                      disabled={busy}
                      sx={{ minHeight: { xs: TAP_TARGET, sm: "auto" } }}
                    >
                      {t("workOrderDetail.extraWork.reject")}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => onApproveClient(m.id)}
                    disabled={busy}
                    sx={{ minHeight: { xs: TAP_TARGET, sm: "auto" } }}
                  >
                    {t("workOrderDetail.extraWork.clientApprove")}
                  </Button>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Card>
  );
}
