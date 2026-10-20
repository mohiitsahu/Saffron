import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import type { BookingStatus } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({
  session: null as AsyncLocalStorage<string> | null,
}));

// Load the client generated outside the project: importing the app's generated
// client could discover its .env. All route database queries still use Prisma.
vi.mock("@prisma/client", () => {
  if (!process.env.SAFFRON_TEST_CLIENT) {
    throw new Error("Run npm run test:integration to create the temporary database and client.");
  }
  return createRequire(import.meta.url)(process.env.SAFFRON_TEST_CLIENT);
});
vi.mock("next-auth", () => ({
  getServerSession: async () => ({ user: { id: context.session!.getStore(), name: "Test user", role: context.session!.getStore() === "integration-admin" ? "ADMIN" : "CUSTOMER" } }),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/notify", () => ({ notifyBooking: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { POST as requestBooking } from "@/app/api/bookings/route";
import { PATCH as changeBooking } from "@/app/api/bookings/[id]/route";
import { POST as blockDay } from "@/app/api/chef/availability/route";
import { istDayKey } from "@/lib/availability";
import { POST as proposal } from "@/app/api/bookings/[id]/proposal/route";
import { POST as reportProblem } from "@/app/api/reports/route";
import { PATCH as resolveReport } from "@/app/api/admin/reports/[id]/route";
import { POST as saveChef } from "@/app/api/chef/route";
import { discoveryFilter } from "@/lib/discovery";
import { getBookingsFor } from "@/lib/bookings";
import { PATCH as editAccount } from "@/app/api/account/route";
import { POST as deletionRequest } from "@/app/api/account/deletion-request/route";
import { POST as contactSupport } from "@/app/api/support/route";

context.session = new AsyncLocalStorage<string>();
const DAY = 86_400_000;
const eventDate = new Date(Date.now() + 7 * DAY);
const day = istDayKey(eventDate);
const eventInput = new Date(eventDate.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 16);
const asUser = <T>(userId: string, callback: () => T) => context.session!.run(userId, callback);
const json = (body: unknown, method = "POST") => new Request("http://localhost/api/test", {
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

async function chef() {
  return prisma.chefProfile.create({
    data: {
      user: { create: { name: "Test chef", role: "CHEF" } },
      displayName: "Test chef", bio: "Integration test chef profile", city: "Bhopal",
      cuisines: ["indian"], pricePerPerson: 500,
    },
  });
}

async function customer() {
  return (await prisma.user.create({ data: { name: "Test customer" } })).id;
}

function request(customerId: string, chefProfileId: string) {
  return asUser(customerId, () => requestBooking(json({
    chefProfileId, eventDate: eventInput, guests: 4, area: "Arera Colony",
    address: "12 Integration Test Street", phone: "9876543210", notes: "",
  })));
}

function accept(chefId: string, id: string) {
  return asUser(chefId, () => changeBooking(json({ action: "accept" }, "PATCH"), { params: { id } }));
}

function block(chefId: string) {
  return asUser(chefId, () => blockDay(json({ from: day })));
}

function seedBooking(customerId: string, chefId: string, status: BookingStatus = "REQUESTED") {
  return prisma.booking.create({
    data: {
      customerId, chefId, eventDate, guests: 4, city: "Bhopal", area: "Arera Colony",
      address: "12 Integration Test Street", phone: "9876543210", estimatedTotal: 2000, status,
    },
  });
}

async function competeForChef(chefId: string, operations: (() => Promise<Response>)[]) {
  let unlock!: () => void;
  let locked!: () => void;
  const released = new Promise<void>((resolve) => { unlock = resolve; });
  const acquired = new Promise<void>((resolve) => { locked = resolve; });
  const holder = prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${chefId}))`;
    locked();
    await released;
  }, { timeout: 20_000 });
  // Propagate connection failures instead of waiting forever for the signal.
  await Promise.race([acquired, holder]);
  const pending = Promise.allSettled(operations.map((operation) => operation()));
  try {
    await vi.waitFor(async () => {
      const [row] = await prisma.$queryRaw<{ count: number }[]>`
        SELECT count(*)::int AS count FROM pg_locks
        WHERE locktype = 'advisory' AND NOT granted
      `;
      // This isolated database has no other workload. Every competing route
      // must reach an actual PostgreSQL lock wait before the holder releases it.
      expect(row.count).toBe(operations.length);
    }, { timeout: 3_000, interval: 20 });
  } finally {
    unlock();
    await holder;
    await pending;
  }
  return (await pending).map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
}

beforeEach(async () => {
  // The runner supplies a fresh Docker database, never a user-configured URL.
  if (!process.env.SAFFRON_TEST_CLIENT || !process.env.DATABASE_URL?.includes("/saffron_test?")) {
    throw new Error("Integration tests require the temporary database runner.");
  }
  await prisma.report.deleteMany();
  await prisma.adminAction.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(() => prisma.$disconnect());

describe("booking concurrency against PostgreSQL", () => {
  it("allows only one overlapping acceptance and records only its transition", async () => {
    const profile = await chef();
    const bookings = await Promise.all([
      seedBooking(await customer(), profile.userId),
      seedBooking(await customer(), profile.userId),
    ]);
    const responses = await competeForChef(profile.userId, bookings.map((b) => () => accept(profile.userId, b.id)));
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.booking.count({ where: { status: "ACCEPTED" } })).toBe(1);
    expect(await prisma.bookingEvent.count({ where: { toStatus: "ACCEPTED" } })).toBe(1);
  });

  it("enforces the five pending request limit across simultaneous creates", async () => {
    const customerId = await customer();
    const chefs = await Promise.all(Array.from({ length: 6 }, () => chef()));
    const responses = await Promise.all(chefs.map((p) => request(customerId, p.id)));
    expect(responses.map((r) => r.status).sort()).toEqual([201, 201, 201, 201, 201, 429]);
    expect(await prisma.booking.count()).toBe(5);
    expect(await prisma.bookingEvent.count()).toBe(5);
  });

  it("enforces the hourly quota when two creates compete for the last slot", async () => {
    const customerId = await customer();
    const previousChef = await chef();
    for (let i = 0; i < 9; i++) await seedBooking(customerId, previousChef.userId, "DECLINED");
    const chefs = await Promise.all([chef(), chef()]);
    const responses = await Promise.all(chefs.map((p) => request(customerId, p.id)));
    expect(responses.map((r) => r.status).sort()).toEqual([201, 429]);
    expect(await prisma.booking.count()).toBe(10);
  });

  it("keeps one open request per customer and chef under concurrent submits", async () => {
    const profile = await chef();
    const customerId = await customer();
    const responses = await Promise.all([request(customerId, profile.id), request(customerId, profile.id)]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.booking.count()).toBe(1);
    expect(await prisma.bookingEvent.count()).toBe(1);
  });

  it("refuses a new request and acceptance of a pending request after a day is blocked", async () => {
    const profile = await chef();
    const pending = await seedBooking(await customer(), profile.userId);
    expect((await block(profile.userId)).status).toBe(200);
    expect((await request(await customer(), profile.id)).status).toBe(400);
    expect((await accept(profile.userId, pending.id)).status).toBe(409);
    expect(await prisma.booking.count({ where: { status: "ACCEPTED" } })).toBe(0);
  });

  it("serializes day blocking and acceptance, reporting an existing acceptance as a clash", async () => {
    const profile = await chef();
    const pending = await seedBooking(await customer(), profile.userId);
    const [blocked, accepted] = await competeForChef(profile.userId, [
      () => block(profile.userId), () => accept(profile.userId, pending.id),
    ]);
    expect(blocked.status).toBe(200);
    const body = await blocked.json();
    if (accepted.status === 200) {
      expect(body.clashes).toBe(1);
    } else {
      expect(accepted.status).toBe(409);
      expect(body.clashes).toBe(0);
    }
    expect(await prisma.chefBlockedDay.count()).toBe(1);
  });

  it("serializes a day block with booking creation and refuses later requests", async () => {
    const profile = await chef();
    const customerId = await customer();
    const [blocked, created] = await competeForChef(profile.userId, [
      () => block(profile.userId), () => request(customerId, profile.id),
    ]);
    expect(blocked.status).toBe(200);
    // A request committed before the block remains pending; it cannot be accepted.
    expect([201, 400]).toContain(created.status);
    if (created.status === 201) {
      const body = await created.json();
      expect((await accept(profile.userId, body.booking.id)).status).toBe(409);
    }
    expect((await request(await customer(), profile.id)).status).toBe(400);
    expect(await prisma.booking.count({ where: { status: "ACCEPTED" } })).toBe(0);
  });
});

const suggestedInput = new Date(eventDate.getTime() + 2 * DAY + 5.5 * 3_600_000).toISOString().slice(0, 16);
function proposeAs(userId: string, id: string, action: string, extra: object = {}) {
  return asUser(userId, () => proposal(json({ action, ...extra }), { params: { id } }));
}
describe("new booking and moderation workflows", () => {
  it("excludes blocked, busy, and undersized chefs from an actual availability query", async () => {
    const free = await chef(); const blocked = await chef(); const busy = await chef(); const small = await chef();
    await prisma.chefProfile.update({ where: { id: small.id }, data: { maxGuests: 2 } });
    const date = new Date(`${suggestedInput}:00+05:30`);
    await prisma.chefBlockedDay.create({ data: { userId: blocked.userId, day: istDayKey(date) } });
    const occupied = await seedBooking(await customer(), busy.userId, "ACCEPTED");
    await prisma.booking.update({ where: { id: occupied.id }, data: { eventDate: date } });
    const where = discoveryFilter(suggestedInput.slice(0, 10), suggestedInput.slice(11), "4").where;
    expect((await prisma.chefProfile.findMany({ where, select: { id: true } })).map((p) => p.id)).toEqual([free.id]);
    const res = await asUser(await customer(), () => requestBooking(json({ chefProfileId: busy.id, eventDate: suggestedInput,
      guests: 4, area: "Test area", address: "12 Test Street, Bhopal", phone: "9876543210" })));
    expect(res.status).toBe(400);
  });
  it("requires the customer's agreement to a proposed time and preserves privacy until then", async () => {
    const profile = await chef(); const customerId = await customer();
    const booking = await seedBooking(customerId, profile.userId);
    expect((await proposeAs(customerId, booking.id, "propose", { eventDate: suggestedInput })).status).toBe(403);
    expect((await proposeAs(await customer(), booking.id, "propose", { eventDate: suggestedInput })).status).toBe(404);
    const res = await proposeAs(profile.userId, booking.id, "propose", { eventDate: suggestedInput });
    expect(res.status).toBe(200);
    const pending = (await res.json()).booking;
    expect(pending.status).toBe("REQUESTED"); expect(pending.address).toBeNull(); expect(pending.contactPhone).toBeNull();
    expect((await accept(profile.userId, booking.id)).status).toBe(409);
    expect((await proposeAs(customerId, booking.id, "accept", { expectedDate: eventDate.toISOString() })).status).toBe(409);
    const confirmed = await proposeAs(customerId, booking.id, "accept", { expectedDate: pending.proposedEventDate });
    expect(confirmed.status).toBe(200); const view = (await confirmed.json()).booking;
    expect(view.status).toBe("ACCEPTED"); expect(view.eventDate).toBe(pending.proposedEventDate); expect(view.contactRevealed).toBe(true);
    expect(await prisma.bookingEvent.count()).toBe(2);
  });

  it("checks blocked days again when accepting a previously suggested time", async () => {
    const profile = await chef(); const customerId = await customer(); const booking = await seedBooking(customerId, profile.userId);
    const proposed = await proposeAs(profile.userId, booking.id, "propose", { eventDate: suggestedInput });
    const date = (await proposed.json()).booking.proposedEventDate;
    await prisma.chefBlockedDay.create({ data: { userId: profile.userId, day: istDayKey(new Date(date)) } });
    expect((await proposeAs(customerId, booking.id, "accept", { expectedDate: date })).status).toBe(409);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("REQUESTED");
  });

  it("allows only one overlapping acceptance of two outstanding suggestions", async () => {
    const profile = await chef(); const a = await customer(); const b = await customer();
    const first = await seedBooking(a, profile.userId); const second = await seedBooking(b, profile.userId);
    const r1 = await proposeAs(profile.userId, first.id, "propose", { eventDate: suggestedInput });
    const r2 = await proposeAs(profile.userId, second.id, "propose", { eventDate: suggestedInput });
    const expectedDate = (await r1.json()).booking.proposedEventDate;
    expect(r2.status).toBe(200);
    const responses = await competeForChef(profile.userId, [
      () => proposeAs(a, first.id, "accept", { expectedDate }), () => proposeAs(b, second.id, "accept", { expectedDate }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("rejects stale proposal answers and allows withdrawal or decline", async () => {
    const profile = await chef(); const customerId = await customer(); const booking = await seedBooking(customerId, profile.userId);
    const first = await proposeAs(profile.userId, booking.id, "propose", { eventDate: suggestedInput });
    const oldDate = (await first.json()).booking.proposedEventDate;
    const laterTime = new Date(eventDate.getTime() + 2 * DAY + 3_600_000 + 5.5 * 3_600_000).toISOString().slice(0, 16);
    const next = await proposeAs(profile.userId, booking.id, "propose", { eventDate: laterTime });
    const nextDate = (await next.json()).booking.proposedEventDate;
    expect((await proposeAs(customerId, booking.id, "accept", { expectedDate: oldDate })).status).toBe(409);
    expect((await proposeAs(profile.userId, booking.id, "withdraw", { expectedDate: nextDate })).status).toBe(200);
    const third = await proposeAs(profile.userId, booking.id, "propose", { eventDate: suggestedInput });
    const thirdDate = (await third.json()).booking.proposedEventDate;
    expect((await proposeAs(customerId, booking.id, "decline", { expectedDate: thirdDate })).status).toBe(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("DECLINED");
  });

  it("handles reports with admin-only resolution and prevents a moderated chef from reactivating", async () => {
    const profile = await chef(); const customerId = await customer(); const stranger = await customer();
    const booking = await seedBooking(customerId, profile.userId);
    const body = { targetType: "booking", targetId: booking.id, reason: "conduct", details: "Please review this test booking concern." };
    expect((await asUser(stranger, () => reportProblem(json(body)))).status).toBe(404);
    expect((await asUser(customerId, () => reportProblem(json(body)))).status).toBe(201);
    expect((await asUser(customerId, () => reportProblem(json(body)))).status).toBe(409);
    const report = await prisma.report.findFirstOrThrow();
    const resolve = () => resolveReport(json({ action: "hide_profile", note: "Reviewed the reported conduct." }, "PATCH"), { params: { id: report.id } });
    expect((await asUser(customerId, resolve)).status).toBe(403);
    await prisma.user.create({ data: { id: "integration-admin", name: "Admin", role: "ADMIN" } });
    expect((await asUser("integration-admin", resolve)).status).toBe(200);
    expect(await prisma.adminAction.count()).toBe(1);
    const save = await asUser(profile.userId, () => saveChef(json({ displayName: "Test chef", bio: "This is a test profile with a long enough biography.", city: "Bhopal", cuisines: ["indian"], pricePerPerson: 500, maxGuests: 10, yearsExperience: 5, phone: "9876543210", active: true })));
    expect(save.status).toBe(200);
    expect(await prisma.chefProfile.findUniqueOrThrow({ where: { id: profile.id } })).toMatchObject({ active: false, suspended: true });
    expect(await prisma.chefProfile.count({ where: discoveryFilter("", "", "4").where })).toBe(0);
    expect((await request(stranger, profile.id)).status).toBe(404);
    expect((await accept(profile.userId, booking.id)).status).toBe(409);
  });
  it("serializes duplicate deletion requests and lets only an admin review them", async () => {
    const owner = await customer();
    const answers = await Promise.all(Array.from({ length: 4 }, () => asUser(owner, () => deletionRequest(json({ confirmation: "DELETE" })))));
    expect(answers.map((answer) => answer.status).sort()).toEqual([201, 409, 409, 409]);
    expect(await prisma.report.count({ where: { reporterId: owner, reason: "account_deletion" } })).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: owner } })).not.toBeNull();
    const report = await prisma.report.findFirstOrThrow();
    const review = (action: string) => resolveReport(json({ action, note: "Your request is under review; we will explain the next steps." }, "PATCH"), { params: { id: report.id } });
    expect((await asUser(owner, () => review("resolve"))).status).toBe(403);
    await prisma.user.create({ data: { id: "integration-admin", name: "Admin", role: "ADMIN" } });
    expect((await asUser("integration-admin", () => review("hide_profile"))).status).toBe(400);
    expect((await asUser("integration-admin", () => review("resolve"))).status).toBe(200);
    expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toMatchObject({ status: "RESOLVED", resolvedById: "integration-admin" });
    expect(await prisma.user.findUnique({ where: { id: owner } })).not.toBeNull();
  });

  it("enforces the support quota under concurrent submissions", async () => {
    const owner = await customer();
    const responses = await Promise.all(Array.from({ length: 5 }, () => asUser(owner, () => contactSupport(json({ topic: "support", details: "I need some help with my account." })))));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 201, 201, 429, 429]);
    expect(await prisma.report.count({ where: { reporterId: owner, reason: "support" } })).toBe(3);
  });

  it("saves account details without changing roles or another person's record", async () => {
    const owner = await customer(); const stranger = await customer();
    expect((await asUser(owner, () => editAccount(json({ name: "Updated Name", phone: "+91 98765-43210" }, "PATCH")))).status).toBe(200);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: owner } })).toMatchObject({ name: "Updated Name", phone: "9876543210", role: "CUSTOMER" });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: stranger } })).toMatchObject({ name: "Test customer", phone: null });
    const profile = await chef();
    expect((await asUser(profile.userId, () => editAccount(json({ name: "Chef Person", phone: "" }, "PATCH")))).status).toBe(400);
  });

  it("rechecks a reduced guest limit before accepting and preserves the pending request", async () => {
    const profile = await chef(); const customerId = await customer();
    const booking = await seedBooking(customerId, profile.userId);
    await prisma.chefProfile.update({ where: { id: profile.id }, data: { maxGuests: 2 } });
    const response = await accept(profile.userId, booking.id);
    expect(response.status).toBe(409);
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: "REQUESTED", version: 0 });
    expect(await prisma.bookingEvent.count({ where: { bookingId: booking.id } })).toBe(0);
    await prisma.chefProfile.update({ where: { id: profile.id }, data: { maxGuests: booking.guests } });
    expect((await accept(profile.userId, booking.id)).status).toBe(200);
  });

  it("keeps a meal ready to complete visible behind more than 100 later meals", async () => {
    const profile = await chef(); const now = Date.now();
    const customers = Array.from({ length: 101 }, (_, index) => ({ id: "backlog-customer-" + index, name: "Customer" }));
    await prisma.user.createMany({ data: customers });
    await prisma.booking.createMany({ data: customers.map((person, index) => ({
      id: "backlog-booking-" + index, customerId: person.id, chefId: profile.userId,
      eventDate: new Date(now + (index === 100 ? -0.25 : index + 1) * DAY), status: "ACCEPTED", guests: 2,
      city: "Bhopal", area: "Test area", address: "Test address", phone: "9876543210", estimatedTotal: 1000,
    })) });
    const bookings = await getBookingsFor(profile.userId);
    expect(bookings.asChef).toHaveLength(101);
    expect(bookings.asChef.find((booking) => booking.id === "backlog-booking-100")).toMatchObject({ status: "ACCEPTED", eventPassed: true });
    expect(bookings.asCustomer).toHaveLength(0);
    const response = await asUser(profile.userId, () => changeBooking(json({ action: "complete" }, "PATCH"), { params: { id: "backlog-booking-100" } }));
    expect(response.status).toBe(200);
  });

  it("keeps unreviewed completed meals visible beyond the history window", async () => {
    const profile = await chef(); const customerId = await customer(); const now = Date.now();
    await prisma.booking.createMany({ data: Array.from({ length: 100 }, (_, index) => ({
      customerId, chefId: profile.userId, eventDate: new Date(now - (index + 1) * DAY), status: "DECLINED", guests: 2,
      city: "Bhopal", area: "Test area", address: "Test address", phone: "9876543210", estimatedTotal: 1000,
    })) });
    const needsReview = await prisma.booking.create({ data: {
      customerId, chefId: profile.userId, eventDate: new Date(now - 200 * DAY), status: "COMPLETED", guests: 2,
      city: "Bhopal", area: "Test area", address: "Test address", phone: "9876543210", estimatedTotal: 1000,
    } });
    const bookings = await getBookingsFor(customerId);
    expect(bookings.asCustomer).toHaveLength(101);
    expect(bookings.asCustomer.find((booking) => booking.id === needsReview.id)).toMatchObject({ status: "COMPLETED", reviewRating: null });
  });

  it("preserves a time suggestion when the post-commit email lookup fails", async () => {
    const profile = await chef(); const customerId = await customer(); const booking = await seedBooking(customerId, profile.userId);
    const originalLookup = prisma.booking.findUnique.bind(prisma.booking);
    const lookup = vi.spyOn(prisma.booking, "findUnique").mockImplementationOnce(originalLookup).mockRejectedValueOnce(new Error("Email preparation unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await proposeAs(profile.userId, booking.id, "propose", { eventDate: suggestedInput });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.booking.proposedEventDate).toBeTruthy();
      expect(body.booking.contactPhone).toBeNull();
      expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: "REQUESTED", version: 1 });
      expect(await prisma.bookingEvent.count({ where: { bookingId: booking.id, kind: "time_propose" } })).toBe(1);
    } finally { lookup.mockRestore(); log.mockRestore(); }
  });

});
