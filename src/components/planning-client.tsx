"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ProjectStatusBadge } from "@/components/status-badge";
import { useOperoStore } from "@/lib/store";
import {
  addDays,
  formatDayMonth,
  formatWeekday,
  getWeekDays,
  isoWeekNumber,
  startOfIsoWeek,
  toYmd,
} from "@/lib/planning";
import { type Project, type TeamMember } from "@/lib/types";
import { cn } from "@/lib/utils";

function useMounted() {
  return useSyncExternalStore(
    (onChange) => {
      const id = window.setTimeout(onChange, 0);
      return () => window.clearTimeout(id);
    },
    () => true,
    () => false,
  );
}

const schedulableStatuses = new Set<string>(["operatie", "verkoop"]);

// Wie kun je op een project zetten: het veldteam (monteurs en voormannen).
function fieldStaff(members: TeamMember[]) {
  return members.filter(
    (member) =>
      member.roles.includes("Monteur") || member.roles.includes("Voorman"),
  );
}

function projectEnd(project: Project) {
  return project.plannedEndDate ?? project.plannedDate ?? "";
}

// Loopt het project op deze dag (binnen start..eind)?
function spanCovers(project: Project, ymd: string) {
  if (!project.plannedDate) return false;
  return project.plannedDate <= ymd && ymd <= projectEnd(project);
}

export function PlanningClient() {
  const mounted = useMounted();

  // DnD genereert ids die per render verschillen; render daarom pas na mount
  // de interactieve versie, met een statische skeleton ervoor (geen hydration
  // mismatch).
  if (!mounted) return <PlanningSkeleton />;

  return <InteractivePlanning />;
}

function PlanningSkeleton() {
  const weekStart = startOfIsoWeek(new Date());
  const days = getWeekDays(weekStart);
  const lastDay = days[days.length - 1];

  return (
    <div className="space-y-5">
      <Card>
        <div className="p-5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Week {isoWeekNumber(weekStart)}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {formatDayMonth(weekStart)} t/m {formatDayMonth(lastDay)}
          </p>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[900px] gap-3"
            style={{
              gridTemplateColumns: `repeat(${days.length}, minmax(9rem, 1fr))`,
            }}
          >
            {days.map((day) => (
              <div
                className="rounded-lg border border-zinc-200 bg-white"
                key={toYmd(day)}
              >
                <div className="border-b border-zinc-200 p-2.5">
                  <p className="text-sm font-semibold text-zinc-700">
                    {formatWeekday(day)}
                  </p>
                  <p className="text-xs text-zinc-500">{formatDayMonth(day)}</p>
                </div>
                <div className="min-h-32 p-2" />
              </div>
            ))}
          </div>
        </div>
        <Card className="h-fit">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-zinc-500" />
              In te plannen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400">Laden...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InteractivePlanning() {
  const projects = useOperoStore((state) => state.projects);
  const teamMembers = useOperoStore((state) => state.teamMembers);
  const activeProfileId = useOperoStore((state) => state.activeProfileId);
  const profiles = useOperoStore((state) => state.profiles);
  const scheduleProjectOnDay = useOperoStore(
    (state) => state.scheduleProjectOnDay,
  );
  const updateProject = useOperoStore((state) => state.updateProject);
  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const canEdit =
    activeProfile.role === "super_admin" ||
    activeProfile.role === "projectmanager";

  const [weekStart, setWeekStart] = useState(() => startOfIsoWeek(new Date()));
  const people = useMemo(() => fieldStaff(teamMembers), [teamMembers]);

  function handleSchedule(projectId: string, date: string) {
    scheduleProjectOnDay(projectId, date);
    const project = projects.find((p) => p.id === projectId);
    toast.success(
      `${project?.customerName ?? "Project"} ingepland op ${formatDayMonth(new Date(`${date}T12:00:00`))}`,
    );
  }

  // Rekken zoals Google Calendar: einddag verzetten door het handvat te slepen.
  function handleResize(projectId: string, date: string) {
    updateProject(projectId, { plannedEndDate: date });
  }

  return (
    <PlanningShell
      onResize={canEdit ? handleResize : () => {}}
      onSchedule={canEdit ? handleSchedule : () => {}}
      onWeekChange={setWeekStart}
      people={people}
      projects={projects}
      readOnly={!canEdit}
      weekStart={weekStart}
    />
  );
}

function PlanningShell({
  onResize,
  onSchedule,
  onWeekChange,
  people,
  projects,
  readOnly,
  weekStart,
}: {
  onResize: (projectId: string, date: string) => void;
  onSchedule: (projectId: string, date: string) => void;
  onWeekChange: (start: Date) => void;
  people: TeamMember[];
  projects: Project[];
  readOnly: boolean;
  weekStart: Date;
}) {
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekNumber = isoWeekNumber(weekStart);
  const lastDay = days[days.length - 1];

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const projectsThisWeek = useMemo(() => {
    const ymdSet = new Set(days.map(toYmd));
    return projects.filter(
      (project) => project.plannedDate && ymdSet.has(project.plannedDate),
    );
  }, [projects, days]);

  const unscheduled = useMemo(
    () =>
      projects.filter(
        (project) =>
          schedulableStatuses.has(project.status) && !project.plannedDate,
      ),
    [projects],
  );

  const isResizing = draggingId?.startsWith("resize:") ?? false;
  const draggingProject = isResizing
    ? undefined
    : projects.find((project) => project.id === draggingId);

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const overId = event.over?.id;
    if (!overId) return;
    const activeId = String(event.active.id);
    if (activeId.startsWith("resize:")) {
      onResize(activeId.slice("resize:".length), String(overId));
    } else {
      onSchedule(activeId, String(overId));
    }
  }

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragCancel={() => setDraggingId(null)}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <div className="space-y-5">
        <Card>
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Week {weekNumber}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {formatDayMonth(weekStart)} t/m {formatDayMonth(lastDay)} ·{" "}
              {projectsThisWeek.length} projecten ingepland
            </p>
          </div>
          <div className="flex items-center rounded-md border border-zinc-200">
            <Button
              aria-label="Vorige week"
              onClick={() => onWeekChange(addDays(weekStart, -7))}
              size="icon"
              variant="ghost"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              onClick={() => onWeekChange(startOfIsoWeek(new Date()))}
              size="sm"
              variant="ghost"
            >
              Vandaag
            </Button>
            <Button
              aria-label="Volgende week"
              onClick={() => onWeekChange(addDays(weekStart, 7))}
              size="icon"
              variant="ghost"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        </Card>

        {!readOnly && people.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Nog geen monteurs om in te plannen. Voeg ze toe onder{" "}
            <Link className="font-medium underline" href="/personeel">
              Personeel
            </Link>{" "}
            en geef ze de rol Monteur.
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[900px] gap-3"
              style={{
                gridTemplateColumns: `repeat(${days.length}, minmax(9rem, 1fr))`,
              }}
            >
              {days.map((day) => (
                <DayColumn
                  day={day}
                  key={toYmd(day)}
                  people={people}
                  projects={projects}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </div>

          <Card className="h-fit">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-4 text-zinc-500" />
                In te plannen
              </CardTitle>
              <Badge variant="outline">{unscheduled.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {unscheduled.map((project) => (
                <DraggableUnscheduled
                  key={project.id}
                  project={project}
                  readOnly={readOnly}
                />
              ))}
              {unscheduled.length === 0 ? (
                <EmptyState label="Geen projecten wachten op planning" />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <DragOverlay>
        {draggingProject ? (
          <div className="w-56 rotate-1">
            <UnscheduledChip project={draggingProject} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DayColumn({
  day,
  people,
  projects,
  readOnly,
}: {
  day: Date;
  people: TeamMember[];
  projects: Project[];
  readOnly: boolean;
}) {
  const ymd = toYmd(day);
  const { isOver, setNodeRef } = useDroppable({ id: ymd, disabled: readOnly });
  const dayProjects = projects.filter((project) => spanCovers(project, ymd));

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-zinc-200 bg-white transition",
        isOver && !readOnly && "border-emerald-300 bg-emerald-50/60",
      )}
      ref={setNodeRef}
    >
      <div className="border-b border-zinc-200 p-2.5">
        <p className="text-sm font-semibold text-zinc-700">
          {formatWeekday(day)}
        </p>
        <p className="text-xs text-zinc-500">{formatDayMonth(day)}</p>
      </div>
      <div className="min-h-32 flex-1 space-y-2 p-2">
        {dayProjects.map((project) =>
          project.plannedDate === ymd ? (
            <ScheduledCard
              key={project.id}
              people={people}
              project={project}
              readOnly={readOnly}
            />
          ) : (
            <ContinuationCard key={project.id} project={project} />
          ),
        )}
        {dayProjects.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-400">
            {readOnly ? "Niets gepland" : "Sleep een project hierheen"}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ContinuationCard({ project }: { project: Project }) {
  return (
    <Link
      className="block rounded-md border border-dashed border-emerald-200 bg-emerald-50/40 p-2 text-emerald-700/80 transition hover:bg-emerald-50"
      href={`/project?id=${project.id}`}
    >
      <p className="truncate text-xs font-medium">{project.customerName}</p>
      <p className="text-[11px]">loopt door</p>
    </Link>
  );
}

function ScheduledCard({
  people,
  project,
  readOnly,
}: {
  people: TeamMember[];
  project: Project;
  readOnly: boolean;
}) {
  const router = useRouter();
  const unscheduleProject = useOperoStore((state) => state.unscheduleProject);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: project.id, disabled: readOnly });
  const {
    attributes: resizeAttributes,
    listeners: resizeListeners,
    setNodeRef: resizeSetNodeRef,
  } = useDraggable({ id: `resize:${project.id}`, disabled: readOnly });

  // Onthoud kort dat er gesleept is, zodat de klik daarna niet ook navigeert.
  const draggedRef = useRef(false);
  useEffect(() => {
    if (isDragging) {
      draggedRef.current = true;
      return;
    }
    if (draggedRef.current) {
      const timeout = window.setTimeout(() => {
        draggedRef.current = false;
      }, 60);
      return () => window.clearTimeout(timeout);
    }
  }, [isDragging]);

  const assigned = people.filter((person) =>
    project.installerIds.includes(person.id),
  );
  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
  };

  function openProject() {
    if (draggedRef.current) return;
    router.push(`/project?id=${project.id}`);
  }

  return (
    <div
      className={cn(
        "relative rounded-md border border-emerald-200 bg-emerald-50/70",
        isDragging && "opacity-30",
        !readOnly && "cursor-grab touch-none active:cursor-grabbing",
      )}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      {!readOnly ? (
        <button
          aria-label="Uit planning halen"
          className="absolute right-1 top-1 z-10 rounded p-0.5 text-emerald-700/70 hover:bg-emerald-100 hover:text-emerald-900"
          onClick={(event) => {
            event.stopPropagation();
            unscheduleProject(project.id);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          type="button"
        >
          <X className="size-3.5" />
        </button>
      ) : null}

      <div className="space-y-2 p-2" onClick={openProject}>
        <div className="pr-5">
          <p className="truncate text-xs font-medium text-emerald-900">
            {project.customerName}
          </p>
          <p className="truncate text-xs text-emerald-700">
            {project.insulationType}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {assigned.map((person) => (
            <span
              className="rounded-full bg-white px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200"
              key={person.id}
            >
              {person.name.split(" ")[0]}
            </span>
          ))}
          {assigned.length === 0 ? (
            <span className="text-[11px] text-emerald-700/70">
              Nog niemand toegewezen
            </span>
          ) : null}
        </div>
      </div>

      {!readOnly ? (
        <div
          aria-label="Sleep over de dagen om de looptijd aan te passen"
          className="absolute inset-y-0 right-0 z-0 flex w-2.5 cursor-ew-resize items-center justify-center rounded-r-md hover:bg-emerald-300/50"
          ref={resizeSetNodeRef}
          title="Sleep over de dagen om de looptijd aan te passen"
          {...resizeAttributes}
          {...resizeListeners}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.stopPropagation();
            resizeListeners?.onPointerDown?.(event);
          }}
        >
          <span className="h-5 w-0.5 rounded-full bg-emerald-400/70" />
        </div>
      ) : null}
    </div>
  );
}

function DraggableUnscheduled({
  project,
  readOnly,
}: {
  project: Project;
  readOnly: boolean;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useDraggable({
      id: project.id,
      disabled: readOnly,
    });
  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
  };
  return (
    <div
      className={cn(
        "touch-none",
        !readOnly && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <UnscheduledChip project={project} />
    </div>
  );
}

function UnscheduledChip({ project }: { project: Project }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-zinc-950">
          {project.customerName}
        </p>
        <ProjectStatusBadge status={project.status} />
      </div>
      <p className="mt-1 truncate text-xs text-zinc-500">
        {project.insulationType} · {project.squareMeters} m2
      </p>
    </div>
  );
}
