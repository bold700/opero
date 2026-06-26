import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { Card } from "../../../components/Card";
import { StatusBadge } from "../../../components/StatusBadge";
import { HAIRLINE } from "../../../theme/tokens";
import { extraWorkBadge, euro } from "../constants";
import type { ExtraWork, NewExtraWork } from "../api";

// The blockage / extra-work panel — the heart of the product. Anyone on the job
// (admin/technician) can report extra work; office (admin) approves; client
// approves; admin can reject. Each row shows its approval state.
export function ExtraWorkPanel({
  items,
  role,
  showPrices,
  busy,
  onReport,
  onApproveOffice,
  onApproveClient,
  onReject,
}: {
  items: ExtraWork[];
  role: "admin" | "technician" | "client";
  showPrices: boolean;
  busy: boolean;
  onReport: (input: NewExtraWork) => void;
  onApproveOffice: (id: string) => void;
  onApproveClient: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [reporting, setReporting] = useState(false);
  const canReport = role === "admin" || role === "technician";

  return (
    <Card noPadding>
      <Box
        sx={{
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("workOrderDetail.extraWork.title")}
        </Typography>
        {canReport && !reporting ? (
          <Button size="small" onClick={() => setReporting(true)} disabled={busy}>
            {t("workOrderDetail.extraWork.report")}
          </Button>
        ) : null}
      </Box>

      {reporting ? (
        <ReportForm
          showPrices={showPrices}
          busy={busy}
          onSubmit={(input) => {
            onReport(input);
            setReporting(false);
          }}
          onCancel={() => setReporting(false)}
        />
      ) : null}

      {items.length === 0 && !reporting ? (
        <Box sx={{ px: 3, py: 4, color: "text.secondary" }}>
          {t("workOrderDetail.extraWork.empty")}
        </Box>
      ) : (
        items.map((m) => {
          const badge = extraWorkBadge(m);
          return (
            <Box key={m.id} sx={{ px: 3, py: 2, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    {m.name || m.description}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
                    {m.quantity != null ? `${m.quantity} ${m.unit ?? ""}` : ""}
                    {showPrices && m.amount != null
                      ? `${m.quantity != null ? " · " : ""}${euro(m.amount)}`
                      : ""}
                  </Typography>
                </Box>
                <StatusBadge label={t(`workOrderDetail.extraWorkStatus.${badge.key}`)} tone={badge.tone} />
              </Box>

              {/* Role-gated approval actions */}
              <Box sx={{ display: "flex", gap: 1, mt: 1.25, flexWrap: "wrap" }}>
                {role === "admin" && !m.rejected ? (
                  <>
                    <Button
                      size="small"
                      variant={m.approvedByOffice ? "outlined" : "contained"}
                      onClick={() => onApproveOffice(m.id)}
                      disabled={busy}
                    >
                      {m.approvedByOffice
                        ? t("workOrderDetail.extraWork.officeApproved")
                        : t("workOrderDetail.extraWork.officeApprove")}
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => onReject(m.id)}
                      disabled={busy}
                    >
                      {t("workOrderDetail.extraWork.reject")}
                    </Button>
                  </>
                ) : null}
                {role === "client" && m.approvedByOffice && !m.rejected ? (
                  <Button
                    size="small"
                    variant={m.approvedByClient ? "outlined" : "contained"}
                    onClick={() => onApproveClient(m.id)}
                    disabled={busy}
                  >
                    {m.approvedByClient
                      ? t("workOrderDetail.extraWork.clientApproved")
                      : t("workOrderDetail.extraWork.clientApprove")}
                  </Button>
                ) : null}
              </Box>
            </Box>
          );
        })
      )}
    </Card>
  );
}

function ReportForm({
  showPrices,
  busy,
  onSubmit,
  onCancel,
}: {
  showPrices: boolean;
  busy: boolean;
  onSubmit: (input: NewExtraWork) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      quantity: quantity ? Number(quantity) : undefined,
      unit: unit.trim() || undefined,
      unitPrice: showPrices && unitPrice ? Number(unitPrice) : undefined,
    });
  };

  return (
    <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${HAIRLINE}`, display: "flex", gap: 1, flexWrap: "wrap" }}>
      <TextField
        size="small"
        placeholder={t("workOrderDetail.extraWork.descriptionPlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        sx={{ flex: 1, minWidth: 200 }}
      />
      <TextField
        size="small"
        placeholder={t("workOrderDetail.material.quantity")}
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        sx={{ width: 90 }}
      />
      <TextField
        size="small"
        placeholder={t("workOrderDetail.material.unit")}
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        sx={{ width: 100 }}
      />
      {showPrices ? (
        <TextField
          size="small"
          placeholder={t("workOrderDetail.material.price")}
          type="number"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          sx={{ width: 100 }}
        />
      ) : null}
      <Button size="small" variant="contained" onClick={submit} disabled={busy || !name.trim()}>
        {t("workOrderDetail.extraWork.submit")}
      </Button>
      <Button size="small" onClick={onCancel} disabled={busy}>
        {t("common.actions.cancel")}
      </Button>
    </Box>
  );
}
