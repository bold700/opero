"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Hammer,
  MapPin,
  Phone,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentDialog } from "@/components/document-dialog";
import { EmptyState } from "@/components/empty-state";
import { useOperoStore } from "@/lib/store";
import {
  accountRoleConfig,
  getVisibleProjectsForProfile,
} from "@/lib/roles";
import { type Customer, type Project } from "@/lib/types";
import { formatCurrency, formatLongDate } from "@/lib/utils";

function customerStatusLabel(project: Project) {
  if (project.invoice.status === "paid") return "Betaald";
  if (project.invoice.status === "sent") return "Factuur verstuurd";
  if (project.status === "afronding") return "Werk afgerond";
  if (project.status === "operatie") {
    if (project.workOrders.some((wo) => wo.status === "in_progress"))
      return "Werk wordt uitgevoerd";
    if (project.plannedDate) return "Werkdag ingepland";
    return "Voorbereiding";
  }
  if (project.quote.status === "accepted") return "Akkoord gegeven";
  if (project.quote.status === "sent") return "Offerte ontvangen";
  if (project.intake.status === "completed") return "Werk in kaart gebracht";
  if (project.intake.plannedDate) return "Bezoek ingepland";
  return "Aanvraag ontvangen";
}

type Milestone = {
  id: string;
  label: string;
  description: string;
  icon: typeof FileText;
};

const milestones: Milestone[] = [
  {
    description: "We hebben het werk opgenomen en in kaart gebracht.",
    icon: ClipboardCheck,
    id: "intake",
    label: "Aanvraag en opname",
  },
  {
    description: "Offerte opgemaakt en akkoord ontvangen.",
    icon: FileText,
    id: "quote",
    label: "Offerte",
  },
  {
    description: "Materialen zijn klaargezet en team is gepland.",
    icon: CalendarDays,
    id: "planning",
    label: "Voorbereiding",
  },
  {
    description: "Onze monteurs voeren het werk uit.",
    icon: Hammer,
    id: "execution",
    label: "Uitvoering",
  },
  {
    description: "Werk opgeleverd, factuur verzonden.",
    icon: ReceiptText,
    id: "closing",
    label: "Afronding",
  },
];

function currentMilestoneIndex(project: Project) {
  if (project.invoice.status === "paid" || project.invoice.status === "sent") return 4;
  if (project.status === "afronding") return 4;
  if (project.workOrders.some((wo) => wo.status === "in_progress" || wo.status === "completed"))
    return 3;
  if (project.status === "operatie") return 2;
  if (project.quote.status === "sent" || project.quote.status === "accepted") return 1;
  return 0;
}

function progressRatio(project: Project) {
  const index = currentMilestoneIndex(project);
  return Math.round(((index + 1) / milestones.length) * 100);
}

export function PortaalClient() {
  const profiles = useOperoStore((state) => state.profiles);
  const activeProfileId = useOperoStore((state) => state.activeProfileId);
  const customers = useOperoStore((state) => state.customers);
  const projects = useOperoStore((state) => state.projects);
  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const config = accountRoleConfig[activeProfile.role];

  const projectsForCustomer =
    activeProfile.role === "opdrachtgever"
      ? projects.filter(
          (project) => project.customerId === activeProfile.customerId,
        )
      : getVisibleProjectsForProfile(activeProfile, projects);

  const customer =
    activeProfile.role === "opdrachtgever"
      ? customers.find((c) => c.id === activeProfile.customerId)
      : customers.find((c) => c.id === projectsForCustomer[0]?.customerId);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-emerald-50 via-white to-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
              Klantportaal
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Welkom {activeProfile.name.split(" ")[0]}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
              Volg al je lopende isolatieprojecten op een rustige plek. Geen
              interne werknamen, alleen de mijlpalen die voor jou tellen.
            </p>
            {customer ? (
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-600">
                <Badge variant="outline">{customer.name}</Badge>
                <Badge variant="outline">
                  <MapPin className="mr-1 size-3" />
                  {customer.city}
                </Badge>
                <Badge variant="outline">
                  <Phone className="mr-1 size-3" />
                  {customer.phone}
                </Badge>
              </div>
            ) : (
              <Badge className="mt-4" variant="outline">
                Testweergave als {config.label}
              </Badge>
            )}
          </div>
          <Card className="w-full max-w-xs shrink-0 bg-white">
            <CardContent className="space-y-1 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-zinc-950">
                <ShieldCheck className="size-4 text-emerald-600" />
                Vragen of doorgeven?
              </p>
              <p className="leading-6 text-zinc-600">
                Bel of mail je vaste contactpersoon. We reageren binnen 1 werkdag.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {projectsForCustomer.length === 0 ? (
        <EmptyState label="Op dit moment zijn er geen projecten voor jouw account." />
      ) : (
        <div className="space-y-5">
          {projectsForCustomer.map((project) => {
            const projectCustomer = customers.find(
              (c) => c.id === project.customerId,
            );
            return (
              <CustomerProjectCard
                customer={projectCustomer ?? customer}
                key={project.id}
                project={project}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function CustomerProjectCard({
  customer,
  project,
}: {
  customer?: Customer;
  project: Project;
}) {
  const currentIndex = currentMilestoneIndex(project);
  const currentMilestone = milestones[currentIndex];
  const ratio = progressRatio(project);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const acceptQuote = useOperoStore((state) => state.acceptQuote);
  const allPhotos = project.workOrders.flatMap((wo) => wo.photos);
  const canShowQuote =
    project.quote.status !== "draft" && project.quote.lineItems.length > 0;
  const canShowInvoice = project.invoice.status !== "not_started";
  const canAcceptInline =
    project.quote.status === "sent" && project.quote.lineItems.length > 0;

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-3 border-b border-zinc-100 pb-5">
        <div className="flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xl">{project.insulationType}</CardTitle>
          <Badge variant="emerald">{customerStatusLabel(project)}</Badge>
        </div>
        <p className="text-sm text-zinc-500">
          {project.address}, {project.postalCode} {project.city} ·{" "}
          {project.squareMeters} m2
        </p>
        <div className="w-full">
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${Math.max(ratio, 6)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-zinc-500">
            <span>Aanvraag</span>
            <span>Afronding</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        {currentMilestone ? (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-emerald-600 bg-white text-emerald-700">
              <currentMilestone.icon className="size-4" />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium text-zinc-950">
                {currentMilestone.label}
              </p>
              <p className="mt-0.5 text-sm leading-5 text-zinc-600">
                {currentMilestone.description}
              </p>
              <ActiveMilestoneDetail
                milestone={currentMilestone}
                project={project}
              />
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <DetailTile
            icon={CalendarDays}
            label="Geplande dag"
            value={project.plannedDate ? formatLongDate(project.plannedDate) : "Volgt"}
          />
          <DetailTile
            icon={FileText}
            label="Offertewaarde"
            value={formatCurrency(project.value)}
          />
          <DetailTile
            icon={CheckCircle2}
            label="Volgende stap"
            value={project.nextStep}
          />
        </div>

        {allPhotos.length > 0 ? (
          <PhotoGallery photos={allPhotos} />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {canShowQuote ? (
              <Button
                onClick={() => setQuoteOpen(true)}
                size="sm"
                variant="outline"
              >
                <FileText className="size-4" />
                Bekijk offerte
              </Button>
            ) : null}
            {canShowInvoice ? (
              <Button
                onClick={() => setInvoiceOpen(true)}
                size="sm"
                variant="outline"
              >
                <ReceiptText className="size-4" />
                {project.invoice.status === "paid"
                  ? "Bekijk factuur"
                  : "Bekijk factuur"}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-zinc-500">
              Projectnr {project.projectNumber}
            </p>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/project?id=${project.id}`}>
                Volledige status
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>

      <DocumentDialog
        customer={customer}
        kind="offerte"
        onOpenChange={setQuoteOpen}
        open={quoteOpen}
        project={project}
        primaryAction={
          canAcceptInline ? (
            <Button
              className="w-full"
              onClick={() => {
                acceptQuote(project.id);
                toast.success("Offerte geaccepteerd, project gaat naar uitvoering");
                setQuoteOpen(false);
              }}
            >
              <CheckCircle2 className="size-4" />
              Offerte accepteren
            </Button>
          ) : null
        }
      />
      <DocumentDialog
        customer={customer}
        kind="factuur"
        onOpenChange={setInvoiceOpen}
        open={invoiceOpen}
        project={project}
      />
    </Card>
  );
}

function PhotoGallery({ photos }: { photos: string[] }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
        <Camera className="size-3.5" />
        Foto&apos;s van het werk
        <span className="text-zinc-400">({photos.length})</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.slice(0, 8).map((photo, index) => (
          <div
            className="flex aspect-[4/3] items-center justify-center rounded-md border border-zinc-200 bg-gradient-to-br from-zinc-50 to-zinc-100 text-xs text-zinc-500"
            key={`${photo}-${index}`}
          >
            <div className="flex flex-col items-center gap-1.5 px-2 text-center">
              <Camera className="size-4 text-zinc-400" />
              <span className="truncate">{photo}</span>
            </div>
          </div>
        ))}
      </div>
      {photos.length > 8 ? (
        <p className="mt-2 text-xs text-zinc-500">
          + {photos.length - 8} meer foto&apos;s
        </p>
      ) : null}
    </div>
  );
}

function ActiveMilestoneDetail({
  milestone,
  project,
}: {
  milestone: Milestone;
  project: Project;
}) {
  if (milestone.id === "quote" && project.quote.sentDate) {
    return (
      <p className="mt-1 text-xs text-emerald-700">
        Offerte verstuurd op {formatLongDate(project.quote.sentDate)}
      </p>
    );
  }
  if (milestone.id === "planning" && project.plannedDate) {
    return (
      <p className="mt-1 text-xs text-emerald-700">
        Werkdag staat op {formatLongDate(project.plannedDate)}
      </p>
    );
  }
  if (milestone.id === "execution") {
    return (
      <p className="mt-1 text-xs text-emerald-700">
        Ons team is op locatie of bijna onderweg.
      </p>
    );
  }
  if (milestone.id === "closing" && project.invoice.sentDate) {
    return (
      <p className="mt-1 text-xs text-emerald-700">
        Factuur verstuurd op {formatLongDate(project.invoice.sentDate)}
      </p>
    );
  }
  return null;
}

function DetailTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-zinc-500" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        <p className="mt-1 truncate text-sm font-medium text-zinc-950">{value}</p>
      </div>
    </div>
  );
}
