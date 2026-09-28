import { describe, expect, it } from "vitest";
import {
  deriveProjectLifecycleStatus,
  type ProjectLifecycleWorkOrder,
} from "@opero/shared";

function workOrder(
  patch: Partial<ProjectLifecycleWorkOrder> = {},
): ProjectLifecycleWorkOrder {
  return {
    plannedDate: null,
    signedAt: null,
    listStatus: "open",
    assignees: [],
    invoice: { status: "not_started" },
    tasks: [],
    ...patch,
  };
}

describe("deriveProjectLifecycleStatus", () => {
  it("derives every automatic project step from its source records", () => {
    expect(deriveProjectLifecycleStatus({ archived: false, workOrders: [] })).toBe("new");
    expect(
      deriveProjectLifecycleStatus({ archived: false, workOrders: [workOrder()] }),
    ).toBe("work_preparation");
    expect(
      deriveProjectLifecycleStatus({
        archived: false,
        workOrders: [workOrder({ plannedDate: "2026-10-01", assignees: [{}] })],
      }),
    ).toBe("scheduled");
    expect(
      deriveProjectLifecycleStatus({
        archived: false,
        workOrders: [
          workOrder({
            plannedDate: "2026-10-01",
            assignees: [{}],
            tasks: [{ done: false, startedAt: "2026-10-01T08:00:00Z", endedAt: null, hours: null }],
          }),
        ],
      }),
    ).toBe("in_progress");
    expect(
      deriveProjectLifecycleStatus({
        archived: false,
        workOrders: [
          workOrder({
            signedAt: "2026-10-01T16:00:00Z",
            listStatus: "approved",
          }),
        ],
      }),
    ).toBe("ready_to_invoice");
    expect(
      deriveProjectLifecycleStatus({
        archived: false,
        workOrders: [workOrder({ invoice: { status: "sent" } })],
      }),
    ).toBe("invoiced");
    expect(
      deriveProjectLifecycleStatus({
        archived: false,
        workOrders: [workOrder({ invoice: { status: "paid" } })],
      }),
    ).toBe("completed");
    expect(
      deriveProjectLifecycleStatus({ archived: true, workOrders: [] }),
    ).toBe("history");
  });

  it("moves back to in progress when a signed work order is reopened", () => {
    const reopened = workOrder({
      signedAt: null,
      listStatus: "done",
      tasks: [{ done: true, startedAt: null, endedAt: null, hours: null }],
    });
    expect(
      deriveProjectLifecycleStatus({ archived: false, workOrders: [reopened] }),
    ).toBe("in_progress");
  });

  it("waits until every work order is planned before marking the project scheduled", () => {
    expect(
      deriveProjectLifecycleStatus({
        archived: false,
        workOrders: [
          workOrder(),
          workOrder({ plannedDate: "2026-10-02", assignees: [{}] }),
        ],
      }),
    ).toBe("work_preparation");
  });
});
