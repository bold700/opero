import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  projectStatusLabels,
  type MaterialReadiness,
  type ProjectStatus,
  type ProjectUrgency,
  type WorkOrderStatus,
} from "@/lib/types";

const statusVariants: Record<ProjectStatus, BadgeProps["variant"]> = {
  afronding: "emerald",
  operatie: "cyan",
  verkoop: "violet",
};

const materialLabels: Record<MaterialReadiness, string> = {
  available: "Beschikbaar",
  needs_ordering: "Bestellen",
  partly_available: "Deels op voorraad",
};

const materialVariants: Record<MaterialReadiness, BadgeProps["variant"]> = {
  available: "emerald",
  needs_ordering: "red",
  partly_available: "amber",
};

const urgencyLabels: Record<ProjectUrgency, string> = {
  blocked: "Blokkade",
  normal: "Normaal",
  urgent: "Urgent",
};

const urgencyVariants: Record<ProjectUrgency, BadgeProps["variant"]> = {
  blocked: "red",
  normal: "zinc",
  urgent: "amber",
};

const workOrderLabels: Record<WorkOrderStatus, string> = {
  blocked: "Geblokkeerd",
  completed: "Afgerond",
  in_progress: "Bezig",
  on_the_way: "Onderweg",
  planned: "Gepland",
};

const workOrderVariants: Record<WorkOrderStatus, BadgeProps["variant"]> = {
  blocked: "red",
  completed: "emerald",
  in_progress: "cyan",
  on_the_way: "amber",
  planned: "zinc",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant={statusVariants[status]}>{projectStatusLabels[status]}</Badge>;
}

export function MaterialStatusBadge({ status }: { status: MaterialReadiness }) {
  return <Badge variant={materialVariants[status]}>{materialLabels[status]}</Badge>;
}

export function UrgencyBadge({ urgency }: { urgency: ProjectUrgency }) {
  return <Badge variant={urgencyVariants[urgency]}>{urgencyLabels[urgency]}</Badge>;
}

export function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  return <Badge variant={workOrderVariants[status]}>{workOrderLabels[status]}</Badge>;
}
