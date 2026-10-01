const DAY_MS = 86_400_000;

export function expandPlanningDates(
  start?: string,
  end?: string,
  maximumDays = 366,
): string[] {
  if (!start) return [];
  if (!end || end <= start) return [start];
  const dates: string[] = [];
  for (
    let timestamp = Date.parse(start);
    timestamp <= Date.parse(end) && dates.length < maximumDays;
    timestamp += DAY_MS
  ) {
    dates.push(new Date(timestamp).toISOString().slice(0, 10));
  }
  return dates;
}

export function workOrderPlanningDates(workOrder: {
  plannedDate?: string;
  plannedEndDate?: string;
  plannedDates?: string[];
}): string[] {
  return workOrder.plannedDates?.length
    ? [...new Set(workOrder.plannedDates)].sort()
    : expandPlanningDates(workOrder.plannedDate, workOrder.plannedEndDate);
}
