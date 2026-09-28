import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { PageLayout } from "../../components/PageLayout";
import { NewButton } from "../../components/NewButton";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ContactPersonDialog, type ContactPersonDraft } from "../../components/ContactPersonDialog";
import { SPACING } from "../../theme/tokens";
import { useApi } from "../../lib/api/useApi";
import { useAuth } from "../../auth/AuthContext";
import { useCreateParam } from "../../lib/useCreateParam";
import { isOffice, canManageAccounts } from "@opero/shared";
import {
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getContacts,
  checkDuplicateContact,
  createContact,
  linkContact,
  updateContact,
  deleteContact,
  type Customer,
  type CustomerInput,
  type ContactPerson,
} from "./api";
import { CustomerInfoCard } from "./components/CustomerInfoCard";
import { ContactsTable } from "./components/ContactsTable";
import { CustomerDialog } from "./components/CustomerDialog";
import { TypeBadge } from "./components/TypeBadge";
import { InviteDialog, type InviteFixedTarget } from "../users/components/InviteDialog";
import { inviteUser, resendInvite, disableUser, enableUser, type InviteInput } from "../users/api";

function toInput(d: ContactPersonDraft) {
  return {
    firstName: d.firstName.trim(),
    lastName: d.lastName.trim(),
    role: d.role.trim() || undefined,
    email: d.email.trim() || undefined,
    phone: d.phone.trim() || undefined,
    notes: d.notes.trim() || undefined,
  };
}

function toDraft(c: ContactPerson): ContactPersonDraft {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    role: c.role ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    notes: c.notes ?? "",
  };
}

// Customer detail: the record (Klantgegevens) and the customer's contact
// persons — the central list that projects pick from. Editing the record and
// its login goes through the same CustomerDialog as the list page.
export function CustomerDetail() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role ?? "client";
  const canManage = isOffice(role);
  const canManageAccount = canManageAccounts(role);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const { loading, error } = useApi(
    async () => {
      const [c, list] = await Promise.all([getCustomer(id), getContacts(id)]);
      setCustomer(c);
      setContacts(list);
      return c;
    },
    [id],
  );
  const reloadContacts = useCallback(async () => setContacts(await getContacts(id)), [id]);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Customer record: edit dialog + delete confirm (same contract as the list).
  const [editOpen, setEditOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Contact persons: "new" opens an empty dialog, a contact opens it pre-filled.
  const [contactEditing, setContactEditing] = useState<"new" | ContactPerson | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [duplicateContact, setDuplicateContact] = useState<ContactPerson | null>(null);
  const [contactDeleting, setContactDeleting] = useState<ContactPerson | null>(null);
  // Arriving with ?create=1 (e.g. the link from the project form) opens the
  // new-contact dialog right away.
  useCreateParam(() => {
    setContactError(null);
    setContactEditing("new");
  }, canManage);

  // Login account (invite / resend / disable / enable), as on the list page.
  const [inviteTarget, setInviteTarget] = useState<InviteFixedTarget | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  const fail = (e: unknown, fallbackKey: string) =>
    setToast(e instanceof Error ? e.message : t(fallbackKey));

  const handleUpdate = async (input: CustomerInput) => {
    if (!customer) return;
    setBusy(true);
    setFormError(null);
    try {
      await updateCustomer(customer.id, input);
      setCustomer(await getCustomer(customer.id));
      setEditOpen(false);
      setToast(t("customers.toast.updated"));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("customers.toast.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!customer) return;
    setBusy(true);
    try {
      await deleteCustomer(customer.id);
      navigate("/customers");
    } catch (e) {
      fail(e, "customers.toast.deleteError");
      setBusy(false);
    }
  };

  const saveContact = async (draft: ContactPersonDraft) => {
    if (!customer || !contactEditing) return;
    setBusy(true);
    setContactError(null);
    setDuplicateContact(null);
    try {
      const input = toInput(draft);
      const duplicate = await checkDuplicateContact(customer.id, {
        email: input.email,
        phone: input.phone,
        ...(contactEditing === "new" ? {} : { excludeId: contactEditing.id }),
      });
      if (duplicate) {
        if (contactEditing === "new") setDuplicateContact(duplicate.contact);
        setContactError(
          t("customers.contacts.duplicate", {
            fields: duplicate.matchedFields
              .map((field) => t(`customers.contacts.duplicateField.${field}`))
              .join(` ${t("customers.contacts.duplicateAnd")} `),
            name: duplicate.contact.name || t("customers.contacts.unnamed"),
            customer: duplicate.customer.name,
          }),
        );
        return;
      }
      if (contactEditing === "new") await createContact(customer.id, input);
      else await updateContact(customer.id, contactEditing.id, input);
      setContactEditing(null);
      await reloadContacts();
    } catch (e) {
      setContactError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const linkDuplicateContact = async () => {
    if (!customer || !duplicateContact) return;
    setBusy(true);
    try {
      await linkContact(customer.id, duplicateContact.id);
      setContactEditing(null);
      setDuplicateContact(null);
      await reloadContacts();
      setToast(t("customers.contacts.linked"));
    } catch (e) {
      setContactError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runDeleteContact = async () => {
    if (!customer || !contactDeleting) return;
    setBusy(true);
    try {
      await deleteContact(customer.id, contactDeleting.id);
      setContactDeleting(null);
      await reloadContacts();
    } catch (e) {
      fail(e, "customers.toast.deleteError");
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async (input: InviteInput) => {
    setInviting(true);
    setInviteError(null);
    try {
      const created = await inviteUser(input);
      setInviteTarget(null);
      setToast(t("users.toast.invited", { email: created.email }));
      setCustomer(await getCustomer(id));
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : t("users.toast.inviteError"));
    } finally {
      setInviting(false);
    }
  };

  const handleResend = async () => {
    if (!customer?.account) return;
    setAccountBusy(true);
    try {
      await resendInvite(customer.account.userId);
      setToast(t("users.toast.resent", { name: customer.name }));
    } catch (e) {
      fail(e, "users.toast.actionError");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDisable = async () => {
    if (!customer?.account) return;
    setAccountBusy(true);
    try {
      await disableUser(customer.account.userId);
      setDisableOpen(false);
      setToast(t("users.toast.disabled", { name: customer.name }));
      setCustomer(await getCustomer(id));
    } catch (e) {
      fail(e, "users.toast.actionError");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleEnable = async () => {
    if (!customer?.account) return;
    setAccountBusy(true);
    try {
      await enableUser(customer.account.userId);
      setEditOpen(false);
      setToast(t("users.toast.enabled", { name: customer.name }));
      setCustomer(await getCustomer(id));
    } catch (e) {
      fail(e, "users.toast.actionError");
    } finally {
      setAccountBusy(false);
    }
  };

  if (loading) {
    return (
      <PageLayout title={t("customers.title")}>
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      </PageLayout>
    );
  }
  if (error || !customer) {
    return (
      <PageLayout title={t("customers.title")}>
        <Alert severity="error">{error ?? t("customers.detail.notFound")}</Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={t("customers.title")}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <IconButton aria-label={t("common.actions.back")} onClick={() => navigate("/customers")} sx={{ mt: -0.5, ml: -1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {customer.name}
              </Typography>
              <TypeBadge type={customer.type} />
            </Box>
          </Box>
          {canManage ? (
            <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
              <IconButton aria-label={t("common.actions.edit")} onClick={() => { setFormError(null); setEditOpen(true); }} disabled={busy}>
                <EditOutlinedIcon />
              </IconButton>
              <IconButton aria-label={t("common.actions.delete")} onClick={() => setDeleteOpen(true)} disabled={busy}>
                <DeleteOutlineIcon />
              </IconButton>
            </Box>
          ) : null}
        </Box>

        <CustomerInfoCard customer={customer} />

        {/* Contact persons — the central list projects pick from. */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t("customers.detail.contactsTitle")} ({contacts.length})
            </Typography>
            {canManage ? (
              <NewButton
                label={t("customers.detail.addContact")}
                onClick={() => { setContactError(null); setDuplicateContact(null); setContactEditing("new"); }}
              />
            ) : null}
          </Box>
          <ContactsTable
            contacts={contacts}
            canManage={canManage}
            busy={busy}
            onEdit={(c) => { setContactError(null); setContactEditing(c); }}
            onDelete={setContactDeleting}
          />
        </Box>
      </Box>

      <ContactPersonDialog
        open={contactEditing !== null}
        initial={contactEditing && contactEditing !== "new" ? toDraft(contactEditing) : null}
        busy={busy}
        error={contactError}
        errorAction={
          duplicateContact && contactEditing === "new"
            ? {
                label: t("customers.contacts.linkExisting"),
                onClick: () => void linkDuplicateContact(),
              }
            : undefined
        }
        onClose={() => { setContactEditing(null); setDuplicateContact(null); }}
        onSave={saveContact}
      />

      <ConfirmDialog
        open={contactDeleting !== null}
        title={t("customers.contacts.deleteTitle")}
        body={contactDeleting ? t("customers.contacts.deleteBody", { name: contactDeleting.name }) : undefined}
        busy={busy}
        destructive
        onClose={() => setContactDeleting(null)}
        onConfirm={runDeleteContact}
      />

      <CustomerDialog
        open={editOpen}
        customer={customer}
        busy={busy}
        error={formError}
        canManage={canManageAccount}
        canDelete={canManage}
        accountBusy={accountBusy}
        isSelf={customer.account?.userId === user?.id}
        onClose={() => setEditOpen(false)}
        onSubmit={handleUpdate}
        onInvite={() => {
          setEditOpen(false);
          setInviteError(null);
          setInviteTarget({ kind: "customer", id: customer.id, name: customer.name });
        }}
        onResend={handleResend}
        onDelete={() => { setEditOpen(false); setDeleteOpen(true); }}
        onDisable={() => { setEditOpen(false); setDisableOpen(true); }}
        onEnable={handleEnable}
      />

      <InviteDialog
        open={inviteTarget !== null}
        fixed={inviteTarget}
        busy={inviting}
        error={inviteError}
        onClose={() => setInviteTarget(null)}
        onSubmit={handleInvite}
      />

      <ConfirmDialog
        open={disableOpen}
        title={t("customers.dialog.account.confirmDisableTitle")}
        body={t("customers.dialog.account.confirmDisableBody", { name: customer.name })}
        busy={accountBusy}
        destructive
        confirmLabel={t("customers.dialog.account.disable")}
        onClose={() => setDisableOpen(false)}
        onConfirm={handleDisable}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={t("customers.delete.title")}
        body={t("customers.delete.body", { name: customer.name })}
        busy={busy}
        destructive
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      <Snackbar open={toast !== null} autoHideDuration={4000} onClose={() => setToast(null)} message={toast ?? ""} />
    </PageLayout>
  );
}
