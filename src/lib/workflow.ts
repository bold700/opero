import {
  type MaterialReadiness,
  type MaterialRequirement,
  type Project,
} from "@/lib/types";

export function getMaterialRequirementStatus(
  requirement: MaterialRequirement,
): MaterialReadiness {
  if (requirement.quantityInStock >= requirement.quantityNeeded) {
    return "available";
  }

  if (requirement.quantityInStock > 0) {
    return "partly_available";
  }

  return "needs_ordering";
}

export function getProjectMaterialReadiness(project: Project): MaterialReadiness {
  const statuses = project.materialRequirements.map(getMaterialRequirementStatus);

  if (statuses.length === 0) return "needs_ordering";
  if (statuses.every((status) => status === "available")) return "available";
  if (statuses.some((status) => status === "partly_available")) {
    return "partly_available";
  }

  return "needs_ordering";
}

export function canMoveToPlanned(project: Project) {
  return (
    project.status === "operatie" &&
    getProjectMaterialReadiness(project) === "available"
  );
}

export function isDeliveryComplete(project: Project) {
  return project.deliveryChecklist.items.every((item) => item.complete);
}

export function getOpenDeliveryItems(project: Project) {
  return project.deliveryChecklist.items.filter((item) => !item.complete);
}

export function getProjectAddress(project: Project) {
  return `${project.address}, ${project.postalCode} ${project.city}`;
}

export function isIntakeDone(project: Project) {
  return project.intake.status === "completed";
}

export function isQuoteDraft(project: Project) {
  return project.quote.status === "draft";
}

export function isQuoteSent(project: Project) {
  return project.quote.status === "sent";
}

export function isQuoteAccepted(project: Project) {
  return project.quote.status === "accepted";
}

export function hasPlanning(project: Project) {
  return project.planningItems.length > 0 || Boolean(project.plannedDate);
}

export function getActiveWorkOrder(project: Project) {
  return (
    project.workOrders.find((wo) => wo.status !== "completed") ??
    project.workOrders[0]
  );
}

export function isWorkInProgress(project: Project) {
  return project.workOrders.some((wo) => wo.status === "in_progress");
}

export function isWorkCompleted(project: Project) {
  return (
    project.workOrders.length > 0 &&
    project.workOrders.every((wo) => wo.status === "completed")
  );
}

export function isInvoiceDraft(project: Project) {
  return project.invoice.status === "draft";
}

export function isInvoiceSent(project: Project) {
  return project.invoice.status === "sent";
}

export function isInvoicePaid(project: Project) {
  return project.invoice.status === "paid";
}
