"use client";

import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOperoStore } from "@/lib/store";
import { type Customer } from "@/lib/types";

const emptyForm = {
  address: "",
  city: "",
  contactName: "",
  email: "",
  name: "",
  notes: "",
  phone: "",
  postalCode: "",
};

export function CustomerDialog({
  customer,
  onCreated,
  trigger,
}: {
  customer?: Customer;
  onCreated?: (customer: Customer) => void;
  trigger: ReactNode;
}) {
  const addCustomer = useOperoStore((state) => state.addCustomer);
  const updateCustomer = useOperoStore((state) => state.updateCustomer);
  const removeCustomer = useOperoStore((state) => state.removeCustomer);
  const isEdit = Boolean(customer);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function load() {
    setForm(
      customer
        ? {
            address: customer.address,
            city: customer.city,
            contactName: customer.contactName,
            email: customer.email,
            name: customer.name,
            notes: customer.notes ?? "",
            phone: customer.phone,
            postalCode: customer.postalCode,
          }
        : emptyForm,
    );
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Vul de organisatienaam in");
      return;
    }
    if (!form.contactName.trim()) {
      setError("Vul de contactpersoon in");
      return;
    }
    const values = {
      address: form.address.trim(),
      city: form.city.trim(),
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      name: form.name.trim(),
      notes: form.notes.trim() || undefined,
      phone: form.phone.trim(),
      postalCode: form.postalCode.trim(),
    };
    if (customer) {
      updateCustomer(customer.id, values);
      toast.success("Klant bijgewerkt");
    } else {
      const created = addCustomer(values);
      toast.success(`Klant ${created.name} aangemaakt`);
      onCreated?.(created);
    }
    setOpen(false);
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
      open={open}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Klant bewerken" : "Nieuwe klant"}</DialogTitle>
          <DialogDescription>
            Klanten worden hergebruikt over projecten heen. Vul de basisgegevens
            in; aanvullen kan later.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cd-name" label="Organisatie">
              <Input
                id="cd-name"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Bijv. De Vries Vastgoedbeheer"
                value={form.name}
              />
            </Field>
            <Field id="cd-contact" label="Contactpersoon">
              <Input
                id="cd-contact"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contactName: event.target.value }))
                }
                placeholder="Voor- en achternaam"
                value={form.contactName}
              />
            </Field>
            <Field id="cd-phone" label="Telefoon">
              <Input
                id="cd-phone"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder="06 ..."
                value={form.phone}
              />
            </Field>
            <Field id="cd-email" label="E-mail">
              <Input
                id="cd-email"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="contact@bedrijf.nl"
                type="email"
                value={form.email}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_8rem_1fr]">
            <Field id="cd-address" label="Adres">
              <Input
                id="cd-address"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, address: event.target.value }))
                }
                placeholder="Straat en nummer"
                value={form.address}
              />
            </Field>
            <Field id="cd-zip" label="Postcode">
              <Input
                id="cd-zip"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, postalCode: event.target.value }))
                }
                placeholder="1234 AB"
                value={form.postalCode}
              />
            </Field>
            <Field id="cd-city" label="Plaats">
              <Input
                id="cd-city"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, city: event.target.value }))
                }
                placeholder="Stad"
                value={form.city}
              />
            </Field>
          </div>

          <Field id="cd-notes" label="Notities (optioneel)">
            <Textarea
              id="cd-notes"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              placeholder="Bijv. toegang via beheerder, voorkeuren..."
              value={form.notes}
            />
          </Field>

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            {isEdit && customer ? (
              <Button
                className="text-zinc-400 hover:text-red-600"
                onClick={() => {
                  removeCustomer(customer.id);
                  toast.success(`${customer.name} verwijderd`);
                  setOpen(false);
                }}
                type="button"
                variant="ghost"
              >
                <Trash2 className="size-4" />
                Verwijderen
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                Annuleren
              </Button>
              <Button type="submit" variant="success">
                {isEdit ? "Opslaan" : "Klant aanmaken"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  children,
  id,
  label,
}: {
  children: ReactNode;
  id: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
