import { describe, expect, it } from "vitest";
import {
  deriveWorkOrderStatus,
  resolveWorkOrderStatus,
  workOrderPhaseForStatus,
} from "@opero/shared";

const base = () => ({
  plannedDate: null,
  assigneeCount: 0,
  dispatchedAt: null,
  signedAt: null,
  approvedBySupervisor: false,
  invoiceStatus: "not_started",
  tasks: [] as {
    done: boolean;
    startedAt: string | null;
    endedAt?: string | null;
    hours?: number | null;
  }[],
});

describe("work-order lifecycle", () => {
  it("derives every status from its source record", () => {
    expect(deriveWorkOrderStatus(base())).toBe("open");
    expect(
      deriveWorkOrderStatus({ ...base(), plannedDate: "2026-10-01", assigneeCount: 1 }),
    ).toBe("planned");
    expect(
      deriveWorkOrderStatus({
        ...base(),
        plannedDate: "2026-10-01",
        assigneeCount: 1,
        dispatchedAt: new Date(),
      }),
    ).toBe("released");
    expect(
      deriveWorkOrderStatus({
        ...base(),
        dispatchedAt: new Date(),
        tasks: [{ done: false, startedAt: "2026-10-01T08:00:00Z" }],
      }),
    ).toBe("in_progress");
    expect(
      deriveWorkOrderStatus({
        ...base(),
        signedAt: new Date(),
        tasks: [{ done: true, startedAt: "2026-10-01T08:00:00Z" }],
      }),
    ).toBe("ready_for_review");
    expect(
      deriveWorkOrderStatus({
        ...base(),
        signedAt: new Date(),
        approvedBySupervisor: true,
      }),
    ).toBe("approved");
    expect(deriveWorkOrderStatus({ ...base(), invoiceStatus: "draft" })).toBe(
      "ready_to_invoice",
    );
    expect(deriveWorkOrderStatus({ ...base(), invoiceStatus: "sent" })).toBe(
      "invoiced",
    );
    expect(deriveWorkOrderStatus({ ...base(), invoiceStatus: "paid" })).toBe(
      "completed",
    );
  });

  it("groups statuses into the three visible phases", () => {
    expect(workOrderPhaseForStatus("open")).toBe("preparation");
    expect(workOrderPhaseForStatus("released")).toBe("preparation");
    expect(workOrderPhaseForStatus("in_progress")).toBe("realization");
    expect(workOrderPhaseForStatus("approved")).toBe("realization");
    expect(workOrderPhaseForStatus("ready_to_invoice")).toBe("completion");
    expect(workOrderPhaseForStatus("completed")).toBe("completion");
  });

  it("keeps an explicit office status until the override is cleared", () => {
    expect(resolveWorkOrderStatus(base(), "approved")).toBe("approved");
    expect(resolveWorkOrderStatus(base(), null)).toBe("open");
    expect(resolveWorkOrderStatus(base(), "unknown")).toBe("open");
  });
});
