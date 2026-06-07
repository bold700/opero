"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { CustomerDialog } from "@/components/customer-dialog";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOperoStore } from "@/lib/store";
import { projectTypes } from "@/lib/types";

export function NewProjectDialog() {
  const router = useRouter();
  const customers = useOperoStore((state) => state.customers);
  const createProject = useOperoStore((state) => state.createProject);

  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [insulationType, setInsulationType] = useState("Nog te bepalen");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCustomerId("");
    setName("");
    setInsulationType("Nog te bepalen");
    setNotes("");
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customerId) {
      setError("Kies een opdrachtgever");
      return;
    }

    const project = createProject({
      customerId,
      name: name.trim() || undefined,
      insulationType,
      notes: notes.trim() || undefined,
    });

    if (!project) {
      setError("Aanmaken mislukt - onbekende opdrachtgever");
      return;
    }

    setOpen(false);
    reset();
    toast.success(`Project ${project.projectNumber} aangemaakt`);
    router.push(`/projects/${project.id}`);
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Nieuw project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nieuw project</DialogTitle>
          <DialogDescription>
            Kies een klant. Op de projectpagina beschrijf je daarna wat er moet
            gebeuren; dat wordt je offerte, werk en factuur.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="np-customer">Opdrachtgever</Label>
              <CustomerDialog
                onCreated={(customer) => setCustomerId(customer.id)}
                trigger={
                  <button
                    className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900"
                    type="button"
                  >
                    <UserPlus className="size-3.5" />
                    Nieuwe klant
                  </button>
                }
              />
            </div>
            <Select
              id="np-customer"
              onChange={(event) => setCustomerId(event.target.value)}
              value={customerId}
            >
              <option value="">Kies opdrachtgever</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} - {customer.city}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="np-name">Projectnaam (optioneel)</Label>
            <Input
              id="np-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Bijv. Spouwmuurisolatie kantoorpand"
              value={name}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="np-werksoort">Werksoort</Label>
            <Select
              id="np-werksoort"
              onChange={(event) => setInsulationType(event.target.value)}
              value={insulationType}
            >
              <option value="Nog te bepalen">Nog te bepalen</option>
              {projectTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="np-notes">Korte omschrijving (optioneel)</Label>
            <Textarea
              id="np-notes"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Bijv. klant belt over spouwmuurisolatie voor kantoorpand"
              value={notes}
            />
          </div>

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setOpen(false);
                reset();
              }}
              type="button"
              variant="outline"
            >
              Annuleren
            </Button>
            <Button type="submit" variant="success">
              Project aanmaken
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
