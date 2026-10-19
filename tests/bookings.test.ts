import { beforeEach, describe, expect, it, vi } from "vitest";

// The booking rules are tested without a database: the Prisma client is replaced by a stand-in.
const db = vi.hoisted(() => ({
  prisma: {
    booking: { findMany: vi.fn(), updateMany: vi.fn() },
    bookingEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/prisma", () => db);

import { resolveTransition, serializeBooking, settleStaleBookings } from "@/lib/bookings";
import type { BookingAction } from "@/lib/bookings";

const NOW = new Date("2030-06-15T12:00:00Z");
const PAST = new Date("2030-06-14T12:00:00Z");
const FUTURE = new Date("2030-06-20T12:00:00Z");
const HOUR = 60 * 60 * 1000;

type Status = "REQUESTED" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "COMPLETED" | "EXPIRED";

function run(action: BookingAction, status: Status, eventDate: Date, role: "customer" | "chef") {
  return resolveTransition(action, { status, eventDate }, role, NOW);
}
const ok = (status: string) => ({ ok: true, status });
const fails = (httpStatus: number) => expect.objectContaining({ ok: false, httpStatus });

describe("resolveTransition: accept", () => {
  it("lets the chef accept a future request", () => {
    expect(run("accept", "REQUESTED", FUTURE, "chef")).toEqual(ok("ACCEPTED"));
  });
  it("never lets the customer accept", () => {
    expect(run("accept", "REQUESTED", FUTURE, "customer")).toEqual(fails(403));
  });
  it("refuses once the event time has passed", () => {
    expect(run("accept", "REQUESTED", PAST, "chef")).toEqual(fails(400));
  });
  it.each(["ACCEPTED", "DECLINED", "CANCELLED", "COMPLETED", "EXPIRED"] as const)(
    "refuses a booking that is already %s",
    (status) => {
      expect(run("accept", status, FUTURE, "chef")).toEqual(fails(409));
    }
  );
});

describe("resolveTransition: decline", () => {
  it("lets the chef decline a request", () => {
    expect(run("decline", "REQUESTED", FUTURE, "chef")).toEqual(ok("DECLINED"));
  });
  it("never lets the customer decline", () => {
    expect(run("decline", "REQUESTED", FUTURE, "customer")).toEqual(fails(403));
  });
  it("cannot decline an expired or already answered request", () => {
    expect(run("decline", "EXPIRED", PAST, "chef")).toEqual(fails(409));
    expect(run("decline", "ACCEPTED", FUTURE, "chef")).toEqual(fails(409));
  });
});

describe("resolveTransition: cancel", () => {
  it("lets the customer cancel a requested or accepted booking before the event", () => {
    expect(run("cancel", "REQUESTED", FUTURE, "customer")).toEqual(ok("CANCELLED"));
    expect(run("cancel", "ACCEPTED", FUTURE, "customer")).toEqual(ok("CANCELLED"));
  });
  it("lets the chef cancel only an accepted booking", () => {
    expect(run("cancel", "ACCEPTED", FUTURE, "chef")).toEqual(ok("CANCELLED"));
    expect(run("cancel", "REQUESTED", FUTURE, "chef")).toEqual(fails(409)); // decline instead
  });
  it("cannot cancel after the event time, by either side", () => {
    expect(run("cancel", "ACCEPTED", PAST, "customer")).toEqual(fails(409));
    expect(run("cancel", "ACCEPTED", PAST, "chef")).toEqual(fails(409));
  });
  it("cannot cancel when the event starts exactly now", () => {
    expect(run("cancel", "ACCEPTED", NOW, "customer")).toEqual(fails(409));
  });
  it.each(["DECLINED", "CANCELLED", "COMPLETED", "EXPIRED"] as const)("cannot cancel a %s booking", (status) => {
    expect(run("cancel", status, FUTURE, "customer")).toEqual(fails(409));
  });
});

describe("resolveTransition: complete", () => {
  it("lets the chef complete an accepted booking after the event", () => {
    expect(run("complete", "ACCEPTED", PAST, "chef")).toEqual(ok("COMPLETED"));
  });
  it("refuses before the event time", () => {
    expect(run("complete", "ACCEPTED", FUTURE, "chef")).toEqual(fails(400));
  });
  it("never lets the customer complete", () => {
    expect(run("complete", "ACCEPTED", PAST, "customer")).toEqual(fails(403));
  });
  it("only completes accepted bookings", () => {
    expect(run("complete", "REQUESTED", PAST, "chef")).toEqual(fails(409));
    expect(run("complete", "EXPIRED", PAST, "chef")).toEqual(fails(409));
  });
});

describe("resolveTransition: unknown actions", () => {
  it("rejects them", () => {
    expect(run("explode" as BookingAction, "REQUESTED", FUTURE, "chef")).toEqual(fails(400));
  });
});

// A booking row shaped like the database query result.
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "bk1",
    customerId: "cust",
    chefId: "chef",
    eventDate: FUTURE,
    guests: 4,
    city: "Bhopal",
    area: "Arera Colony",
    address: "12 Example Street",
    phone: "9111111111",
    notes: null,
    estimatedTotal: 2000,
    status: "REQUESTED",
    createdAt: new Date("2030-06-01T00:00:00Z"),
    customer: { name: "Rohan Customer" },
    chef: { name: "Asha Chef", phone: "9222222222", chefProfile: { id: "prof1", displayName: "Chef Asha" } },
    review: null,
    events: [],
    ...overrides,
  } as Parameters<typeof serializeBooking>[0];
}

describe("serializeBooking: privacy", () => {
  it("hides the address and both phone numbers from the chef until the booking is accepted", () => {
    const view = serializeBooking(row(), "chef");
    expect(view.role).toBe("chef");
    expect(view.address).toBeNull();
    expect(view.contactPhone).toBeNull();
    expect(view.contactRevealed).toBe(false);
  });

  it("hides the chef's phone from the customer until accepted, but always shows them their own address", () => {
    const view = serializeBooking(row(), "cust");
    expect(view.role).toBe("customer");
    expect(view.address).toBe("12 Example Street");
    expect(view.contactPhone).toBeNull();
  });

  it.each(["ACCEPTED", "COMPLETED"] as const)("shares details once %s", (status) => {
    const chefView = serializeBooking(row({ status }), "chef");
    expect(chefView.address).toBe("12 Example Street");
    expect(chefView.contactPhone).toBe("9111111111"); // the customer's phone
    const customerView = serializeBooking(row({ status }), "cust");
    expect(customerView.contactPhone).toBe("9222222222"); // the chef's phone
  });

  it.each(["DECLINED", "CANCELLED", "EXPIRED"] as const)("keeps details private when the booking is %s", (status) => {
    expect(serializeBooking(row({ status }), "chef").address).toBeNull();
    expect(serializeBooking(row({ status }), "chef").contactPhone).toBeNull();
    expect(serializeBooking(row({ status }), "cust").contactPhone).toBeNull();
  });

  it("refuses to serialize for someone who is not part of the booking", () => {
    expect(() => serializeBooking(row(), "stranger")).toThrow();
  });

  it("never leaks raw contact fields into the view", () => {
    const json = JSON.stringify(serializeBooking(row(), "chef"));
    expect(json).not.toContain("9111111111");
    expect(json).not.toContain("9222222222");
    expect(json).not.toContain("12 Example Street");
  });

  it("shows who cancelled", () => {
    const events = [{ actorId: "chef" }];
    expect(serializeBooking(row({ status: "CANCELLED", events }), "chef").cancelledBy).toBe("you");
    expect(serializeBooking(row({ status: "CANCELLED", events }), "cust").cancelledBy).toBe("other");
    expect(serializeBooking(row({ status: "REQUESTED", events }), "chef").cancelledBy).toBeNull();
  });

  it("marks past events", () => {
    expect(serializeBooking(row({ eventDate: new Date(Date.now() - HOUR) }), "cust").eventPassed).toBe(true);
    expect(serializeBooking(row({ eventDate: new Date(Date.now() + HOUR) }), "cust").eventPassed).toBe(false);
  });
});

describe("settleStaleBookings", () => {
  const tx = { booking: db.prisma.booking, bookingEvent: db.prisma.bookingEvent };

  beforeEach(() => {
    vi.clearAllMocks();
    db.prisma.$transaction.mockImplementation(async (callback: (t: typeof tx) => Promise<unknown>) => callback(tx));
    db.prisma.booking.updateMany.mockResolvedValue({ count: 1 });
  });

  it("does nothing when there is nothing to settle", async () => {
    db.prisma.booking.findMany.mockResolvedValue([]);
    await settleStaleBookings();
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("expires old requests and completes old accepted bookings, logging each change", async () => {
    db.prisma.booking.findMany.mockResolvedValue([
      { id: "a", status: "REQUESTED" },
      { id: "b", status: "ACCEPTED" },
    ]);
    await settleStaleBookings({ customerId: "cust" });

    expect(db.prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "a", status: "REQUESTED" },
      data: { status: "EXPIRED" },
    });
    expect(db.prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "b", status: "ACCEPTED" },
      data: { status: "COMPLETED" },
    });
    expect(db.prisma.bookingEvent.create).toHaveBeenCalledWith({
      data: { bookingId: "a", actorId: null, fromStatus: "REQUESTED", toStatus: "EXPIRED" },
    });
    expect(db.prisma.bookingEvent.create).toHaveBeenCalledWith({
      data: { bookingId: "b", actorId: null, fromStatus: "ACCEPTED", toStatus: "COMPLETED" },
    });
  });

  it("only looks at bookings inside the given scope, and applies the 72-hour rule", async () => {
    db.prisma.booking.findMany.mockResolvedValue([]);
    const before = Date.now();
    await settleStaleBookings({ customerId: "cust" });

    const { where } = db.prisma.booking.findMany.mock.calls[0][0];
    expect(where.AND[0]).toEqual({ customerId: "cust" });
    const [requested, accepted] = where.AND[1].OR;
    expect(requested.status).toBe("REQUESTED");
    expect(requested.eventDate.lte.getTime()).toBeGreaterThanOrEqual(before);
    expect(accepted.status).toBe("ACCEPTED");
    expect(Date.now() - accepted.eventDate.lte.getTime()).toBeGreaterThanOrEqual(72 * HOUR - 1000);
  });

  it("skips the log entry when someone else changed the booking first", async () => {
    db.prisma.booking.findMany.mockResolvedValue([{ id: "a", status: "REQUESTED" }]);
    db.prisma.booking.updateMany.mockResolvedValue({ count: 0 });
    await settleStaleBookings();
    expect(db.prisma.bookingEvent.create).not.toHaveBeenCalled();
  });

  it("never throws, so a failure cannot break the page that called it", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    db.prisma.booking.findMany.mockRejectedValue(new Error("database down"));
    await expect(settleStaleBookings()).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
