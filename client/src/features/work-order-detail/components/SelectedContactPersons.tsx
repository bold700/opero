import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { SPACING } from "../../../theme/tokens";
import type { CustomerContactPerson } from "../api";

export function SelectedContactPersons({
  contacts,
}: {
  contacts: CustomerContactPerson[];
}) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.itemGap }}>
      {contacts.map((contact) => (
        <Box key={contact.id} sx={{ display: "flex", flexDirection: "column", gap: SPACING.fieldLabelGap }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {contact.name || t("customers.contacts.unnamed")}
            {contact.role ? (
              <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
                {` · ${contact.role}`}
              </Box>
            ) : null}
          </Typography>
          {contact.phone ? (
            <Link
              href={`tel:${contact.phone.replace(/\s+/g, "")}`}
              variant="body2"
              underline="hover"
              sx={{ alignSelf: "flex-start" }}
            >
              {contact.phone}
            </Link>
          ) : null}
          {contact.email ? (
            <Link
              href={`mailto:${contact.email}`}
              variant="body2"
              underline="hover"
              sx={{ alignSelf: "flex-start", wordBreak: "break-all" }}
            >
              {contact.email}
            </Link>
          ) : null}
          {!contact.phone && !contact.email ? (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {t("workOrderDetail.info.noContactDetails")}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}
