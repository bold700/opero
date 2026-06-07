"use client";

import Link from "next/link";
import { type ElementType } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Euro,
  PackageCheck,
  PackageSearch,
  ReceiptText,
  Send,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectStatusBadge, WorkOrderStatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { useOperoStore } from "@/lib/store";
import {
  accountRoleConfig,
  getVisibleProjectsForProfile,
  type TestProfile,
} from "@/lib/roles";
import { getProjectMaterialReadiness } from "@/lib/workflow";
import { formatCurrency, formatDate } from "@/lib/utils";
import { type Project } from "@/lib/types";

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-11 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-sm text-zinc-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PageHeader({
  eyebrow,
  title,
  cta,
}: {
  eyebrow: string;
  title: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium text-emerald-700">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-normal text-zinc-950">
          {title}
        </h1>
      </div>
      {cta ? (
        <Button asChild size="lg">
          <Link href={cta.href}>
            {cta.label}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function ProjectListCard({
  title,
  items,
  emptyLabel,
  badge,
  describe = (project) => `${project.nextStep} · ${project.insulationType}`,
}: {
  title: string;
  items: Project[];
  emptyLabel: string;
  badge?: string;
  describe?: (project: Project) => string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {badge ? <Badge variant="outline">{badge}</Badge> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.slice(0, 5).map((project) => (
          <Link
            className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300"
            href={`/projects/${project.id}`}
            key={project.id}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-zinc-950">{project.customerName}</p>
                <ProjectStatusBadge status={project.status} />
              </div>
              <p className="mt-1 text-sm text-zinc-500">{describe(project)}</p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-zinc-400" />
          </Link>
        ))}
        {items.length === 0 ? <EmptyState label={emptyLabel} /> : null}
      </CardContent>
    </Card>
  );
}

function getIsoWeekRange(today: Date) {
  const day = today.getDay() || 7;
  const start = new Date(today);
  start.setDate(today.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { end, start };
}

function inThisWeek(dateIso?: string) {
  if (!dateIso) return false;
  const { end, start } = getIsoWeekRange(new Date());
  const date = new Date(`${dateIso}T12:00:00`);
  return date >= start && date <= end;
}

function MonteurView({
  profile,
  projects,
}: {
  profile: TestProfile;
  projects: Project[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const myWorkOrders = projects
    .flatMap((project) =>
      project.workOrders.map((workOrder) => ({ project, workOrder })),
    )
    .filter(
      (entry) =>
        entry.workOrder.teamLeaderId === profile.teamMemberId ||
        entry.workOrder.installerIds.includes(profile.teamMemberId ?? ""),
    );
  const todayWork = myWorkOrders.find((entry) => entry.workOrder.date === today);
  const upcoming = myWorkOrders
    .filter((entry) => entry.workOrder.date > today)
    .sort((a, b) => a.workOrder.date.localeCompare(b.workOrder.date));
  const blocked = myWorkOrders.filter((entry) => entry.workOrder.status === "blocked");
  const deliveryOpen = projects.filter(
    (project) =>
      project.status === "afronding" &&
      !project.deliveryChecklist.items.every((item) => item.complete),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vandaag"
        title={`Goedemorgen, ${profile.name.split(" ")[0]}`}
        cta={
          todayWork
            ? { href: "/execution", label: "Open werkbon vandaag" }
            : undefined
        }
      />

      {todayWork ? (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                Werkbon vandaag
              </p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-950">
                {todayWork.project.customerName}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                {todayWork.project.address}, {todayWork.project.city}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <WorkOrderStatusBadge status={todayWork.workOrder.status} />
              <Button asChild size="sm">
                <Link href="/execution">
                  Open
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState label="Geen werkbon voor vandaag." />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={CalendarDays}
          label="Werkbonnen deze week"
          value={`${myWorkOrders.filter((entry) => inThisWeek(entry.workOrder.date)).length}`}
        />
        <MetricCard icon={AlertTriangle} label="Issues open" value={`${blocked.length}`} />
        <MetricCard
          icon={ClipboardCheck}
          label="Opleveringen open"
          value={`${deliveryOpen.length}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Komende werkbonnen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.slice(0, 5).map((entry) => (
              <Link
                className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300"
                href={`/projects/${entry.project.id}`}
                key={entry.workOrder.id}
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-950">
                    {entry.project.customerName}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatDate(entry.workOrder.date)} · {entry.project.insulationType}
                  </p>
                </div>
                <WorkOrderStatusBadge status={entry.workOrder.status} />
              </Link>
            ))}
            {upcoming.length === 0 ? <EmptyState label="Geen werk gepland" /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {blocked.map((entry) => (
              <div
                className="rounded-lg border border-red-100 bg-red-50 p-4 text-red-800"
                key={entry.workOrder.id}
              >
                <p className="font-medium">{entry.project.customerName}</p>
                <p className="mt-1 text-sm">{entry.project.blocker ?? "Issue gemeld"}</p>
              </div>
            ))}
            {blocked.length === 0 ? <EmptyState label="Geen issues" /> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProjectmanagerView({
  profile,
  projects,
}: {
  profile: TestProfile;
  projects: Project[];
}) {
  const blockers = projects.filter((project) => project.urgency === "blocked");
  const quoteFollowups = projects.filter(
    (project) => project.status === "verkoop" && project.quote.status === "sent",
  );
  const materialsReady = projects.filter(
    (project) =>
      project.status === "operatie" &&
      getProjectMaterialReadiness(project) === "available" &&
      project.workOrders.length === 0,
  );
  const inExecution = projects.filter(
    (project) => project.status === "operatie" && project.workOrders.length > 0,
  );
  const deliveryOpen = projects.filter(
    (project) =>
      project.status === "afronding" &&
      !project.deliveryChecklist.items.every((item) => item.complete),
  );
  const plannedThisWeek = projects.filter(
    (project) => inThisWeek(project.plannedDate),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vandaag"
        title={`Operationele grip, ${profile.name.split(" ")[0]}`}
        cta={{ href: "/planning", label: "Naar planning" }}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={AlertTriangle} label="Blokkades" value={`${blockers.length}`} />
        <MetricCard icon={Send} label="Open offertes" value={`${quoteFollowups.length}`} />
        <MetricCard
          icon={PackageCheck}
          label="Klaar voor planning"
          value={`${materialsReady.length}`}
        />
        <MetricCard icon={Wrench} label="In uitvoering" value={`${inExecution.length}`} />
        <MetricCard
          icon={ClipboardCheck}
          label="Oplevercheck open"
          value={`${deliveryOpen.length}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <ProjectListCard
          badge={`${plannedThisWeek.length} deze week`}
          describe={(project) => `${formatDate(project.plannedDate)} · ${project.insulationType}`}
          emptyLabel="Niets gepland deze week"
          items={plannedThisWeek}
          title="Uitvoering deze week"
        />

        <Card>
          <CardHeader>
            <CardTitle>Blokkades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {blockers.map((project) => (
              <Link
                className="flex gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-red-800 transition hover:border-red-200"
                href={`/projects/${project.id}`}
                key={project.id}
              >
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-medium">{project.customerName}</p>
                  <p className="mt-1 text-sm text-red-700">{project.blocker}</p>
                </div>
              </Link>
            ))}
            {blockers.length === 0 ? <EmptyState label="Geen blokkades" /> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProjectListCard
          describe={(project) => `Offerte verstuurd ${formatDate(project.quote.sentDate)}`}
          emptyLabel="Geen openstaande offertes"
          items={quoteFollowups}
          title="Offertes opvolgen"
        />
        <ProjectListCard
          describe={() => "Materialen beschikbaar - plan dit project"}
          emptyLabel="Niets klaar voor planning"
          items={materialsReady}
          title="Klaar om te plannen"
        />
      </div>
    </div>
  );
}

function SalesView({
  profile,
  projects,
}: {
  profile: TestProfile;
  projects: Project[];
}) {
  const verkoopProjects = projects.filter((p) => p.status === "verkoop");
  const newRequests = verkoopProjects.filter(
    (p) => p.intake.status === "planned" && !p.intake.plannedDate,
  );
  const intakePlanned = verkoopProjects.filter(
    (p) => p.intake.status === "planned" && Boolean(p.intake.plannedDate),
  );
  const intakeDone = verkoopProjects.filter(
    (p) => p.intake.status === "completed" && p.quote.status === "draft",
  );
  const quotesOut = verkoopProjects.filter((p) => p.quote.status === "sent");
  const openValue = quotesOut.reduce((sum, project) => sum + project.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vandaag"
        title={`Sales overzicht, ${profile.name.split(" ")[0]}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ClipboardCheck} label="Nieuwe aanvragen" value={`${newRequests.length}`} />
        <MetricCard icon={CalendarDays} label="Intakes gepland" value={`${intakePlanned.length}`} />
        <MetricCard icon={TrendingUp} label="Offertes open" value={`${quotesOut.length}`} />
        <MetricCard icon={Euro} label="Open offertewaarde" value={formatCurrency(openValue)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProjectListCard
          describe={(project) => `Aanvraag ${project.projectNumber} · ${project.city}`}
          emptyLabel="Geen nieuwe aanvragen"
          items={newRequests}
          title="Te plannen intake"
        />
        <ProjectListCard
          describe={(project) =>
            `Intake afgerond - offerte opstellen voor ${project.customerName}`
          }
          emptyLabel="Geen intakes klaar voor offerte"
          items={intakeDone}
          title="Klaar voor offerte"
        />
      </div>

      <ProjectListCard
        badge={formatCurrency(openValue)}
        describe={(project) =>
          `Verstuurd ${formatDate(project.quote.sentDate)} · ${formatCurrency(project.value)}`
        }
        emptyLabel="Geen openstaande offertes"
        items={quotesOut}
        title="Offertes open"
      />
    </div>
  );
}

function VoorraadView({
  profile,
  projects,
}: {
  profile: TestProfile;
  projects: Project[];
}) {
  const inventory = useOperoStore((state) => state.inventory);
  const purchaseLists = useOperoStore((state) => state.purchaseLists);
  const materialsCheck = projects.filter(
    (project) =>
      project.status === "operatie" &&
      getProjectMaterialReadiness(project) !== "available",
  );
  const blocked = projects.filter(
    (project) => getProjectMaterialReadiness(project) === "needs_ordering",
  );
  const belowReorder = inventory.filter(
    (item) => item.quantityInStock <= item.reorderPoint,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vandaag"
        title={`Voorraad en inkoop, ${profile.name.split(" ")[0]}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={PackageSearch} label="Materialencheck open" value={`${materialsCheck.length}`} />
        <MetricCard icon={AlertTriangle} label="Wachten op bestelling" value={`${blocked.length}`} />
        <MetricCard icon={PackageCheck} label="Onder bestelpunt" value={`${belowReorder.length}`} />
        <MetricCard icon={ReceiptText} label="Inkooplijsten open" value={`${purchaseLists.length}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProjectListCard
          describe={(project) => `${project.insulationType} · ${project.squareMeters} m2`}
          emptyLabel="Geen open materialencheck"
          items={materialsCheck}
          title="Te controleren materialen"
        />
        <Card>
          <CardHeader>
            <CardTitle>Onder bestelpunt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {belowReorder.map((item) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border border-orange-100 bg-orange-50 p-4 text-orange-900"
                key={item.id}
              >
                <div className="min-w-0">
                  <p className="font-medium">{item.materialName}</p>
                  <p className="mt-1 text-sm">
                    {item.quantityInStock} {item.unit} in voorraad · bestelpunt {item.reorderPoint}
                  </p>
                </div>
                <Badge variant="outline">{item.supplier}</Badge>
              </div>
            ))}
            {belowReorder.length === 0 ? (
              <EmptyState label="Alle voorraad op orde" />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdministratieView({
  profile,
  projects,
}: {
  profile: TestProfile;
  projects: Project[];
}) {
  const readyToInvoice = projects.filter(
    (project) =>
      project.status === "afronding" &&
      (project.invoice.status === "draft" || project.invoice.status === "not_started"),
  );
  const sentInvoices = projects.filter(
    (project) => project.invoice.status === "sent",
  );
  const recentPaid = projects.filter((project) => project.invoice.status === "paid");
  const openInvoiced = sentInvoices.reduce(
    (sum, project) => sum + project.invoice.acceptedQuoteAmount,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vandaag"
        title={`Administratie, ${profile.name.split(" ")[0]}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ReceiptText} label="Klaar voor factuur" value={`${readyToInvoice.length}`} />
        <MetricCard icon={Send} label="Verzonden" value={`${sentInvoices.length}`} />
        <MetricCard icon={Euro} label="Open bedrag" value={formatCurrency(openInvoiced)} />
        <MetricCard icon={ClipboardCheck} label="Betaald (totaal)" value={`${recentPaid.length}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProjectListCard
          describe={(project) =>
            project.invoice.status === "draft"
              ? "Factuurconcept klaar"
              : "Project afgerond - factuur opmaken"
          }
          emptyLabel="Geen openstaande facturen"
          items={readyToInvoice}
          title="Klaar voor factuur"
        />
        <ProjectListCard
          describe={(project) =>
            `Verstuurd ${formatDate(project.invoice.sentDate)} · ${formatCurrency(project.invoice.acceptedQuoteAmount)}`
          }
          emptyLabel="Geen verzonden facturen"
          items={sentInvoices}
          title="Wachten op betaling"
        />
      </div>
    </div>
  );
}

function OpdrachtgeverView({ profile }: { profile: TestProfile }) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Welkom"
        title={`Hallo ${profile.name.split(" ")[0]}`}
        cta={{ href: "/portaal", label: "Open klantportaal" }}
      />

      <Card>
        <CardContent className="space-y-3 p-6 text-sm text-zinc-600">
          <p>
            Volg al je lopende isolatieprojecten in het klantportaal. Daar zie je
            status, planning, foto&apos;s en facturen.
          </p>
          <Button asChild>
            <Link href="/portaal">
              Open klantportaal
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SuperAdminView({
  profile,
  projects,
}: {
  profile: TestProfile;
  projects: Project[];
}) {
  const activeProjects = projects.filter(
    (project) => project.invoice.status !== "paid",
  );
  const waitingForMaterials = projects.filter(
    (project) => getProjectMaterialReadiness(project) !== "available",
  );
  const plannedThisWeek = projects.filter((project) =>
    inThisWeek(project.plannedDate),
  );
  const readyToInvoice = projects.filter(
    (project) =>
      project.status === "afronding" &&
      (project.invoice.status === "draft" || project.invoice.status === "not_started"),
  );
  const blockers = projects.filter((project) => project.urgency === "blocked");
  const openRevenue = projects
    .filter((project) => project.invoice.status !== "paid")
    .reduce((sum, project) => sum + project.value, 0);
  const activeConfig = accountRoleConfig[profile.role];
  const Icon = activeConfig.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vandaag"
        title="Operationeel overzicht"
        cta={{ href: "/planning", label: "Naar planning" }}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={ClipboardCheck} label="Actieve projecten" value={`${activeProjects.length}`} />
        <MetricCard icon={PackageCheck} label="Wachten op materialen" value={`${waitingForMaterials.length}`} />
        <MetricCard icon={CalendarDays} label="Gepland deze week" value={`${plannedThisWeek.length}`} />
        <MetricCard icon={ReceiptText} label="Klaar voor factuur" value={`${readyToInvoice.length}`} />
        <MetricCard icon={Euro} label="Open waarde" value={formatCurrency(openRevenue)} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Icon className="size-5 text-emerald-700" />
            Prioriteit voor {activeConfig.label}
          </CardTitle>
          <Badge variant="outline">{projects.length} projecten</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {projects.slice(0, 5).map((project) => (
            <Link
              className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300"
              href={`/projects/${project.id}`}
              key={project.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-zinc-950">{project.customerName}</p>
                  <ProjectStatusBadge status={project.status} />
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {project.nextStep} · {project.insulationType}
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-zinc-400" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <ProjectListCard
          describe={(project) =>
            `${formatDate(project.plannedDate)} · ${project.insulationType}`
          }
          emptyLabel="Nog niets gepland"
          items={plannedThisWeek}
          title="Komende uitvoering"
        />

        <Card>
          <CardHeader>
            <CardTitle>Blokkades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {blockers.map((project) => (
              <Link
                className="flex gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-red-800 transition hover:border-red-200"
                href={`/projects/${project.id}`}
                key={project.id}
              >
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-medium">{project.customerName}</p>
                  <p className="mt-1 text-sm text-red-700">{project.blocker}</p>
                </div>
              </Link>
            ))}
            {blockers.length === 0 ? <EmptyState label="Geen blokkades" /> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DashboardClient() {
  const projects = useOperoStore((state) => state.projects);
  const activeProfileId = useOperoStore((state) => state.activeProfileId);
  const profiles = useOperoStore((state) => state.profiles);
  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const visibleProjects = getVisibleProjectsForProfile(activeProfile, projects);

  if (activeProfile.role === "monteur") {
    return <MonteurView profile={activeProfile} projects={visibleProjects} />;
  }
  if (activeProfile.role === "projectmanager") {
    return <ProjectmanagerView profile={activeProfile} projects={visibleProjects} />;
  }
  if (activeProfile.role === "sales") {
    return <SalesView profile={activeProfile} projects={visibleProjects} />;
  }
  if (activeProfile.role === "voorraad") {
    return <VoorraadView profile={activeProfile} projects={visibleProjects} />;
  }
  if (activeProfile.role === "administratie") {
    return <AdministratieView profile={activeProfile} projects={visibleProjects} />;
  }
  if (activeProfile.role === "opdrachtgever") {
    return <OpdrachtgeverView profile={activeProfile} />;
  }
  return <SuperAdminView profile={activeProfile} projects={visibleProjects} />;
}
