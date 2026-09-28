import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { WorkOrderCustomer } from "../api";

// The customer's contact details as the MONTEUR needs them on site: a name to
// ask for and a number to call. Phones are `tel:` links and emails `mailto:`
// links — this is a PWA and the technician is on a phone, so a number that
// can't be tapped is a number that has to be retyped.
//
// Read-only: the customer record is edited under /customers, not from a
// werkbon.
export function CustomerContactBlock({
  customer,
  excludeIds = [],
}: {
  customer: WorkOrderCustomer;
  excludeIds?: string[];
}) {
  const { t } = useTranslation();

  // The customer's own contact fields form an implicit "main contact" row, so
  // it renders through the same markup as the contact-person rows below.
  const primary =
    customer.contactName || customer.phone || customer.email
      ? {
          id: "primary",
          name: customer.contactName || customer.name,
          phone: customer.phone,
          email: customer.email,
          role: undefined as string | undefined,
        }
      : null;

  const people = [
    ...(primary ? [primary] : []),
    ...customer.contactPersons.filter((person) => !excludeIds.includes(person.id)),
  ];
  if (people.length === 0) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {people.map((p) => (
        <Box key={p.id} sx={{ display: "flex", flexDirection: "column" }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {p.name || t("customers.contacts.unnamed")}
            {p.role ? (
              <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
                {` · ${p.role}`}
              </Box>
            ) : null}
          </Typography>
          {p.phone ? (
            <Link
              href={`tel:${p.phone.replace(/\s+/g, "")}`}
              variant="body2"
              underline="hover"
              // A tap target on a phone: give it room, and keep it on its own
              // line so a mis-tap doesn't hit the row below.
              sx={{ alignSelf: "flex-start", py: 0.25 }}
            >
              {p.phone}
            </Link>
          ) : null}
          {p.email ? (
            <Link
              href={`mailto:${p.email}`}
              variant="body2"
              underline="hover"
              sx={{ alignSelf: "flex-start", py: 0.25, wordBreak: "break-all" }}
            >
              {p.email}
            </Link>
          ) : null}
          {!p.phone && !p.email ? (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {t("workOrderDetail.info.noContactDetails")}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}
