import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  notify: vi.fn(),
  prisma: {
    booking: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    bookingEvent: { create: vi.fn() },
    chefBlockedDay: { findUnique: vi.fn() },
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
  const row = { id: "bk1", customerId: "cust1", chefId: "chef1", status, eventDate };
  const mail = { eventDate, guests: 2, area: "Arera", estimatedTotal: 1000, customer: {}, chef: {} };
  // First lookup finds the booking, the second gathers the email details, the third is the response.
  mocks.prisma.booking.findUnique.mockReset();
  mocks.prisma.booking.findUnique.mockResolvedValueOnce(row).mockResolvedValueOnce(mail).mockResolvedValue({ id: "bk1" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation(async (cb) =>
    cb({
      $executeRaw: mocks.prisma.$executeRaw,
      booking: mocks.prisma.booking,
      bookingEvent: mocks.prisma.bookingEvent,
      chefBlockedDay: mocks.prisma.chefBlockedDay,
    })
  );
  mocks.prisma.booking.findFirst.mockResolvedValue(null);
  mocks.prisma.chefBlockedDay.findUnique.mockResolvedValue(null);
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
});
