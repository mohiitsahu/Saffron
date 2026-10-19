import { beforeEach, describe, expect, it, vi } from "vitest";

// The booking API is tested without a database or a real login.
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  prisma: {
    chefProfile: { findUnique: vi.fn() },
    booking: { count: vi.fn(), findFirst: vi.fn() },
    chefBlockedDay: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  settle: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/notify", () => ({ notifyBooking: mocks.notify }));
vi.mock("@/lib/bookings", () => ({
  bookingSelect: {},
  getBookingsFor: vi.fn(),
  serializeBooking: (b: unknown) => b,
  settleStaleBookings: mocks.settle,
}));

import { POST } from "@/app/api/bookings/route";
import { istDayKey } from "@/lib/availability";

const DAY = 24 * 60 * 60 * 1000;

// The form sends a "datetime-local" value, which the server reads as IST.
function istInput(timestamp: number) {
  const ist = new Date(timestamp + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 16);
}

function request(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chefProfileId: "prof1",
      eventDate: istInput(Date.now() + 3 * DAY),
      guests: 4,
      area: "Arera Colony",
      address: "12 Example Street, Bhopal",
      phone: "9876543210",
      notes: "",
      ...overrides,
    }),
  });
}

async function call(overrides?: Record<string, unknown>) {
  const res = await POST(request(overrides));
  return { status: res.status, body: await res.json() };
}

function chefProfile(overrides: Record<string, unknown> = {}) {
  return {
    userId: "chef1",
    displayName: "Chef Asha",
    city: "Bhopal",
    active: true,
    maxGuests: 10,
    pricePerPerson: 500,
    user: { name: "Asha Verma", email: "asha@example.com" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({
    user: { id: "cust1", role: "CUSTOMER", name: "Rohan Customer", email: "rohan@example.com" },
  });
  mocks.prisma.chefProfile.findUnique.mockResolvedValue(chefProfile());
  mocks.prisma.chefBlockedDay.findUnique.mockResolvedValue(null);
  // First count = open requests, second = requests in the last hour.
  mocks.prisma.booking.count.mockResolvedValue(0);
  mocks.prisma.booking.findFirst.mockResolvedValue(null);
  mocks.prisma.$transaction.mockImplementation(async (callback) =>
    callback({
      booking: { create: vi.fn().mockResolvedValue({ id: "new1" }) },
      bookingEvent: { create: vi.fn() },
    })
  );
});

describe("POST /api/bookings", () => {
  it("requires a signed-in user", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it("creates a booking and works out the price on the server", async () => {
    const { status } = await call({ guests: 4, estimatedTotal: 1 }); // a fake total is ignored
    expect(status).toBe(201);
  });

  it("expires old requests before checking limits and existing bookings", async () => {
    await call();
    expect(mocks.settle).toHaveBeenCalledWith({ customerId: "cust1" });
  });

  it("emails the chef about the new request, without the customer's address or phone", async () => {
    await call();
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    const [kind, details] = mocks.notify.mock.calls[0];
    expect(kind).toBe("requested");
    expect(details.chef.email).toBe("asha@example.com");
    expect(details.estimatedTotal).toBe(2000);
    expect(JSON.stringify(details)).not.toContain("12 Example Street");
    expect(JSON.stringify(details)).not.toContain("9876543210");
  });

  it("sends no email when the request is refused", async () => {
    await call({ guests: 11 });
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("refuses a day the chef marked unavailable", async () => {
    mocks.prisma.chefBlockedDay.findUnique.mockResolvedValue({ id: "blk1" });
    const { status, body } = await call();
    expect(status).toBe(400);
    expect(body.fieldErrors.eventDate).toMatch(/isn't available/);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("checks the right Indian day for the chef's days off", async () => {
    // 00:30 IST is still that same day in India, even though it is the evening before in UTC.
    const day = istDayKey(new Date(Date.now() + 3 * DAY));
    await call({ eventDate: `${day}T00:30` });
    const lookup = mocks.prisma.chefBlockedDay.findUnique.mock.calls[0][0];
    expect(lookup.where.userId_day).toEqual({ userId: "chef1", day });
  });

  it("rejects an impossible date", async () => {
    const { status, body } = await call({ eventDate: "2030-02-30T19:00" });
    expect(status).toBe(400);
    expect(body.fieldErrors.eventDate).toMatch(/doesn't exist/);
  });

  it("needs 24 hours notice", async () => {
    const { status, body } = await call({ eventDate: istInput(Date.now() + 2 * 60 * 60 * 1000) });
    expect(status).toBe(400);
    expect(body.fieldErrors.eventDate).toMatch(/24 hours/);
  });

  it("refuses dates more than a year away", async () => {
    const { status, body } = await call({ eventDate: istInput(Date.now() + 400 * DAY) });
    expect(status).toBe(400);
    expect(body.fieldErrors.eventDate).toMatch(/within the next year/);
  });

  it("refuses more guests than the chef cooks for", async () => {
    const { status, body } = await call({ guests: 11 });
    expect(status).toBe(400);
    expect(body.fieldErrors.guests).toMatch(/up to 10/);
  });

  it("stops a customer with 5 requests already waiting", async () => {
    mocks.prisma.booking.count.mockResolvedValueOnce(5);
    const { status, body } = await call();
    expect(status).toBe(429);
    expect(body.error).toMatch(/5 requests waiting/);
  });

  it("stops a customer sending more than 10 requests in an hour", async () => {
    mocks.prisma.booking.count.mockResolvedValueOnce(0).mockResolvedValueOnce(10);
    expect((await call()).status).toBe(429);
  });

  it("blocks a second open request to the same chef", async () => {
    mocks.prisma.booking.findFirst.mockResolvedValue({ status: "REQUESTED" });
    expect((await call()).status).toBe(409);
  });

  it("does not let a chef book their own profile", async () => {
    mocks.session.mockResolvedValue({ user: { id: "chef1", role: "CHEF" } });
    expect((await call()).status).toBe(400);
  });

  it("hides chefs who are not taking requests", async () => {
    mocks.prisma.chefProfile.findUnique.mockResolvedValue(chefProfile({ active: false }));
    expect((await call()).status).toBe(404);
  });
});
