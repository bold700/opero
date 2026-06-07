"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Check,
  LayoutGrid,
  Plus,
  Search,
  Table as TableIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOperoStore } from "@/lib/store";
import { cn, initials } from "@/lib/utils";
import { STAGE_LABELS } from "@/lib/stages";
import { memberStages, teamRoleConfig, teamRoleOrder } from "@/lib/roles";
import { type Role, type TeamMember } from "@/lib/types";

type View = "card" | "table";

function roleLabelFor(member: TeamMember) {
  return member.roles.length > 0
    ? member.roles.map((role) => teamRoleConfig[role].label).join(", ")
    : "Geen rollen";
}

export function PersoneelClient() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("card");
  const teamMembers = useOperoStore((state) => state.teamMembers);
  const projects = useOperoStore((state) => state.projects);

  const projectsByMember = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((project) => {
      const ids = new Set([
        project.projectLeaderId,
        project.teamLeaderId,
        ...project.installerIds,
      ]);
      ids.forEach((id) => {
        if (!id) return;
        map.set(id, (map.get(id) ?? 0) + 1);
      });
    });
    return map;
  }, [projects]);

  const filtered = teamMembers.filter((member) => {
    if (!query) return true;
    const needle = query.toLowerCase();
    return (
      member.name.toLowerCase().includes(needle) ||
      member.roles.some((role) => role.toLowerCase().includes(needle))
    );
  });

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Personeel</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {filtered.length} {filtered.length === 1 ? "persoon" : "personen"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                className="h-9 pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Zoek op naam of rol"
                value={query}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-zinc-200 p-0.5">
                <Button
                  className={view === "card" ? "bg-zinc-100" : ""}
                  onClick={() => setView("card")}
                  size="sm"
                  variant="ghost"
                >
                  <LayoutGrid className="size-4" />
                  Kaart
                </Button>
                <Button
                  className={view === "table" ? "bg-zinc-100" : ""}
                  onClick={() => setView("table")}
                  size="sm"
                  variant="ghost"
                >
                  <TableIcon className="size-4" />
                  Tabel
                </Button>
              </div>
              <PersoonDialog
                trigger={
                  <Button size="sm">
                    <Plus className="size-4" />
                    Nieuwe persoon
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </Card>

      {view === "card" ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((member) => (
            <PersoonCard
              key={member.id}
              member={member}
              projectCount={projectsByMember.get(member.id) ?? 0}
            />
          ))}
          {filtered.length === 0 ? (
            <div className="lg:col-span-2 xl:col-span-3">
              <EmptyState label="Geen personen gevonden" />
            </div>
          ) : null}
        </div>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Persoon</TableHead>
                  <TableHead>Rollen</TableHead>
                  <TableHead className="w-28 text-right">Projecten</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((member) => (
                  <PersoonRow
                    key={member.id}
                    member={member}
                    projectCount={projectsByMember.get(member.id) ?? 0}
                  />
                ))}
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="text-center text-sm text-zinc-500"
                      colSpan={3}
                    >
                      Geen personen gevonden
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

function PersoonRow({
  member,
  projectCount,
}: {
  member: TeamMember;
  projectCount: number;
}) {
  return (
    <TableRow>
      <TableCell>
        <PersoonDialog
          member={member}
          trigger={
            <button
              className="flex items-center gap-3 text-left transition hover:opacity-80 focus-visible:outline-none"
              type="button"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">
                {initials(member.name)}
              </div>
              <span className="font-medium text-zinc-950 hover:underline">
                {member.name}
              </span>
            </button>
          }
        />
      </TableCell>
      <TableCell className="text-sm text-zinc-600">
        {roleLabelFor(member)}
      </TableCell>
      <TableCell className="text-right">
        <Badge variant="outline">{projectCount}</Badge>
      </TableCell>
    </TableRow>
  );
}

function PersoonCard({
  member,
  projectCount,
}: {
  member: TeamMember;
  projectCount: number;
}) {
  const roleLabel = roleLabelFor(member);

  return (
    <PersoonDialog
      member={member}
      trigger={
        <button
          className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-zinc-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500"
          type="button"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">
            {initials(member.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-zinc-950">
              {member.name}
            </p>
            <p className="truncate text-xs text-zinc-500">{roleLabel}</p>
          </div>
          <Badge variant="outline">{projectCount} projecten</Badge>
        </button>
      }
    />
  );
}

function PersoonDialog({
  member,
  trigger,
}: {
  member?: TeamMember;
  trigger: ReactNode;
}) {
  const addTeamMember = useOperoStore((state) => state.addTeamMember);
  const updateTeamMember = useOperoStore((state) => state.updateTeamMember);
  const removeTeamMember = useOperoStore((state) => state.removeTeamMember);
  const isEdit = Boolean(member);

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [roles, setRoles] = useState<Role[]>([]);

  function load() {
    setForm({
      name: member?.name ?? "",
      phone: member?.phone ?? "",
      email: member?.email ?? "",
    });
    setRoles(member?.roles ?? []);
    setError(null);
  }

  function toggleRole(role: Role) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Vul een naam in");
      return;
    }
    if (member) {
      updateTeamMember(member.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        roles,
      });
      toast.success("Persoonskaart bijgewerkt");
    } else {
      const created = addTeamMember({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        roles: [],
      });
      toast.success(`${created.name} aangemaakt, ken nu rollen toe`);
    }
    setOpen(false);
  }

  const stages = memberStages(roles);

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
      open={open}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Persoon bewerken" : "Nieuwe persoon"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Pas de gegevens aan en ken rollen toe. Rollen bepalen fases en rechten."
              : "Maak eerst de persoonskaart aan. Rollen ken je daarna toe via Bewerken."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="ps-name">Naam</Label>
            <Input
              id="ps-name"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Voor- en achternaam"
              value={form.name}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ps-phone">Telefoon</Label>
              <Input
                id="ps-phone"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder="06 ..."
                value={form.phone}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ps-email">E-mail</Label>
              <Input
                id="ps-email"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="naam@opero.nl"
                type="email"
                value={form.email}
              />
            </div>
          </div>

          {isEdit ? (
            <div className="space-y-2">
              <Label>Rollen</Label>
              <div className="flex flex-wrap gap-1.5">
                {teamRoleOrder.map((role) => {
                  const active = roles.includes(role);
                  return (
                    <button
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500",
                        active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-zinc-200 text-zinc-500 hover:bg-zinc-50",
                      )}
                      key={role}
                      onClick={() => toggleRole(role)}
                      type="button"
                    >
                      {active ? <Check className="size-3" /> : null}
                      {teamRoleConfig[role].label}
                    </button>
                  );
                })}
              </div>
              {roles.length > 0 ? (
                <p className="text-xs text-zinc-500">
                  Belangrijk in:{" "}
                  {stages.map((stage) => STAGE_LABELS[stage]).join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            {isEdit && member ? (
              <Button
                className="text-zinc-400 hover:text-red-600"
                onClick={() => {
                  removeTeamMember(member.id);
                  toast.success(`${member.name} verwijderd`);
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
              <Button type="submit">
                {isEdit ? "Opslaan" : "Persoon aanmaken"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
