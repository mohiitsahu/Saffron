import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationCopy, notificationScope } from "@/lib/notifications";

const mocks = vi.hoisted(() => ({ session: vi.fn(), update: vi.fn(), transaction: vi.fn(), events: vi.fn(), event: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { notificationRead: { createMany: mocks.update }, bookingEvent: { findFirst: mocks.event, findMany: mocks.events }, $transaction: mocks.transaction } }));
import { GET, PATCH } from "@/app/api/notifications/route";
const mark = (body: unknown) => PATCH(new Request("http://localhost/api/notifications", { method: "PATCH", body: JSON.stringify(body) }));

beforeEach(() => { vi.resetAllMocks(); });

describe("notification access and validation", () => {
  it("requires sign-in for both reading and marking updates", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/notifications"))).status).toBe(401);
    expect((await mark({})).status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([{}, { ids: [] }, { ids: [""] }, { ids: Array(31).fill("event1") }, { through: new Date().toISOString() }])("rejects invalid acknowledgement lists: %j", async (body) => {
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
  it("checks only unread existence for the background dot, without loading the inbox", async () => {
    mocks.session.mockResolvedValue({ user: { id: "u1" } });
    mocks.event.mockResolvedValue({ id: "event1" });
    const response = await GET(new Request("http://localhost/api/notifications?summary=1"));
    expect(await response.json()).toEqual({ hasUnread: true });
    expect(mocks.event).toHaveBeenCalledWith(expect.objectContaining({
      select: { id: true }, where: expect.objectContaining({ reads: { none: { userId: "u1" } } }),
    }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("only acknowledges authorised event IDs and makes retries idempotent", async () => {
    mocks.session.mockResolvedValue({ user: { id: "u1" } });
    mocks.events.mockResolvedValue([{ id: "owned" }]);
    expect((await mark({ ids: ["owned", "foreign"] })).status).toBe(200);
    expect(mocks.events).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      id: { in: ["owned", "foreign"] }, booking: { OR: [{ customerId: "u1" }, { chefId: "u1" }] },
    }) }));
    expect(mocks.update).toHaveBeenCalledWith({ data: [{ userId: "u1", eventId: "owned" }], skipDuplicates: true });
  });
});

describe("notification messages", () => {
  it.each([true, false])("uses the right recipient action for automatic completion (customer: %s)", (customer) => {
    const copy = notificationCopy(null, "COMPLETED", "Other person", { customer, system: true });
    expect(copy.message).toContain("automatically marked completed");
    expect(copy.message).not.toContain("Other person marked");
    if (customer) expect(copy.message).toContain("You can now leave a review");
    else { expect(copy.title).toBe("Booking completed"); expect(copy.message).toContain("The customer can now leave a review"); }
  });
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
