import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  prisma: {
    chefProfile: { findUnique: vi.fn() },
    chefBlockedDay: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    booking: { count: vi.fn() },
  },
}));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { DELETE, GET, POST } from "@/app/api/chef/availability/route";
import { istDayKey } from "@/lib/availability";

const DAY = 24 * 60 * 60 * 1000;
const dayFromNow = (n: number) => istDayKey(new Date(Date.now() + n * DAY));

function json(method: string, body: unknown) {
  return new Request("http://localhost/api/chef/availability", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "chef1" } });
  mocks.prisma.chefProfile.findUnique.mockResolvedValue({ id: "prof1" });
  mocks.prisma.chefBlockedDay.findMany.mockResolvedValue([]);
  mocks.prisma.chefBlockedDay.createMany.mockResolvedValue({ count: 1 });
  mocks.prisma.chefBlockedDay.deleteMany.mockResolvedValue({ count: 1 });
  mocks.prisma.booking.count.mockResolvedValue(0);
});

describe("/api/chef/availability", () => {
  it("requires sign-in for every method", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(json("POST", { from: dayFromNow(5) }))).status).toBe(401);
    expect((await DELETE(json("DELETE", { day: dayFromNow(5) }))).status).toBe(401);
  });

  it("blocks a day and returns the updated list", async () => {
    const day = dayFromNow(5);
    mocks.prisma.chefBlockedDay.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ day }]);
    const res = await POST(json("POST", { from: day }));
    expect(res.status).toBe(200);
    expect(mocks.prisma.chefBlockedDay.createMany).toHaveBeenCalledWith({
      data: [{ userId: "chef1", day }],
      skipDuplicates: true,
    });
    expect((await res.json()).days).toEqual([day]);
  });

  it("blocks a range, skipping days that are already blocked", async () => {
    const [a, b, c] = [dayFromNow(5), dayFromNow(6), dayFromNow(7)];
    mocks.prisma.chefBlockedDay.findMany.mockResolvedValueOnce([{ day: b }]).mockResolvedValueOnce([]);
    await POST(json("POST", { from: a, to: c }));
    expect(mocks.prisma.chefBlockedDay.createMany.mock.calls[0][0].data.map((d: { day: string }) => d.day)).toEqual([a, c]);
  });

  it("only lets chefs with a profile block days", async () => {
    mocks.prisma.chefProfile.findUnique.mockResolvedValue(null);
    expect((await POST(json("POST", { from: dayFromNow(5) }))).status).toBe(403);
  });

  it("rejects past days, fake dates and missing input", async () => {
    expect((await POST(json("POST", { from: dayFromNow(-3) }))).status).toBe(400);
    expect((await POST(json("POST", { from: "2030-02-30" }))).status).toBe(400);
    expect((await POST(json("POST", {}))).status).toBe(400);
    expect(mocks.prisma.chefBlockedDay.createMany).not.toHaveBeenCalled();
  });

  it("stops a chef blocking more than 200 days", async () => {
    mocks.prisma.chefBlockedDay.findMany.mockResolvedValue(
      Array.from({ length: 200 }, (_, i) => ({ day: `2031-01-${String(i).padStart(2, "0")}` }))
    );
    const res = await POST(json("POST", { from: dayFromNow(5) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at most 200/);
  });

  it("warns about bookings the chef already accepted in that period", async () => {
    mocks.prisma.booking.count.mockResolvedValue(2);
    const res = await POST(json("POST", { from: dayFromNow(5) }));
    expect((await res.json()).clashes).toBe(2);
    const where = mocks.prisma.booking.count.mock.calls[0][0].where;
    expect(where.status).toBe("ACCEPTED");
    expect(where.chefId).toBe("chef1");
  });

  it("opens a day again, only for the signed-in chef", async () => {
    const day = dayFromNow(5);
    const res = await DELETE(json("DELETE", { day }));
    expect(res.status).toBe(200);
    expect(mocks.prisma.chefBlockedDay.deleteMany).toHaveBeenCalledWith({ where: { userId: "chef1", day } });
  });

  it("rejects a nonsense day when opening", async () => {
    expect((await DELETE(json("DELETE", { day: "nope" }))).status).toBe(400);
  });
});
