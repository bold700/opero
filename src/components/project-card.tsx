import Link from "next/link";
import { AlertTriangle, CalendarDays, MapPin, UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UrgencyBadge } from "@/components/status-badge";
import { STAGE_LABELS, getStage, isPaid } from "@/lib/stages";
import { formatCurrency, formatDate } from "@/lib/utils";
import { type Project, type TeamMember } from "@/lib/types";

export function ProjectCard({
  project,
  teamLeader,
  showPrices = true,
}: {
  project: Project;
  teamLeader?: TeamMember;
  showPrices?: boolean;
}) {
  return (
    <Link href={`/projects/${project.id}`} className="block">
      <Card className="transition hover:border-zinc-300 hover:shadow-md">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-950">
                {project.name || project.customerName}
              </p>
              <p className="mt-1 truncate text-xs text-zinc-500">
                {project.name ? `${project.customerName} · ` : ""}
                {project.projectNumber}
              </p>
            </div>
            <UrgencyBadge urgency={project.urgency} />
          </div>

          <div className="space-y-2 text-sm text-zinc-600">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-zinc-400" />
              <span className="truncate">
                {project.address}, {project.city}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-zinc-400" />
              <span>{formatDate(project.plannedDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-zinc-400" />
              <span>{teamLeader?.name ?? "Nog niet toegewezen"}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={isPaid(project) ? "emerald" : "zinc"}>
              {isPaid(project) ? "Betaald" : STAGE_LABELS[getStage(project)]}
            </Badge>
          </div>

          {showPrices ? (
            <div className="flex items-center justify-end border-t border-zinc-100 pt-3 text-sm">
              <span className="font-semibold text-zinc-950">
                {formatCurrency(project.value)}
              </span>
            </div>
          ) : null}

          {project.blocker ? (
            <div className="flex gap-2 rounded-md bg-red-50 p-2 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{project.blocker}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
