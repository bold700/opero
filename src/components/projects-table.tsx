"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { UrgencyBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { STAGE_LABELS, getStage, isPaid } from "@/lib/stages";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { type Project, type TeamMember } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export function ProjectsTable({
  projects,
  teamMembers,
  showPrices = true,
}: {
  projects: Project[];
  teamMembers: TeamMember[];
  showPrices?: boolean;
}) {
  const router = useRouter();

  function leaderName(id: string) {
    return teamMembers.find((member) => member.id === id)?.name ?? "Niet toegewezen";
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klant</TableHead>
                <TableHead>Projectnr</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">m2</TableHead>
                <TableHead>Geplande dag</TableHead>
                <TableHead>Teamleider</TableHead>
                <TableHead>Urgentie</TableHead>
                {showPrices ? (
                  <TableHead className="text-right">Waarde</TableHead>
                ) : null}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow
                  className="cursor-pointer transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none"
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/projects/${project.id}`);
                    }
                  }}
                  tabIndex={0}
                >
                  <TableCell>
                    <Link
                      className="block font-medium text-zinc-950 hover:underline"
                      href={`/projects/${project.id}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {project.name || project.customerName}
                    </Link>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {project.name ? `${project.customerName} · ` : ""}
                      {project.city || "Geen plaats"}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600">
                    {project.projectNumber}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isPaid(project) ? "emerald" : "zinc"}>
                      {isPaid(project) ? "Betaald" : STAGE_LABELS[getStage(project)]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-700">
                    {project.insulationType}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {project.squareMeters || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-700">
                    {formatDate(project.plannedDate)}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-700">
                    {leaderName(project.teamLeaderId)}
                  </TableCell>
                  <TableCell>
                    <UrgencyBadge urgency={project.urgency} />
                  </TableCell>
                  {showPrices ? (
                    <TableCell className="text-right text-sm font-medium text-zinc-950">
                      {formatCurrency(project.value)}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Link
                      aria-label={`Open ${project.customerName}`}
                      className="flex size-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-950"
                      href={`/projects/${project.id}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="text-center text-sm text-zinc-500"
                    colSpan={10}
                  >
                    Geen projecten gevonden
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
