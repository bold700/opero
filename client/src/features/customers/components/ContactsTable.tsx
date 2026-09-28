import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { useTranslation } from "react-i18next";
import { ResponsiveList } from "../../../components/ResponsiveList";
import type { ContactPerson } from "../api";
import { avatarColor, initials } from "../constants";

// The customer's contact persons: a table on desktop, cards on a phone.
// Edit/delete per row; adding lives in the section header on the page.
export function ContactsTable({
  contacts,
  canManage,
  busy,
  onEdit,
  onDelete,
}: {
  contacts: ContactPerson[];
  canManage: boolean;
  busy: boolean;
  onEdit: (c: ContactPerson) => void;
  onDelete: (c: ContactPerson) => void;
}) {
  const { t } = useTranslation();

  const nameCell = (c: ContactPerson) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Avatar sx={{ width: 36, height: 36, bgcolor: avatarColor(c.name || t("customers.contacts.unnamed")), fontSize: 13, fontWeight: 700 }}>
        {initials(c.name || t("customers.contacts.unnamed"))}
      </Avatar>
      <Typography sx={{ fontWeight: 600 }}>
        {c.name || t("customers.contacts.unnamed")}
      </Typography>
    </Box>
  );

  const actionsCell = (c: ContactPerson) =>
    canManage ? (
      <Box sx={{ display: "inline-flex", gap: 0.5 }}>
        <IconButton size="small" aria-label={t("common.actions.edit")} onClick={() => onEdit(c)} disabled={busy}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label={t("common.actions.delete")} onClick={() => onDelete(c)} disabled={busy}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>
    ) : null;

  return (
    <ResponsiveList
      items={contacts}
      keyOf={(c) => c.id}
      empty={t("customers.contacts.empty")}
      columns={[
        { header: t("customers.detail.colName"), cell: nameCell },
        { header: t("customers.detail.colRole"), cell: (c) => <Box sx={{ color: "text.secondary" }}>{c.role ?? ""}</Box> },
        { header: t("customers.detail.colEmail"), cell: (c) => <Box sx={{ color: "text.secondary" }}>{c.email ?? ""}</Box> },
        { header: t("customers.detail.colPhone"), cell: (c) => <Box sx={{ color: "text.secondary" }}>{c.phone ?? ""}</Box> },
        { header: t("customers.detail.colAction"), align: "right", cell: actionsCell },
      ]}
      renderCard={(c) => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            {nameCell(c)}
            {actionsCell(c)}
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, color: "text.secondary", fontSize: 13 }}>
            {[c.role, c.phone, c.email].filter(Boolean).map((v, i) => (
              <span key={i}>{i > 0 ? "· " : ""}{v}</span>
            ))}
          </Box>
        </Box>
      )}
    />
  );
}
