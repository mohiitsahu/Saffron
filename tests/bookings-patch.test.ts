import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  notify: vi.fn(),
  prisma: {
    booking: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    bookingEvent: { create: vi.fn() },
    chefBlockedDay: { findUnique: vi.fn() },
    chefProfile: { findUnique: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/notify", () => ({ notifyBooking: mocks.notify }));
vi.mock("@/lib/bookings", async () => {
  const real = await vi.importActual<typeof import("@/lib/bookings")>("@/lib/bookings");
  return { ...real, bookingSelect: {}, serializeBooking: (b: unknown) => b };
});

import { PATCH } from "@/app/api/bookings/[id]/route";

const HOUR = 60 * 60 * 1000;
const future = new Date(Date.now() + 72 * HOUR);
const past = new Date(Date.now() - 5 * HOUR);

function patch(action: string) {
  return PATCH(
    new Request("http://localhost/api/bookings/bk1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }),
    { params: { id: "bk1" } }
  );
}

function setBooking(status: string, eventDate: Date) {
  const row = { id: "bk1", customerId: "cust1", chefId: "chef1", status, eventDate, guests: 2, version: 0, proposedEventDate: null };
  const mail = { eventDate, guests: 2, area: "Arera", estimatedTotal: 1000, customer: {}, chef: {} };
  // Response data is read inside the transaction; only email details are read afterward.
  mocks.prisma.booking.findUnique.mockReset();
  mocks.prisma.booking.findUnique.mockResolvedValueOnce(row).mockResolvedValueOnce(mail);
  mocks.prisma.booking.findUniqueOrThrow.mockReset().mockResolvedValue({ id: "bk1", status: "updated" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation(async (cb) =>
    cb({
      $executeRaw: mocks.prisma.$executeRaw,
      booking: mocks.prisma.booking,
      bookingEvent: mocks.prisma.bookingEvent,
      chefBlockedDay: mocks.prisma.chefBlockedDay,
      chefProfile: mocks.prisma.chefProfile,
    })
  );
  mocks.prisma.booking.findFirst.mockResolvedValue(null);
  mocks.prisma.chefBlockedDay.findUnique.mockResolvedValue(null);
  mocks.prisma.chefProfile.findUnique.mockResolvedValue({ suspended: false, maxGuests: 10 });
  mocks.prisma.booking.updateMany.mockResolvedValue({ count: 1 });
});

describe("PATCH /api/bookings/[id]: emails", () => {
  it("emails the customer when the chef accepts", async () => {
    mocks.session.mockResolvedValue({ user: { id: "chef1" } });
    setBooking("REQUESTED", future);
    expect((await patch("accept")).status).toBe(200);
    expect(mocks.notify.mock.calls[0][0]).toBe("accepted");
  });

  it("emails the customer when the chef declines", async () => {
    mocks.session.mockResolvedValue({ user: { id: "chef1" } });
    setBooking("REQUESTED", future);
    await patch("decline");
    expect(mocks.notify.mock.calls[0][0]).toBe("declined");
  });

  it("emails the customer to ask for a review when the chef completes", async () => {
    mocks.session.mockResolvedValue({ user: { id: "chef1" } });
    setBooking("ACCEPTED", past);
    await patch("complete");
    expect(mocks.notify.mock.calls[0][0]).toBe("completed");
  });

  it("tells the chef when the customer cancels", async () => {
    mocks.session.mockResolvedValue({ user: { id: "cust1" } });
    setBooking("ACCEPTED", future);
    await patch("cancel");
    expect(mocks.notify.mock.calls[0][0]).toBe("cancelledByCustomer");
  });

  it("tells the customer when the chef cancels", async () => {
    mocks.session.mockResolvedValue({ user: { id: "chef1" } });
    setBooking("ACCEPTED", future);
    await patch("cancel");
    expect(mocks.notify.mock.calls[0][0]).toBe("cancelledByChef");
  });

  it("sends no email when the action is refused", async () => {
    mocks.session.mockResolvedValue({ user: { id: "cust1" } });
    setBooking("REQUESTED", future);
    expect((await patch("accept")).status).toBe(403); // customers can't accept
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("sends no email when two people act at once and this one loses", async () => {
    mocks.session.mockResolvedValue({ user: { id: "chef1" } });
    setBooking("REQUESTED", future);
    mocks.prisma.booking.updateMany.mockResolvedValue({ count: 0 });
    expect((await patch("accept")).status).toBe(409);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("treats strangers as not found and sends nothing", async () => {
    mocks.session.mockResolvedValue({ user: { id: "stranger" } });
    setBooking("REQUESTED", future);
    expect((await patch("accept")).status).toBe(404);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("refuses acceptance of a date the chef subsequently blocked", async () => {
    mocks.session.mockResolvedValue({ user: { id: "chef1" } });
    setBooking("REQUESTED", future);
    mocks.prisma.chefBlockedDay.findUnique.mockResolvedValue({ id: "blocked1" });
    const res = await patch("accept");
    expect(res.status).toBe(409);
    expect(mocks.prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("refuses to accept a chef's second booking inside 4 hours of an accepted one", async () => {
    mocks.session.mockResolvedValue({ user: { id: "chef1" } });
    setBooking("REQUESTED", future);
    mocks.prisma.booking.findFirst.mockResolvedValue({ eventDate: future });
    const res = await patch("accept");
    expect(res.status).toBe(409);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("refuses acceptance when the chef lowered their capacity", async () => {
    mocks.session.mockResolvedValue({ user: { id: "chef1" } });
    setBooking("REQUESTED", future);
    mocks.prisma.chefProfile.findUnique.mockResolvedValue({ suspended: false, maxGuests: 1 });
    expect((await patch("accept")).status).toBe(409);
    expect(mocks.prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it.each([
    ["accept", "REQUESTED", "chef1", future],
    ["decline", "REQUESTED", "chef1", future],
    ["cancel", "ACCEPTED", "cust1", future],
    ["complete", "ACCEPTED", "chef1", past],
  ] as const)("returns the committed booking if email preparation fails after %s", async (action, status, userId, eventDate) => {
    mocks.session.mockResolvedValue({ user: { id: userId } });
    setBooking(status, eventDate);
    const row = { id: "bk1", customerId: "cust1", chefId: "chef1", status, eventDate, guests: 2, version: 0, proposedEventDate: null };
    mocks.prisma.booking.findUnique.mockReset().mockResolvedValueOnce(row).mockRejectedValueOnce(new Error("Email lookup failed"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await patch(action);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ booking: { id: "bk1", status: "updated" } });
      expect(mocks.prisma.bookingEvent.create).toHaveBeenCalledOnce();
      expect(mocks.notify).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it("preserves success when the notifier unexpectedly rejects", async () => {
    mocks.session.mockResolvedValue({ user: { id: "chef1" } }); setBooking("REQUESTED", future);
    mocks.notify.mockRejectedValueOnce(new Error("Notifier failed"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect((await patch("accept")).status).toBe(200); }
    finally { log.mockRestore(); }
  });

  it.each(["P2028", "P2034", "P2024"])("returns a retryable response for transaction failure %s", async (code) => {
    mocks.session.mockResolvedValue({ user: { id: "chef1" } }); setBooking("REQUESTED", future);
    mocks.prisma.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Temporary database failure", { code, clientVersion: "test" }));
    const response = await patch("accept");
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("Refresh My bookings");
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("fails within the transaction when response data cannot be prepared", async () => {
    mocks.session.mockResolvedValue({ user: { id: "chef1" } }); setBooking("REQUESTED", future);
    mocks.prisma.booking.findUniqueOrThrow.mockRejectedValueOnce(new Error("Response lookup failed"));
    await expect(patch("accept")).rejects.toThrow("Response lookup failed");
    expect(mocks.notify).not.toHaveBeenCalled();
  });

});
