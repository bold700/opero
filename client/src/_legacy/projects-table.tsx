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
    <>
      {/* Desktop: tabel. */}
      <Card className="hidden sm:block">
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
                    onClick={() => router.push(`/project?id=${project.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/project?id=${project.id}`);
                      }
                    }}
                    tabIndex={0}
                  >
                    <TableCell>
                      <Link
                        className="block font-medium text-zinc-950 hover:underline"
                        href={`/project?id=${project.id}`}
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
                        {isPaid(project)
                          ? "Betaald"
                          : STAGE_LABELS[getStage(project)]}
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
                        href={`/project?id=${project.id}`}
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

      {/* Mobiel: card-lijst, want tabellen scrollen slecht op een klein scherm. */}
      <div className="space-y-3 sm:hidden">
        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-zinc-500">
              Geen projecten gevonden
            </CardContent>
          </Card>
        ) : (
          projects.map((project) => (
            <Card
              className="transition-colors hover:bg-zinc-50"
              key={project.id}
            >
              <Link
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={`/project?id=${project.id}`}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-950">
                        {project.name || project.customerName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {project.name ? `${project.customerName} · ` : ""}
                        {project.city || "Geen plaats"}
                      </p>
                    </div>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-zinc-400" />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isPaid(project) ? "emerald" : "zinc"}>
                      {isPaid(project)
                        ? "Betaald"
                        : STAGE_LABELS[getStage(project)]}
                    </Badge>
                    <UrgencyBadge urgency={project.urgency} />
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                    <Fact label="Projectnr" value={project.projectNumber} />
                    <Fact label="Type" value={project.insulationType} />
                    <Fact label="m2" value={project.squareMeters || "-"} />
                    <Fact
                      label="Geplande dag"
                      value={formatDate(project.plannedDate)}
                    />
                    <Fact
                      label="Teamleider"
                      value={leaderName(project.teamLeaderId)}
                    />
                    {showPrices ? (
                      <Fact
                        label="Waarde"
                        value={formatCurrency(project.value)}
                      />
                    ) : null}
                  </dl>
                </CardContent>
              </Link>
            </Card>
          ))
        )}
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="truncate font-medium text-zinc-800">{value}</dd>
    </div>
  );
}
