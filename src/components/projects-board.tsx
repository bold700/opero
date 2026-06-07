"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Check, LayoutGrid, Search, Table as TableIcon } from "lucide-react";
import { toast } from "sonner";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { PortaalClient } from "@/components/portaal-client";
import { ProjectCard } from "@/components/project-card";
import { ProjectsFilters } from "@/components/projects-filters";
import { ProjectsTable } from "@/components/projects-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import {
  applyProjectFilters,
  emptyFilters,
  type ProjectFilters,
} from "@/lib/project-filters";
import {
  canCreateProject,
  canMoveProjectsInBoard,
  canSeePrices,
  getVisibleProjectsForProfile,
} from "@/lib/roles";
import { type Project, type Stage, type TeamMember } from "@/lib/types";
import { useOperoStore } from "@/lib/store";
import { STAGE_LABELS, STAGE_ORDER, getStage } from "@/lib/stages";
import { cn } from "@/lib/utils";

function subscribeMount(onChange: () => void) {
  const id = window.setTimeout(onChange, 0);
  return () => window.clearTimeout(id);
}

export function ProjectsBoard() {
  const mounted = useSyncExternalStore(
    subscribeMount,
    () => true,
    () => false,
  );

  const projects = useOperoStore((state) => state.projects);
  const teamMembers = useOperoStore((state) => state.teamMembers);
  const profiles = useOperoStore((state) => state.profiles);
  const activeProfileId = useOperoStore((state) => state.activeProfileId);
  const viewByProfile = useOperoStore((state) => state.projectsViewByProfile);
  const setProjectsView = useOperoStore((state) => state.setProjectsView);
  const setStage = useOperoStore((state) => state.setStage);
  const completeAllTaken = useOperoStore((state) => state.completeAllTaken);
  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];

  const [filters, setFilters] = useState<ProjectFilters>(emptyFilters);
  // Sleep-naar-Ready vraagt eerst bevestiging: alle taken worden afgevinkt.
  const [readyTarget, setReadyTarget] = useState<Project | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-48 rounded-md bg-zinc-100" />
        <div className="h-64 rounded-xl bg-zinc-50" />
      </div>
    );
  }

  // De opdrachtgever krijgt hier zijn klantportaal-view in plaats van het bord.
  if (activeProfile.role === "opdrachtgever") {
    return <PortaalClient />;
  }

  const allVisible = getVisibleProjectsForProfile(activeProfile, projects);
  const visibleProjects = applyProjectFilters(
    allVisible,
    filters,
    activeProfile.teamMemberId,
  );
  const teamLeaders = teamMembers.filter((member) =>
    member.roles.includes("Voorman"),
  );
  const view = viewByProfile[activeProfile.id] ?? "table";
  const canMove = canMoveProjectsInBoard(activeProfile.role);
  const showPrices = canSeePrices(activeProfile.role);
  const byStage = (stage: string) =>
    visibleProjects.filter((project) => getStage(project) === stage);

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    if (!overId) return;
    const projectId = String(event.active.id);
    const target = String(overId) as Stage;
    const current = visibleProjects.find((p) => p.id === projectId);
    if (!current || getStage(current) === target) return;
    // Ready is afgeleid van "alle taken af". Slepen naar Ready vinkt dus alle
    // taken af, daarom eerst bevestigen.
    if (target === "ready") {
      setReadyTarget(current);
      return;
    }
    setStage(projectId, target);
    toast.success(`${current.customerName} naar ${STAGE_LABELS[target]}`);
  }

  function confirmReady() {
    if (!readyTarget) return;
    // Een afgerond project blokkeert de afgeleide "ready"; zet het terug naar
    // in uitvoering zodat het afvinken weer Ready oplevert.
    if (getStage(readyTarget) === "done") {
      setStage(readyTarget.id, "in_progress");
    }
    completeAllTaken(readyTarget.id);
    toast.success(`${readyTarget.customerName} naar Ready, taken afgevinkt`);
    setReadyTarget(null);
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projecten</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {visibleProjects.length} projecten in de pijplijn
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  className="h-9 pl-9"
                  onChange={(event) =>
                    setFilters({ ...filters, search: event.target.value })
                  }
                  placeholder="Zoek klant, projectnr of plaats"
                  value={filters.search}
                />
              </div>
              <ProjectsFilters
                filters={filters}
                matchCount={visibleProjects.length}
                onChange={setFilters}
                teamLeaders={teamLeaders}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-zinc-200 p-0.5">
                <Button
                  className={view === "table" ? "bg-zinc-100" : ""}
                  onClick={() => setProjectsView(activeProfile.id, "table")}
                  size="sm"
                  variant="ghost"
                >
                  <TableIcon className="size-4" />
                  Tabel
                </Button>
                <Button
                  className={view === "board" ? "bg-zinc-100" : ""}
                  onClick={() => setProjectsView(activeProfile.id, "board")}
                  size="sm"
                  variant="ghost"
                >
                  <LayoutGrid className="size-4" />
                  Bord
                </Button>
              </div>
              {canCreateProject(activeProfile.role) ? <NewProjectDialog /> : null}
            </div>
          </div>
        </div>
      </Card>

      {view === "table" ? (
        <ProjectsTable
          projects={visibleProjects}
          showPrices={showPrices}
          teamMembers={teamMembers}
        />
      ) : (
        <DndContext
          collisionDetection={pointerWithin}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {STAGE_ORDER.map((stage) => (
              <StageColumn
                canMove={canMove}
                key={stage}
                label={STAGE_LABELS[stage]}
                projects={byStage(stage)}
                showPrices={showPrices}
                stage={stage}
                teamMembers={teamMembers}
              />
            ))}
          </div>
        </DndContext>
      )}

      <Dialog
        onOpenChange={(next) => {
          if (!next) setReadyTarget(null);
        }}
        open={Boolean(readyTarget)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project naar Ready</DialogTitle>
            <DialogDescription>
              Je verplaatst{" "}
              <span className="font-medium text-zinc-950">
                {readyTarget?.customerName}
              </span>{" "}
              naar Ready. Alle taken van dit project worden dan afgevinkt. Wil je
              doorgaan?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setReadyTarget(null)} variant="outline">
              Annuleren
            </Button>
            <Button onClick={confirmReady}>
              <Check className="size-4" />
              Afvinken en verplaatsen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StageColumn({
  label,
  projects,
  teamMembers,
  stage,
  canMove,
  showPrices,
}: {
  label: string;
  projects: Project[];
  teamMembers: TeamMember[];
  stage: Stage;
  canMove: boolean;
  showPrices: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage, disabled: !canMove });
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 transition",
        isOver && canMove && "border-emerald-300 bg-emerald-50/70",
      )}
      ref={setNodeRef}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">{label}</h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-zinc-500">
          {projects.length}
        </span>
      </div>
      <div className="space-y-3">
        {projects.length === 0 ? (
          <EmptyState label="Geen projecten" />
        ) : (
          projects.map((project) => (
            <DraggableProjectCard
              canMove={canMove}
              key={project.id}
              project={project}
              showPrices={showPrices}
              teamLeader={teamMembers.find(
                (member) => member.id === project.teamLeaderId,
              )}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableProjectCard({
  project,
  teamLeader,
  canMove,
  showPrices,
}: {
  project: Project;
  teamLeader?: TeamMember;
  canMove: boolean;
  showPrices: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: project.id, disabled: !canMove });

  // Voorkom dat de klik na een sleepactie ook het project opent.
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

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
  };

  return (
    <div
      className={cn(
        canMove && "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
      onClickCapture={(event) => {
        if (draggedRef.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <ProjectCard
        project={project}
        showPrices={showPrices}
        teamLeader={teamLeader}
      />
    </div>
  );
}
