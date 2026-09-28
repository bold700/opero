import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import Link from "@mui/material/Link";
import { MultiSelectField } from "../../../components/MultiSelectField";
import { getContacts, type ContactPerson } from "../../customers/api";

// The "Contactpersonen" field of the project form: a multi-select over the
// chosen customer's contacts, disabled until a customer is picked. Contacts
// themselves are managed on the customer page (Klanten), not here.
export function ProjectContactsSection({
  customerId,
  selectedIds,
  busy,
  onChange,
}: {
  customerId: string;
  selectedIds: string[];
  busy: boolean;
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<ContactPerson[]>([]);

  // The options follow the chosen customer. Selected ids that don't belong to
  // the new customer are dropped, so a switch can't carry another customer's
  // contact onto the project.
  useEffect(() => {
    if (!customerId) {
      setContacts([]);
      return;
    }
    let cancelled = false;
    getContacts(customerId)
      .then((rows) => {
        if (cancelled) return;
        setContacts(rows);
        onChange(selectedIds.filter((id) => rows.some((r) => r.id === id)));
      })
      .catch(() => setContacts([]));
    return () => {
      cancelled = true;
    };
    // Runs on customer change only, pruning whatever is selected then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const noCustomer = !customerId;
  const noContacts = !noCustomer && contacts.length === 0;

  return (
    <MultiSelectField
      label={t("projects.form.contacts")}
      value={selectedIds}
      onChange={onChange}
      disabled={busy || noCustomer || noContacts}
      helperText={
        noCustomer ? (
          t("projects.form.contactsPickCustomer")
        ) : noContacts ? (
          <>
            {t("projects.form.contactsNone")}{" "}
            {/* Straight to the customer page with the contact dialog open
                (?create=1, the same param the quick-create menu uses). */}
            <Link component={RouterLink} to={`/customers/${customerId}?create=1`}>
              {t("projects.form.contactsAddLink")}
            </Link>
          </>
        ) : undefined
      }
      options={contacts.map((c) => ({
        value: c.id,
        label: c.role
          ? `${c.name || t("customers.contacts.unnamed")} (${c.role})`
          : c.name || t("customers.contacts.unnamed"),
      }))}
    />
  );
}
