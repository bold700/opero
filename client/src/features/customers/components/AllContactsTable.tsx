import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { ResponsiveList } from "../../../components/ResponsiveList";
import type { ContactPersonOverview } from "../api";
import { avatarColor, initials } from "../constants";

export function AllContactsTable({
  contacts,
  hasMore,
  loadingMore,
  onLoadMore,
  onOpenCustomer,
}: {
  contacts: ContactPersonOverview[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpenCustomer: (customerId: string) => void;
}) {
  const { t } = useTranslation();

  const nameCell = (contact: ContactPersonOverview) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Avatar
        sx={{
          width: 36,
          height: 36,
          bgcolor: avatarColor(contact.name || t("customers.contacts.unnamed")),
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {initials(contact.name || t("customers.contacts.unnamed"))}
      </Avatar>
      <Typography sx={{ fontWeight: 600 }}>
        {contact.name || t("customers.contacts.unnamed")}
      </Typography>
    </Box>
  );

  const projectNames = (contact: ContactPersonOverview) =>
    contact.projects
      .map((project) => project.name || project.projectNumber)
      .join(", ");
  const customerNames = (contact: ContactPersonOverview) =>
    (contact.customers?.length ? contact.customers : [contact.customer])
      .map((customer) => customer.name)
      .join(", ");

  return (
    <ResponsiveList
      items={contacts}
      keyOf={(contact) => contact.id}
      empty={t("customers.contacts.overviewEmpty")}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      onRowClick={(contact) => onOpenCustomer(contact.customer.id)}
      columns={[
        { header: t("customers.detail.colName"), cell: nameCell },
        {
          header: t("customers.contacts.customer"),
          cell: (contact) => (
            <Box sx={{ fontWeight: 600 }}>{customerNames(contact)}</Box>
          ),
        },
        {
          header: t("customers.detail.colRole"),
          cell: (contact) => (
            <Box sx={{ color: "text.secondary" }}>{contact.role ?? ""}</Box>
          ),
        },
        {
          header: t("customers.detail.colEmail"),
          cell: (contact) => (
            <Box sx={{ color: "text.secondary" }}>{contact.email ?? ""}</Box>
          ),
        },
        {
          header: t("customers.detail.colPhone"),
          cell: (contact) => (
            <Box sx={{ color: "text.secondary" }}>{contact.phone ?? ""}</Box>
          ),
        },
        {
          header: t("customers.contacts.projects"),
          cell: (contact) => (
            <Box sx={{ color: "text.secondary" }}>{projectNames(contact)}</Box>
          ),
        },
      ]}
      renderCard={(contact) => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {nameCell(contact)}
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {customerNames(contact)}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {[contact.role, contact.phone, contact.email]
              .filter(Boolean)
              .join(" · ")}
          </Typography>
          {contact.projects.length > 0 ? (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {t("customers.contacts.projects")}: {projectNames(contact)}
            </Typography>
          ) : null}
        </Box>
      )}
    />
  );
}
