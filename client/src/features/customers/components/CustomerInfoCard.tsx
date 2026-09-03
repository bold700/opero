import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Card } from "../../../components/Card";
import type { Customer } from "../api";

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
        {value}
      </Typography>
    </Box>
  );
}

// "Klantgegevens" — the customer's own record, read-only. Editing goes
// through the customer dialog (pencil in the page header).
export function CustomerInfoCard({ customer }: { customer: Customer }) {
  const { t } = useTranslation();
  const c = customer;
  const address = [c.address, [c.postalCode, c.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return (
    <Card>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("customers.detail.infoTitle")}
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
            gap: 2,
          }}
        >
          <Field label={t("customers.dialog.name")} value={c.name} />
          <Field label={t("customers.dialog.type")} value={t(`customers.typeBadge.${c.type}`)} />
          <Field label={t("customers.dialog.address")} value={address} />
          <Field label={t("customers.dialog.phone")} value={c.phone} />
          <Field label={t("customers.dialog.email")} value={c.email} />
          <Field label={t("customers.detail.kvk")} value={c.kvkNumber} />
          <Field label={t("customers.detail.vat")} value={c.vatNumber} />
        </Box>
        {c.notes ? (
          <Field label={t("customers.dialog.notes")} value={c.notes} />
        ) : null}
      </Box>
    </Card>
  );
}
