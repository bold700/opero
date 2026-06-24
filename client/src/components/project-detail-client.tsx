"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Camera,
  Check,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Info,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useOperoStore } from "@/lib/store";
import { type AccountRole } from "@/lib/roles";
import { STAGE_LABELS, getStage, meerwerkApproved } from "@/lib/stages";
import {
  type Customer,
  type Project,
  type ProjectUrgency,
  type TaakMateriaal,
  type WerkbonTaak,
} from "@/lib/types";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

type ViewMode = "klant" | "view" | "edit";

function canManage(role: AccountRole) {
  return (
    role === "super_admin" ||
    role === "projectmanager" ||
    role === "administratie"
  );
}

function planDurationDays(project: Project): number {
  if (!project.plannedDate) return 1;
  const end = project.plannedEndDate ?? project.plannedDate;
  return (
    Math.round(
      (Date.parse(end) - Date.parse(project.plannedDate)) / 86_400_000,
    ) + 1
  );
}

function regelLabel(m: TaakMateriaal): string {
  if (m.label?.trim()) return m.label;
  if (m.diameter) return `Leidingen Ø${m.diameter} isoleren`;
  return m.name || "Werk";
}

export function ProjectDetailClient() {
  const routeId = useSearchParams().get("id");
  const projects = useOperoStore((state) => state.projects);
  const customers = useOperoStore((state) => state.customers);
  const profiles = useOperoStore((state) => state.profiles);
  const activeProfileId = useOperoStore((state) => state.activeProfileId);
  const addWerkbonTask = useOperoStore((state) => state.addWerkbonTask);
  const ensureWerkbon = useOperoStore((state) => state.ensureWerkbon);
  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];

  const project = projects.find((item) => item.id === routeId);
  const customer = project
    ? customers.find((item) => item.id === project.customerId)
    : undefined;

  if (!project || !customer) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Project niet gevonden</h1>
        <Button asChild>
          <Link href="/projects">Terug naar projecten</Link>
        </Button>
      </div>
    );
  }

  const stage = getStage(project);
  const isKlant = activeProfile.role === "opdrachtgever";
  const manage = canManage(activeProfile.role);
  // Admin/managers bewerken altijd, geen toggle nodig.
  const mode: ViewMode = isKlant ? "klant" : manage ? "edit" : "view";
  const firstWerkbonId = project.werkbonnen?.[0]?.id;
  const projectId = project.id;

  function addZone() {
    if (firstWerkbonId) {
      addWerkbonTask(projectId, firstWerkbonId);
    } else {
      // Oud project zonder werkbon: maak er een met een lege zone.
      ensureWerkbon(projectId);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-2">
            <Button asChild className="-ml-2" size="icon" variant="ghost">
              <Link aria-label="Terug" href="/projects">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-950">
                {project.name || customer.name}
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                <span>{customer.name}</span>
                <span className="text-zinc-300">|</span>
                <Badge
                  variant={
                    stage === "done"
                      ? "emerald"
                      : stage === "ready"
                        ? "violet"
                        : stage === "in_progress"
                          ? "cyan"
                          : "zinc"
                  }
                >
                  {STAGE_LABELS[stage]}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isKlant ? (
              <OpmerkingDialog
                projectId={project.id}
                trigger={
                  <Button>
                    <MessageSquare className="size-4" />
                    Opmerking
                  </Button>
                }
              />
            ) : (
              <>
                <Button aria-label="Offerte" asChild size="icon" variant="outline">
                  <Link
                    href={`/project/offerte?id=${project.id}`}
                    target="_blank"
                  >
                    <FileText className="size-4" />
                  </Link>
                </Button>
                {manage ? (
                  <DeleteProjectButton
                    projectId={project.id}
                    projectLabel={project.customerName}
                  />
                ) : null}
                <InfoSheet customer={customer} mode={mode} project={project} />
                {manage ? (
                  <Button aria-label="Zone toevoegen" onClick={addZone} size="icon">
                    <Plus className="size-4" />
                  </Button>
                ) : null}
                <WerkbonAfrondenButton project={project} />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="min-w-0 space-y-5">
          <WerkbonZones mode={mode} project={project} />
          <MeerwerkSection mode={mode} project={project} />
        </div>
        {/* Desktop: vaste zijbalk. Mobiel: zit in de InfoSheet hierboven. */}
        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <ProjectInfoContent customer={customer} mode={mode} project={project} />
        </aside>
      </div>
    </div>
  );
}

/* ---------- Zones ---------- */

function WerkbonZones({
  project,
  mode,
}: {
  project: Project;
  mode: ViewMode;
}) {
  const ensureWerkbon = useOperoStore((state) => state.ensureWerkbon);
  const addWerkbonTask = useOperoStore((state) => state.addWerkbonTask);
  const zones = (project.werkbonnen ?? []).flatMap((wb) =>
    wb.tasks.map((task) => ({ werkbonId: wb.id, task })),
  );

  // Voeg een zone toe aan de bestaande werkbon, of maak er een als die er
  // (nog) niet is. De werkbon kan bestaan terwijl alle zones verwijderd zijn.
  function addZone() {
    const firstWerkbonId = project.werkbonnen?.[0]?.id;
    if (firstWerkbonId) {
      addWerkbonTask(project.id, firstWerkbonId);
    } else {
      ensureWerkbon(project.id);
    }
  }

  if (zones.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          <div>
            <p className="font-semibold text-zinc-950">Nog geen taken</p>
            <p className="text-sm text-zinc-500">
              {mode === "edit"
                ? "Maak een eerste taak aan"
                : "Er is nog niets te doen voor dit project."}
            </p>
          </div>
          {mode === "edit" ? (
            <Button onClick={addZone} size="sm">
              <Plus className="size-4" />
              Taak aanmaken
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  // Edit: open kaarten met de prullenbak rechts, sleepbaar om te ordenen.
  // View/klant: accordion.
  if (mode === "edit") {
    return <SortableZones projectId={project.id} zones={zones} />;
  }

  return (
    <Accordion
      className="space-y-3"
      defaultValue={[zones[0].task.id]}
      type="multiple"
    >
      {zones.map(({ werkbonId, task }) => (
        <ZoneViewItem
          key={task.id}
          mode={mode}
          projectId={project.id}
          task={task}
          werkbonId={werkbonId}
        />
      ))}
    </Accordion>
  );
}

type Zone = { werkbonId: string; task: WerkbonTaak };

function subscribeMount(onChange: () => void) {
  const id = window.setTimeout(onChange, 0);
  return () => window.clearTimeout(id);
}

function SortableZones({
  projectId,
  zones,
}: {
  projectId: string;
  zones: Zone[];
}) {
  const reorderWerkbonTasks = useOperoStore(
    (state) => state.reorderWerkbonTasks,
  );
  // Pas slepen na mount: voorkomt hydratie-mismatch door dnd-kit ids.
  const mounted = useSyncExternalStore(
    subscribeMount,
    () => true,
    () => false,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  if (!mounted) {
    return (
      <div className="space-y-3">
        {zones.map(({ werkbonId, task }) => (
          <ZoneEditCard
            key={task.id}
            projectId={projectId}
            task={task}
            werkbonId={werkbonId}
          />
        ))}
      </div>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeZone = zones.find((z) => z.task.id === active.id);
    const overZone = zones.find((z) => z.task.id === over.id);
    // Alleen ordenen binnen dezelfde werkbon.
    if (!activeZone || !overZone || activeZone.werkbonId !== overZone.werkbonId) {
      return;
    }
    reorderWerkbonTasks(
      projectId,
      activeZone.werkbonId,
      String(active.id),
      String(over.id),
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <SortableContext
        items={zones.map((z) => z.task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {zones.map(({ werkbonId, task }) => (
            <SortableZoneEditCard
              key={task.id}
              projectId={projectId}
              task={task}
              werkbonId={werkbonId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableZoneEditCard({
  projectId,
  werkbonId,
  task,
}: {
  projectId: string;
  werkbonId: string;
  task: WerkbonTaak;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      className={cn(isDragging && "relative z-10 opacity-70")}
      ref={setNodeRef}
      style={style}
    >
      <ZoneEditCard
        dragHandle={
          <button
            aria-label="Sleep om te ordenen"
            className="shrink-0 cursor-grab touch-none rounded p-1 text-zinc-400 hover:text-zinc-700 active:cursor-grabbing"
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        }
        projectId={projectId}
        task={task}
        werkbonId={werkbonId}
      />
    </div>
  );
}

function zoneStatus(task: WerkbonTaak) {
  const named = task.materials.filter((m) => m.name.trim());
  return named.length > 0 && named.every((m) => m.done);
}

function ConfirmDelete({
  title,
  description,
  onConfirm,
  trigger,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setOpen(false)} variant="outline">
            Annuleren
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
            variant="destructive"
          >
            <Trash2 className="size-4" />
            Verwijderen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ZoneEditCard({
  projectId,
  werkbonId,
  task,
  dragHandle,
}: {
  projectId: string;
  werkbonId: string;
  task: WerkbonTaak;
  dragHandle?: ReactNode;
}) {
  const removeWerkbonTask = useOperoStore((state) => state.removeWerkbonTask);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          {dragHandle ?? <span />}
          <ConfirmDelete
            description="De zone en alle taken erin worden verwijderd. Dit kan niet ongedaan worden gemaakt."
            onConfirm={() => removeWerkbonTask(projectId, werkbonId, task.id)}
            title="Zone verwijderen?"
            trigger={
              <button
                aria-label="Zone verwijderen"
                className="shrink-0 rounded p-1 text-zinc-400 hover:text-red-600"
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
            }
          />
        </div>
        <ZoneBody
          mode="edit"
          projectId={projectId}
          task={task}
          werkbonId={werkbonId}
        />
      </CardContent>
    </Card>
  );
}

function ZoneViewItem({
  projectId,
  werkbonId,
  task,
  mode,
}: {
  projectId: string;
  werkbonId: string;
  task: WerkbonTaak;
  mode: ViewMode;
}) {
  const allDone = zoneStatus(task);

  return (
    <AccordionItem
      className="rounded-lg border border-zinc-200 bg-white px-4 last:border-b"
      value={task.id}
    >
      <AccordionTrigger className="hover:no-underline">
        <div className="flex flex-col items-start gap-1">
          <span className="font-medium text-zinc-900">
            {task.description || "Zone"}
          </span>
          <Badge variant={allDone ? "emerald" : "zinc"}>
            {allDone ? "Klaar" : "Nog te doen"}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pb-4">
        <ZoneBody
          mode={mode}
          projectId={projectId}
          task={task}
          werkbonId={werkbonId}
        />
      </AccordionContent>
    </AccordionItem>
  );
}

function ZoneBody({
  projectId,
  werkbonId,
  task,
  mode,
}: {
  projectId: string;
  werkbonId: string;
  task: WerkbonTaak;
  mode: ViewMode;
}) {
  const updateWerkbonTask = useOperoStore((state) => state.updateWerkbonTask);
  const addResult = useOperoStore((state) => state.addTaakResultPhoto);
  const removeTaakPhoto = useOperoStore((state) => state.removeTaakPhoto);

  const isEdit = mode === "edit";
  const isKlant = mode === "klant";
  const named = task.materials.filter((m) => m.name.trim());
  const rows = isEdit ? task.materials : named;
  const photos = [...task.beforePhotos, ...task.resultPhotos];

  const allDone = zoneStatus(task);

  return (
    <>
      {isEdit ? (
        <>
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase text-zinc-400">Taak</p>
            <Input
              defaultValue={task.description}
              key={`zn-${task.description}`}
              onBlur={(event) =>
                updateWerkbonTask(projectId, werkbonId, task.id, {
                  description: event.target.value,
                })
              }
              placeholder="Techniekruimte"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase text-zinc-400">Status</p>
            <Badge variant={allDone ? "emerald" : "zinc"}>
              {allDone ? "Klaar" : "Nog te doen"}
            </Badge>
          </div>
        </>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase text-zinc-400">
          Werkomschrijving
        </p>
        {isEdit ? (
          <Textarea
            defaultValue={task.note ?? ""}
            key={`wo-${task.note}`}
            onBlur={(event) =>
              updateWerkbonTask(projectId, werkbonId, task.id, {
                note: event.target.value,
              })
            }
            placeholder="Wat moet er in deze zone gebeuren?"
            rows={2}
          />
        ) : (
          <p className="text-sm text-zinc-600">{task.note || "—"}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase text-zinc-400">Taken</p>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">Nog geen taken.</p>
        ) : (
          <div className="rounded-lg border border-zinc-200">
            {rows.map((m) => (
              <RegelRow
                key={m.id}
                m={m}
                mode={mode}
                projectId={projectId}
                taskId={task.id}
                werkbonId={werkbonId}
              />
            ))}
          </div>
        )}
        {isEdit ? (
          <TaakAddDialog
            projectId={projectId}
            taskId={task.id}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Taak toevoegen
              </Button>
            }
            werkbonId={werkbonId}
          />
        ) : null}
        {mode === "view" ? (
          <MeerwerkAddDialog
            projectId={projectId}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Meerwerk toevoegen
              </Button>
            }
          />
        ) : null}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase text-zinc-400">Fotos</p>
        <div className="flex flex-wrap items-center gap-2">
          {photos.length === 0 && isKlant ? (
            <p className="text-sm text-zinc-500">Nog geen fotos.</p>
          ) : null}
          {photos.map((photo) => (
            <div
              className="relative flex size-16 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-zinc-400"
              key={photo}
            >
              <ImageIcon className="size-5" />
              {!isKlant ? (
                <ConfirmDelete
                  description="Deze foto wordt verwijderd."
                  onConfirm={() =>
                    removeTaakPhoto(projectId, werkbonId, task.id, photo)
                  }
                  title="Foto verwijderen?"
                  trigger={
                    <button
                      aria-label="Foto verwijderen"
                      className="absolute right-0.5 top-0.5 rounded bg-white/80 p-0.5 text-zinc-500 hover:text-red-600"
                      type="button"
                    >
                      <X className="size-3" />
                    </button>
                  }
                />
              ) : null}
            </div>
          ))}
        </div>
        {!isKlant ? (
          <Button
            onClick={() => addResult(projectId, werkbonId, task.id)}
            size="sm"
          >
            <Camera className="size-4" />
            Foto uploaden
          </Button>
        ) : null}
      </div>
    </>
  );
}

function RegelRow({
  projectId,
  werkbonId,
  taskId,
  m,
  mode,
}: {
  projectId: string;
  werkbonId: string;
  taskId: string;
  m: TaakMateriaal;
  mode: ViewMode;
}) {
  const toggleDone = useOperoStore((state) => state.toggleMateriaalDone);
  const updateTaakMateriaal = useOperoStore(
    (state) => state.updateTaakMateriaal,
  );
  const removeTaakMateriaal = useOperoStore(
    (state) => state.removeTaakMateriaal,
  );
  const addResult = useOperoStore((state) => state.addTaakResultPhoto);
  const articles = useOperoStore((state) => state.articles);
  // Bij afronden vraagt de monteur om een bewijsfoto. De foto's worden pas
  // toegevoegd bij "Afronden", niet bij "Annuleren".
  const [completeOpen, setCompleteOpen] = useState(false);
  const [stagedPhotos, setStagedPhotos] = useState(0);
  const [undoOpen, setUndoOpen] = useState(false);

  if (mode === "edit") {
    const typeArticles = articles.filter(
      (a) => a.category === "isolatie" || a.category === "materiaal",
    );
    const matched = typeArticles.find((a) => a.name === m.name);
    return (
      <div className="flex flex-col gap-2 border-b border-zinc-100 p-2 last:border-b-0 sm:flex-row sm:items-center">
        {/* Mobiel: regel 1 = afvinken, naam en verwijderen. */}
        <div className="flex items-center gap-2 sm:contents">
          <Checkbox
            checked={Boolean(m.done)}
            className="shrink-0 sm:order-1"
            onCheckedChange={() => toggleDone(projectId, werkbonId, taskId, m.id)}
          />
          <Input
            className="h-9 flex-1 sm:order-2"
            defaultValue={m.label ?? ""}
            key={`l-${m.label}`}
            onBlur={(event) =>
              updateTaakMateriaal(projectId, werkbonId, taskId, m.id, {
                label: event.target.value,
              })
            }
            placeholder={regelLabel(m)}
          />
          <ConfirmDelete
            description="Deze taakregel wordt verwijderd."
            onConfirm={() =>
              removeTaakMateriaal(projectId, werkbonId, taskId, m.id)
            }
            title="Taak verwijderen?"
            trigger={
              <Button
                aria-label="Regel verwijderen"
                className="shrink-0 sm:order-9"
                size="icon"
                variant="ghost"
              >
                <Trash2 className="size-4 text-zinc-400" />
              </Button>
            }
          />
        </div>
        {/* Mobiel: regel 2 = status, aantal, type, Ø en prijs. */}
        <div className="flex flex-wrap items-center gap-2 pl-7 sm:contents sm:pl-0">
          <Badge
            className="sm:order-3"
            variant={m.done ? "emerald" : "zinc"}
          >
            {m.done ? "Klaar" : "Open"}
          </Badge>
          <Input
            className="h-9 w-20 sm:order-4 sm:w-16"
            defaultValue={m.quantity}
            key={`q-${m.quantity}`}
            min={0}
            onBlur={(event) =>
              updateTaakMateriaal(projectId, werkbonId, taskId, m.id, {
                quantity: Number(event.target.value) || 0,
              })
            }
            type="number"
          />
          <Select
            className="h-9 w-full"
            wrapperClassName="min-w-[8rem] flex-1 sm:order-5 sm:w-36 sm:flex-none"
            onChange={(event) => {
              const article = typeArticles.find(
                (a) => a.id === event.target.value,
              );
              if (article) {
                updateTaakMateriaal(projectId, werkbonId, taskId, m.id, {
                  name: article.name,
                  unit: article.unit,
                  unitPrice: article.unitPrice,
                });
              }
            }}
            value={matched ? matched.id : ""}
          >
            <option value="">Type...</option>
            {typeArticles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            {!matched && m.name ? <option value="">{m.name}</option> : null}
          </Select>
          <Input
            className="h-9 w-16 sm:order-6"
            defaultValue={m.diameter ?? ""}
            key={`d-${m.diameter}`}
            min={0}
            onBlur={(event) =>
              updateTaakMateriaal(projectId, werkbonId, taskId, m.id, {
                diameter: Number(event.target.value) || undefined,
              })
            }
            placeholder="Ø"
            type="number"
          />
          <span className="ml-auto text-right text-sm font-medium text-zinc-700 sm:order-7 sm:ml-0 sm:w-16">
            {formatCurrency((m.quantity || 0) * (m.unitPrice || 0))}
          </span>
        </div>
      </div>
    );
  }

  const row = (
    <>
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          m.done ? "text-zinc-400 line-through" : "text-zinc-800",
        )}
      >
        {regelLabel(m)}
      </span>
      <span className="flex w-24 shrink-0 justify-start">
        <Badge variant={m.done ? "emerald" : "zinc"}>
          {m.done ? "Klaar" : "Open"}
        </Badge>
      </span>
      <span className="w-16 shrink-0 text-zinc-600">
        {m.quantity} {m.unit}
      </span>
      <span className="hidden w-44 shrink-0 truncate text-zinc-600 sm:inline">
        {m.name}
      </span>
      <span className="w-12 shrink-0 text-right text-zinc-500">
        {m.diameter ? `Ø${m.diameter}` : ""}
      </span>
    </>
  );

  if (mode === "klant") {
    return (
      <div className="flex items-center gap-3 border-b border-zinc-100 p-3 text-sm last:border-b-0">
        {row}
      </div>
    );
  }

  function handleCheck() {
    if (m.done) {
      // Heropenen vraagt eerst om bevestiging.
      setUndoOpen(true);
    } else {
      setStagedPhotos(0);
      setCompleteOpen(true);
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-zinc-100 p-3 text-sm last:border-b-0">
      <Checkbox checked={Boolean(m.done)} onCheckedChange={handleCheck} />
      {row}
      <Dialog
        onOpenChange={(next) => {
          setCompleteOpen(next);
          if (!next) setStagedPhotos(0);
        }}
        open={completeOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Taak afronden</DialogTitle>
            <DialogDescription>
              Maak een foto als bewijs van het uitgevoerde werk.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-900">{regelLabel(m)}</p>
            {stagedPhotos > 0 ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: stagedPhotos }).map((_, index) => (
                  <div
                    className="relative flex size-16 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-zinc-400"
                    key={index}
                  >
                    <ImageIcon className="size-5" />
                    <button
                      aria-label="Foto verwijderen"
                      className="absolute right-0.5 top-0.5 rounded bg-white/80 p-0.5 text-zinc-500 hover:text-red-600"
                      onClick={() => setStagedPhotos((n) => n - 1)}
                      type="button"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <Button
              className="w-full"
              onClick={() => setStagedPhotos((n) => n + 1)}
              type="button"
              variant="outline"
            >
              <Camera className="size-4" />
              {stagedPhotos > 0 ? "Nog een foto toevoegen" : "Foto toevoegen"}
            </Button>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setCompleteOpen(false)}
                type="button"
                variant="outline"
              >
                Annuleren
              </Button>
              <Button
                onClick={() => {
                  // Nu pas de gestagede foto's vastleggen, daarna afronden.
                  for (let i = 0; i < stagedPhotos; i += 1) {
                    addResult(projectId, werkbonId, taskId);
                  }
                  toggleDone(projectId, werkbonId, taskId, m.id);
                  setCompleteOpen(false);
                  setStagedPhotos(0);
                  toast.success("Taak afgerond");
                }}
              >
                Afronden
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={setUndoOpen} open={undoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Taak heropenen?</DialogTitle>
            <DialogDescription>
              Deze taak staat op klaar. Weet je zeker dat je hem weer op open
              zet?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setUndoOpen(false)}
              type="button"
              variant="outline"
            >
              Annuleren
            </Button>
            <Button
              onClick={() => {
                toggleDone(projectId, werkbonId, taskId, m.id);
                setUndoOpen(false);
                toast.success("Taak weer op open");
              }}
            >
              Heropenen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Sidebar ---------- */

function ChangelogCard({ projectId }: { projectId: string }) {
  const activity = useOperoStore((state) => state.activity);
  // Activiteit staat nieuwste eerst (wordt vooraan toegevoegd).
  const entries = activity.filter((a) => a.projectId === projectId);

  if (entries.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="font-semibold text-zinc-950">Changelog</p>
        <ol className="max-h-96 space-y-3 overflow-y-auto">
          {entries.map((entry) => (
            <li
              className="border-l-2 border-zinc-200 pl-3 text-sm"
              key={entry.id}
            >
              <p className="text-xs text-zinc-400">
                {formatDateTime(entry.createdAt)}
              </p>
              <p className="whitespace-pre-line text-zinc-700">{entry.body}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="font-semibold text-zinc-900">{title}</p>
      {children}
    </div>
  );
}

function projectProgress(project: Project) {
  // Eén "taak" = één zone/ruimte (WerkbonTaak). Een zone is afgerond als alle
  // ingevulde regels erin afgevinkt zijn (zie zoneStatus).
  const zones = (project.werkbonnen ?? []).flatMap((wb) => wb.tasks);
  return { total: zones.length, done: zones.filter(zoneStatus).length };
}

function ProjectInfoSidebar({
  project,
  customer,
}: {
  project: Project;
  customer: Customer;
}) {
  const teamMembers = useOperoStore((state) => state.teamMembers);
  const leader = teamMembers.find((m) => m.id === project.projectLeaderId);
  const installers = teamMembers.filter((m) =>
    project.installerIds.includes(m.id),
  );
  const { total, done } = projectProgress(project);

  return (
    <Card>
      <CardContent className="space-y-4 p-5 text-sm">
        <InfoBlock title="Voortgang">
          <p className="text-zinc-600">
            {done} van {total} taken afgerond
          </p>
        </InfoBlock>
        {project.description ? (
          <InfoBlock title="Omschrijving">
            <p className="whitespace-pre-line text-zinc-600">
              {project.description}
            </p>
          </InfoBlock>
        ) : null}
        <InfoBlock title="Datum">
          <p className="text-zinc-600">
            {project.plannedDate
              ? `${formatDate(project.plannedDate)} tot ${formatDate(
                  project.plannedEndDate ?? project.plannedDate,
                )}`
              : "Nog niet gepland"}
          </p>
        </InfoBlock>
        <InfoBlock title="Projectleider">
          <p className="text-zinc-600">{leader?.name ?? "Niet toegewezen"}</p>
        </InfoBlock>
        <InfoBlock title="Monteurs">
          {installers.length > 0 ? (
            installers.map((m) => (
              <p className="text-zinc-600" key={m.id}>
                {m.name}
              </p>
            ))
          ) : (
            <p className="text-zinc-500">Nog niemand toegewezen</p>
          )}
        </InfoBlock>
        <InfoBlock title="Adres">
          <p className="text-zinc-600">{project.address}</p>
          <p className="text-zinc-600">
            {project.postalCode} {project.city}
          </p>
        </InfoBlock>
        <InfoBlock title="Contact">
          <p className="whitespace-pre-line text-zinc-600">
            {project.contactName ||
              `${customer.contactName}\n${customer.phone || "Geen telefoon"}`}
          </p>
        </InfoBlock>
        <InfoBlock title="Werksoort">
          <p className="text-zinc-600">{project.insulationType}</p>
        </InfoBlock>
        <InfoBlock title="Uitvoeringsinstructies">
          {project.instructions ? (
            <p className="whitespace-pre-line text-zinc-600">
              {project.instructions}
            </p>
          ) : (
            <ul className="list-disc space-y-0.5 pl-4 text-zinc-600">
              <li>Controleer diameters</li>
              <li>Werk per zone af</li>
              <li>Maak fotos</li>
              <li>Meld meerwerk</li>
            </ul>
          )}
        </InfoBlock>
      </CardContent>
    </Card>
  );
}

function EditInfoSidebar({ project }: { project: Project }) {
  const updateProject = useOperoStore((state) => state.updateProject);
  const setProjectDurationDays = useOperoStore(
    (state) => state.setProjectDurationDays,
  );
  const setProjectTeam = useOperoStore((state) => state.setProjectTeam);
  const setProjectUrgency = useOperoStore((state) => state.setProjectUrgency);
  const teamMembers = useOperoStore((state) => state.teamMembers);
  const werksoorten = useOperoStore((state) => state.werksoorten);
  const leaders = teamMembers.filter(
    (m) => m.roles.includes("Projectleider") || m.roles.includes("Planner"),
  );
  const installers = teamMembers.filter((m) => m.roles.includes("Monteur"));
  const selected = installers.filter((m) => project.installerIds.includes(m.id));
  const available = installers.filter(
    (m) => !project.installerIds.includes(m.id),
  );
  const { total, done } = projectProgress(project);

  return (
    <Card>
      <CardContent className="space-y-4 p-5 text-sm">
        <InfoBlock title="Voortgang">
          <p className="text-zinc-600">
            {done} van {total} taken afgerond
          </p>
        </InfoBlock>

        <div className="space-y-1.5">
          <Label htmlFor="project-urgency">Urgentie</Label>
          <Select
            id="project-urgency"
            onChange={(event) =>
              setProjectUrgency(
                project.id,
                event.target.value as ProjectUrgency,
              )
            }
            value={project.urgency}
          >
            <option value="normal">Normaal</option>
            <option value="urgent">Urgent</option>
            <option value="blocked">Geblokkeerd</option>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="plan-start">Startdatum</Label>
            <Input
              className="block"
              id="plan-start"
              onChange={(event) =>
                updateProject(project.id, { plannedDate: event.target.value })
              }
              type="date"
              value={project.plannedDate ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-end">Einddatum</Label>
            <Input
              className="block"
              disabled={!project.plannedDate}
              id="plan-end"
              min={project.plannedDate}
              onChange={(event) =>
                updateProject(project.id, { plannedEndDate: event.target.value })
              }
              type="date"
              value={project.plannedEndDate ?? project.plannedDate ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-days">Aantal dagen</Label>
            <Input
              disabled={!project.plannedDate}
              id="plan-days"
              min={1}
              onChange={(event) =>
                setProjectDurationDays(project.id, Number(event.target.value) || 1)
              }
              type="number"
              value={planDurationDays(project)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Projectleider</Label>
          <Select
            onChange={(event) =>
              setProjectTeam(project.id, { projectLeaderId: event.target.value })
            }
            value={project.projectLeaderId}
          >
            <option value="">Niet toegewezen</option>
            {leaders.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Monteurs</Label>
          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((m) => (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700"
                  key={m.id}
                >
                  {m.name}
                  <button
                    aria-label={`${m.name} verwijderen`}
                    className="text-zinc-400 hover:text-red-600"
                    onClick={() =>
                      setProjectTeam(project.id, {
                        installerIds: project.installerIds.filter(
                          (id) => id !== m.id,
                        ),
                      })
                    }
                    type="button"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <Select
            className="border-dashed text-zinc-600"
            onChange={(event) => {
              if (event.target.value) {
                setProjectTeam(project.id, {
                  installerIds: [...project.installerIds, event.target.value],
                });
                event.target.value = "";
              }
            }}
            value=""
          >
            <option value="">+ Monteur toevoegen</option>
            {available.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label htmlFor="project-name">Projectnaam</Label>
          <Input
            defaultValue={project.name ?? ""}
            id="project-name"
            key={`name-${project.name ?? ""}`}
            onBlur={(event) =>
              updateProject(project.id, { name: event.target.value })
            }
            placeholder="Geef het project een naam"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-omschrijving">Omschrijving</Label>
          <Textarea
            defaultValue={project.description ?? ""}
            id="project-omschrijving"
            key={`desc-${project.description ?? ""}`}
            onBlur={(event) =>
              updateProject(project.id, { description: event.target.value })
            }
            placeholder="Korte omschrijving van het project"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-contact">Contact</Label>
          <Textarea
            defaultValue={project.contactName ?? ""}
            id="project-contact"
            key={`cn-${project.contactName ?? ""}`}
            onBlur={(event) =>
              updateProject(project.id, { contactName: event.target.value })
            }
            placeholder="Naam en telefoonnummer contactpersoon"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Adres</Label>
          <Input
            defaultValue={project.address}
            key={`ad-${project.address}`}
            onBlur={(event) =>
              updateProject(project.id, { address: event.target.value })
            }
            placeholder="Straat en nummer"
          />
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <Input
              defaultValue={project.postalCode}
              key={`pc-${project.postalCode}`}
              onBlur={(event) =>
                updateProject(project.id, { postalCode: event.target.value })
              }
              placeholder="Postcode"
            />
            <Input
              defaultValue={project.city}
              key={`ci-${project.city}`}
              onBlur={(event) =>
                updateProject(project.id, { city: event.target.value })
              }
              placeholder="Plaats"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Werksoort</Label>
          <Select
            onChange={(event) =>
              updateProject(project.id, { insulationType: event.target.value })
            }
            value={project.insulationType}
          >
            <option value="Nog te bepalen">Nog te bepalen</option>
            {werksoorten.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-instructions">Uitvoeringsinstructies</Label>
          <Textarea
            defaultValue={project.instructions ?? ""}
            id="project-instructions"
            key={`instr-${project.instructions ?? ""}`}
            onBlur={(event) =>
              updateProject(project.id, { instructions: event.target.value })
            }
            placeholder={"Controleer diameters\nWerk per zone af\nMaak fotos\nMeld meerwerk"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Dialogs ---------- */

function MeerwerkSection({
  project,
  mode,
}: {
  project: Project;
  mode: ViewMode;
}) {
  const approveOffice = useOperoStore((state) => state.approveMeerwerkOffice);
  const approveClient = useOperoStore((state) => state.approveMeerwerkClient);
  const rejectMeerwerk = useOperoStore((state) => state.rejectMeerwerk);
  const toggleDone = useOperoStore((state) => state.toggleMeerwerkDone);
  // Door kantoor afgewezen meerwerk verdwijnt; door de klant afgewezen
  // meerwerk blijft zichtbaar (met badge).
  const items = (project.meerwerk ?? []).filter(
    (item) => item.rejectedBy !== "office",
  );
  const isKlant = mode === "klant";

  if (items.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div>
          <p className="font-semibold text-zinc-950">Meerwerk</p>
          <p className="text-sm text-zinc-500">
            Gemeld op locatie. Kantoor en opdrachtgever keuren het goed voordat
            het op de factuur komt.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200">
          {items.map((item) => {
            const badge = (
              <Badge
                variant={
                  item.rejected
                    ? "red"
                    : meerwerkApproved(item)
                      ? "emerald"
                      : "amber"
                }
              >
                {item.rejected
                  ? "Afgewezen"
                  : meerwerkApproved(item)
                    ? "Volledig akkoord"
                    : "Ter goedkeuring"}
              </Badge>
            );
            const label =
              item.label?.trim() ||
              (item.diameter ? `Leidingen Ø${item.diameter} isoleren` : "") ||
              item.name ||
              item.description;
            const rowInner = (
              <>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    item.done ? "text-zinc-400 line-through" : "text-zinc-800",
                  )}
                >
                  {label}
                </span>
                <span className="flex w-32 shrink-0 justify-start">{badge}</span>
                <span className="w-16 shrink-0 text-zinc-600">
                  {item.name ? `${item.quantity} ${item.unit}` : ""}
                </span>
                <span className="hidden w-44 shrink-0 truncate text-zinc-600 sm:inline">
                  {item.name}
                </span>
                <span className="w-12 shrink-0 text-right text-zinc-500">
                  {item.diameter ? `Ø${item.diameter}` : ""}
                </span>
                {/* Prijzen alleen voor management, niet voor monteurs. */}
                {mode === "edit" ? (
                  <span className="w-16 shrink-0 text-right font-medium text-zinc-700">
                    {formatCurrency(item.amount)}
                  </span>
                ) : null}
              </>
            );

            return (
              <div className="border-b border-zinc-100 last:border-b-0" key={item.id}>
                {isKlant ? (
                  <div className="flex items-center gap-3 p-3 text-sm">
                    {rowInner}
                  </div>
                ) : (
                  <label className="flex items-center gap-3 p-3 text-sm">
                    <Checkbox
                      checked={Boolean(item.done)}
                      disabled={item.rejected}
                      onCheckedChange={() => toggleDone(project.id, item.id)}
                    />
                    {rowInner}
                  </label>
                )}
                {mode === "edit" && !item.rejected ? (
                  <div className="flex flex-wrap items-center gap-4 px-3 pb-3 pl-10">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={item.approvedByOffice}
                        onCheckedChange={() => approveOffice(project.id, item.id)}
                      />
                      Kantoor akkoord
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={item.approvedByClient}
                        onCheckedChange={() => approveClient(project.id, item.id)}
                      />
                      Opdrachtgever akkoord
                    </label>
                    <Button
                      onClick={() => rejectMeerwerk(project.id, item.id)}
                      size="sm"
                      variant="ghost"
                    >
                      Afwijzen
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TaakAddDialog({
  projectId,
  werkbonId,
  taskId,
  trigger,
}: {
  projectId: string;
  werkbonId: string;
  taskId: string;
  trigger: ReactNode;
}) {
  const addTaakRegel = useOperoStore((state) => state.addTaakRegel);
  const articles = useOperoStore((state) => state.articles);
  const options = articles.filter(
    (a) => a.category === "isolatie" || a.category === "materiaal",
  );
  const [open, setOpen] = useState(false);
  const [articleId, setArticleId] = useState("");
  const [qty, setQty] = useState("1");
  const [dia, setDia] = useState("");
  const article = options.find((a) => a.id === articleId);

  function reset() {
    setArticleId("");
    setQty("1");
    setDia("");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!article) return;
    addTaakRegel(projectId, werkbonId, taskId, {
      name: article.name,
      unit: article.unit,
      unitPrice: article.unitPrice,
      quantity: Number(qty) || 0,
      diameter: Number(dia) || undefined,
    });
    reset();
    setOpen(false);
    toast.success("Taak toegevoegd");
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      open={open}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Taak toevoegen</DialogTitle>
          <DialogDescription>
            Kies een standaard artikel uit de lijst.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="tk-article">Type isolatie / artikel</Label>
            <Select
              id="tk-article"
              onChange={(event) => setArticleId(event.target.value)}
              value={articleId}
            >
              <option value="">Kies artikel...</option>
              {options.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.unit})
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tk-qty">Aantal</Label>
              <Input
                id="tk-qty"
                min={0}
                onChange={(event) => setQty(event.target.value)}
                type="number"
                value={qty}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tk-dia">Ø (mm)</Label>
              <Input
                id="tk-dia"
                min={0}
                onChange={(event) => setDia(event.target.value)}
                placeholder="optioneel"
                type="number"
                value={dia}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Annuleren
            </Button>
            <Button disabled={!article} type="submit">
              Taak toevoegen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MeerwerkAddDialog({
  projectId,
  trigger,
}: {
  projectId: string;
  trigger: ReactNode;
}) {
  const addMeerwerk = useOperoStore((state) => state.addMeerwerk);
  const articles = useOperoStore((state) => state.articles);
  const options = articles.filter(
    (a) => a.category === "isolatie" || a.category === "materiaal",
  );
  const [open, setOpen] = useState(false);
  const [articleId, setArticleId] = useState("");
  const [qty, setQty] = useState("1");
  const [dia, setDia] = useState("");
  const article = options.find((a) => a.id === articleId);

  function reset() {
    setArticleId("");
    setQty("1");
    setDia("");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!article) return;
    addMeerwerk(projectId, {
      name: article.name,
      unit: article.unit,
      unitPrice: article.unitPrice,
      quantity: Number(qty) || 0,
      diameter: Number(dia) || undefined,
    });
    reset();
    setOpen(false);
    toast.success("Meerwerk gemeld");
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      open={open}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Meerwerk toevoegen</DialogTitle>
          <DialogDescription>
            Kies een standaard artikel uit de lijst.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="mw-article">Type isolatie / artikel</Label>
            <Select
              id="mw-article"
              onChange={(event) => setArticleId(event.target.value)}
              value={articleId}
            >
              <option value="">Kies artikel...</option>
              {options.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.unit})
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mw-qty">Aantal</Label>
              <Input
                id="mw-qty"
                min={0}
                onChange={(event) => setQty(event.target.value)}
                type="number"
                value={qty}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mw-dia">Ø (mm)</Label>
              <Input
                id="mw-dia"
                min={0}
                onChange={(event) => setDia(event.target.value)}
                placeholder="optioneel"
                type="number"
                value={dia}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Annuleren
            </Button>
            <Button disabled={!article} type="submit">
              Meerwerk melden
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OpmerkingDialog({
  projectId,
  trigger,
}: {
  projectId: string;
  trigger: ReactNode;
}) {
  const addProjectComment = useOperoStore((state) => state.addProjectComment);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  function submit() {
    if (!text.trim()) return;
    addProjectComment(projectId, text);
    setText("");
    setOpen(false);
    toast.success("Opmerking verstuurd");
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Opmerking of vraag</DialogTitle>
          <DialogDescription>
            We reageren binnen 1 werkdag.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            onChange={(event) => setText(event.target.value)}
            placeholder="Stel je vraag of geef iets door..."
            rows={4}
            value={text}
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)} variant="outline">
              Annuleren
            </Button>
            <Button disabled={!text.trim()} onClick={submit}>
              Versturen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const inked = useRef(false);

  // Canvas op de gerenderde breedte zetten zodat de lijn scherp blijft en de
  // coördinaten kloppen.
  const setupCanvas = (canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  };

  const point = (event: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#18181b";
    const { x, y } = point(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
  };

  const move = (event: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = point(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    inked.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (inked.current) onChange(canvasRef.current!.toDataURL());
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    inked.current = false;
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-zinc-400">
          Handtekening
        </span>
        <Button onClick={clear} size="sm" type="button" variant="ghost">
          Wissen
        </Button>
      </div>
      <canvas
        aria-label="Onderteken hier"
        className="h-40 w-full touch-none rounded-md border border-zinc-200 bg-white"
        onPointerDown={start}
        onPointerLeave={end}
        onPointerMove={move}
        onPointerUp={end}
        ref={setupCanvas}
      />
      <p className="text-xs text-zinc-500">
        Teken hierboven je handtekening om de werkbon af te ronden.
      </p>
    </div>
  );
}

function ProjectInfoContent({
  project,
  customer,
  mode,
}: {
  project: Project;
  customer: Customer;
  mode: ViewMode;
}) {
  return (
    <div className="space-y-5">
      {mode === "edit" ? (
        <EditInfoSidebar project={project} />
      ) : (
        <ProjectInfoSidebar customer={customer} project={project} />
      )}
      <ChangelogCard projectId={project.id} />
    </div>
  );
}

function InfoSheet({
  project,
  customer,
  mode,
}: {
  project: Project;
  customer: Customer;
  mode: ViewMode;
}) {
  const [open, setOpen] = useState(false);

  // Springt het scherm naar desktop, dan staat de vaste zijbalk er weer: de
  // sheet hoort dan dicht zodat hij niet over de layout blijft hangen.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button
          aria-label="Projectinfo"
          className="lg:hidden"
          size="icon"
          variant="outline"
        >
          <Info className="size-4" />
        </Button>
      </SheetTrigger>
      {/* p-0 + losse scroll-laag: de scrollbar zit zo tegen de rand i.p.v. een
          eind naar binnen door de padding. */}
      <SheetContent className="flex flex-col p-0" side="right">
        <SheetHeader className="px-6 pb-4 pt-6">
          <SheetTitle>Projectinfo</SheetTitle>
          <SheetDescription className="sr-only">
            Algemene projectinformatie en changelog
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pb-6">
            <ProjectInfoContent
              customer={customer}
              mode={mode}
              project={project}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function WerkbonAfrondenButton({ project }: { project: Project }) {
  const afrondenWerkbon = useOperoStore((state) => state.afrondenWerkbon);
  const [open, setOpen] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const openCount = (project.werkbonnen ?? [])
    .flatMap((wb) => wb.tasks)
    .flatMap((task) => task.materials)
    .filter((m) => m.name.trim() && !m.done).length;

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSignature(null);
      }}
      open={open}
    >
      <Button onClick={() => setOpen(true)}>Werkbon afronden</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Werkbon afronden</DialogTitle>
          <DialogDescription>
            {openCount > 0
              ? `Er ${openCount === 1 ? "is" : "zijn"} nog ${openCount} ${
                  openCount === 1 ? "taak" : "taken"
                } niet afgevinkt. Bij afronden worden deze afgevinkt.`
              : "Onderteken om de werkbon definitief af te ronden."}
          </DialogDescription>
        </DialogHeader>
        <SignaturePad onChange={setSignature} />
        <div className="flex justify-end gap-2">
          <Button onClick={() => setOpen(false)} variant="outline">
            Annuleren
          </Button>
          <Button
            disabled={!signature}
            onClick={() => {
              if (!signature) return;
              afrondenWerkbon(project.id, signature);
              setOpen(false);
              setSignature(null);
              toast.success("Werkbon afgerond");
            }}
          >
            <Check className="size-4" />
            Afronden en ondertekenen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProjectButton({
  projectId,
  projectLabel,
}: {
  projectId: string;
  projectLabel: string;
}) {
  const router = useRouter();
  const deleteProject = useOperoStore((state) => state.deleteProject);
  const [open, setOpen] = useState(false);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button aria-label="Verwijder project" size="icon" variant="outline">
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project verwijderen?</DialogTitle>
          <DialogDescription>
            Je verwijdert{" "}
            <span className="font-medium text-zinc-950">{projectLabel}</span>{" "}
            definitief. Dit kan niet ongedaan worden gemaakt.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setOpen(false)} variant="outline">
            Annuleren
          </Button>
          <Button
            onClick={() => {
              deleteProject(projectId);
              setOpen(false);
              toast.success("Project verwijderd");
              router.push("/projects");
            }}
            variant="destructive"
          >
            <Trash2 className="size-4" />
            Verwijderen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
