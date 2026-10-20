import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), notify: vi.fn(),
  prisma: {
    booking: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
    bookingEvent: { create: vi.fn() },
    $executeRaw: vi.fn(), $transaction: vi.fn(),
  },
}));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/notify", () => ({ notifyBooking: mocks.notify }));
vi.mock("@/lib/bookings", () => ({ bookingSelect: {}, serializeBooking: (b: unknown) => b }));

import { POST } from "@/app/api/bookings/[id]/proposal/route";

const original = new Date(Date.now() + 3 * 86_400_000);
const proposed = new Date(Date.now() + 4 * 86_400_000);
const booking = {
  id: "bk1", chefId: "chef1", customerId: "cust1", status: "REQUESTED", version: 0,
  eventDate: original, proposedEventDate: proposed,
};

function act(action: "decline" | "withdraw", expectedDate = proposed.toISOString()) {
  return POST(new Request("http://localhost/api/bookings/bk1/proposal", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, expectedDate }),
  }), { params: { id: "bk1" } });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "cust1" } });
  mocks.prisma.booking.findUnique.mockResolvedValueOnce(booking).mockResolvedValue({
    eventDate: original, proposedEventDate: null, guests: 2, area: "Arera", estimatedTotal: 1000,
    customer: { name: "Customer", email: "customer@example.com" },
    chef: { name: "Chef", email: "chef@example.com", chefProfile: null },
  });
  mocks.prisma.booking.findUniqueOrThrow.mockResolvedValueOnce(booking).mockResolvedValue({
    ...booking, proposedEventDate: null, version: 1,
  });
  mocks.prisma.booking.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
});

describe("booking time proposal responses", () => {
  it.each(["P2028", "P2034", "P2024"])("returns 503 for temporary transaction error %s", async (code) => {
    mocks.prisma.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Temporary failure", { code, clientVersion: "test" }));
    const response = await act("decline");
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("Refresh My bookings");
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("returns 404 when the booking disappears before the locked read", async () => {
    mocks.prisma.booking.findUniqueOrThrow.mockReset().mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Missing", { code: "P2025", clientVersion: "test" }));
    expect((await act("decline")).status).toBe(404);
    expect(mocks.prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it.each([
    ["decline", "cust1", "proposalDeclined"],
    ["withdraw", "chef1", "proposalWithdrawn"],
  ] as const)("notifies after %s using the cleared proposal's time", async (action, userId, kind) => {
    mocks.session.mockResolvedValue({ user: { id: userId } });
    expect((await act(action)).status).toBe(200);
    expect(mocks.notify).toHaveBeenCalledOnce();
    expect(mocks.notify).toHaveBeenCalledWith(kind, expect.objectContaining({ eventDate: proposed }));
    expect(mocks.prisma.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: action === "decline" ? "DECLINED" : "REQUESTED", proposedEventDate: null }),
    }));
  });

  it("does not notify about a stale proposal", async () => {
    expect((await act("decline", original.toISOString())).status).toBe(409);
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it("keeps the committed response when the notifier fails", async () => {
    mocks.notify.mockRejectedValueOnce(new Error("offline"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect((await act("decline")).status).toBe(200); }
    finally { log.mockRestore(); }
    expect(mocks.prisma.bookingEvent.create).toHaveBeenCalledOnce();
  });
});
