import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationCopy, notificationScope } from "@/lib/notifications";

const mocks = vi.hoisted(() => ({ session: vi.fn(), update: vi.fn(), transaction: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { updateMany: mocks.update }, $transaction: mocks.transaction } }));
import { GET, PATCH } from "@/app/api/notifications/route";
const mark = (body: unknown) => PATCH(new Request("http://localhost/api/notifications", { method: "PATCH", body: JSON.stringify(body) }));

beforeEach(() => { vi.resetAllMocks(); });

describe("notification access and validation", () => {
  it("requires sign-in for both reading and marking updates", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await mark({})).status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([{}, { through: "invalid" }, { through: new Date(Date.now() + 86_400_000).toISOString() }])("rejects invalid/future read boundaries: %j", async (body) => {
    mocks.session.mockResolvedValue({ user: { id: "u1" } });
    expect((await mark(body)).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("scopes events to a booking party and excludes their own actions", () => {
    expect(notificationScope("u1")).toMatchObject({
      booking: { OR: [{ customerId: "u1" }, { chefId: "u1" }] },
      OR: [{ actorId: null }, { actorId: { not: "u1" } }],
    });
  });
});

describe("notification messages", () => {
  it.each([
    ["time_propose", "REQUESTED", "A new time to review"],
    ["time_accept", "ACCEPTED", "Suggested time accepted"],
    ["time_decline", "DECLINED", "Suggested time declined"],
    ["time_withdraw", "REQUESTED", "Suggested time withdrawn"],
    [null, "REQUESTED", "New booking request"],
    [null, "ACCEPTED", "Your booking is accepted"],
    [null, "DECLINED", "Booking request declined"],
    [null, "CANCELLED", "Booking cancelled"],
    [null, "COMPLETED", "How was your meal?"],
    [null, "EXPIRED", "Booking request expired"],
  ])("describes %s / %s", (kind, status, title) => {
    expect(notificationCopy(kind, status!, "Asha").title).toBe(title);
  });
});
