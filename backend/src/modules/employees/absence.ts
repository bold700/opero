import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/client.js";

// Availability lookups over EmployeeAbsence.
//
// Everything here works on inclusive plain "YYYY-MM-DD" day strings, the same
// representation WorkOrder.plannedDate and PlanningItem.date use. That format
// is lexicographically ordered, so day comparisons are plain string compares —
// no Date objects, no timezone skew, no "off by one at midnight in +02:00".

export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(v: unknown): v is string {
  return typeof v === "string" && ISO_DAY.test(v);
}

// Today as a "YYYY-MM-DD" day in the server's local zone. The org is a single
// Dutch company, so local time is the right frame of reference for "is someone
// off today" — not UTC, which flips two hours early in the evening.
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Two inclusive ranges overlap when each starts on or before the other ends.
// A single day is startDate === endDate, which this handles without a special
// case (from <= endDate && startDate <= to).
export function overlapsWhere(from: string, to: string): Prisma.EmployeeAbsenceWhereInput {
  return { startDate: { lte: to }, endDate: { gte: from } };
}

// Which of these employees are absent for any part of [from, to]?
// Returns a Set of employee ids, so callers can filter a list in one pass.
export async function absentEmployeeIds(
  orgId: string,
  from: string,
  to: string,
  employeeIds?: string[],
): Promise<Set<string>> {
  const rows = await prisma.employeeAbsence.findMany({
    where: {
      orgId,
      ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      ...overlapsWhere(from, to),
    },
    select: { employeeId: true },
  });
  return new Set(rows.map((r) => r.employeeId));
}

// The absences overlapping [from, to], with enough detail to explain a
// conflict to the office ("Jan is on holiday 3–17 Aug") rather than silently
// hiding him from a picker.
export async function absencesInRange(
  orgId: string,
  from: string,
  to: string,
  employeeIds?: string[],
) {
  return prisma.employeeAbsence.findMany({
    where: {
      orgId,
      ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      ...overlapsWhere(from, to),
    },
    include: { employee: { select: { id: true, name: true } } },
    orderBy: [{ startDate: "asc" }],
  });
}
