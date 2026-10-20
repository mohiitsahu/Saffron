import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), prisma: {
  user: { update: vi.fn() }, chefProfile: { findUnique: vi.fn() },
  report: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
  $executeRaw: vi.fn(), $transaction: vi.fn(),
} }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { PATCH } from "@/app/api/account/route";
import { POST as requestDeletion } from "@/app/api/account/deletion-request/route";
import { POST as contact } from "@/app/api/support/route";

const json = (body: unknown) => new Request("http://localhost/api/test", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "owner", role: "CUSTOMER" } });
  mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
  mocks.prisma.chefProfile.findUnique.mockResolvedValue(null);
  mocks.prisma.report.findFirst.mockResolvedValue(null);
  mocks.prisma.report.count.mockResolvedValue(0);
});

describe("account settings and private requests", () => {
  it("requires authentication for edits, deletion requests and support", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await PATCH(json({ name: "A Person", phone: "" }))).status).toBe(401);
    expect((await requestDeletion(json({ confirmation: "DELETE" }))).status).toBe(401);
    expect((await contact(json({ topic: "support", details: "Please help me sign in." }))).status).toBe(401);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("normalises a phone and only updates the signed-in account", async () => {
    expect((await PATCH(json({ name: "  Test Person  ", phone: "+91 98765-43210" }))).status).toBe(200);
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({ where: { id: "owner" }, data: { name: "Test Person", phone: "9876543210" } });
  });
  it.each([{ role: "ADMIN" }, { id: "someone-else" }, { email: "new@example.com" }])("rejects protected account fields: %j", async (extra) => {
    expect((await PATCH(json({ name: "Test Person", phone: "", ...extra }))).status).toBe(400);
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });
  it("allows customers to remove their optional phone", async () => {
    expect((await PATCH(json({ name: "Test Person", phone: "" }))).status).toBe(200);
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({ where: { id: "owner" }, data: { name: "Test Person", phone: null } });
  });
  it("keeps a chef contact number from being removed", async () => {
    mocks.prisma.chefProfile.findUnique.mockResolvedValue({ id: "chef-profile" });
    const response = await PATCH(json({ name: "Chef Person", phone: "" }));
    expect(response.status).toBe(400);
    expect((await response.json()).fieldErrors.phone).toBeTruthy();
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });
  it.each([{ name: "X", phone: "" }, { name: "Test Person", phone: "123" }, null])("rejects invalid account details", async (body) => {
    expect((await PATCH(json(body))).status).toBe(400);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("requires the exact deletion confirmation", async () => {
    expect((await requestDeletion(json({ confirmation: "delete" }))).status).toBe(400);
    expect(mocks.prisma.report.create).not.toHaveBeenCalled();
  });
  it("routes a deletion request to admins without deleting or modifying the user", async () => {
    expect((await requestDeletion(json({ confirmation: "DELETE" }))).status).toBe(201);
    expect(mocks.prisma.report.create).toHaveBeenCalledWith({ data: expect.objectContaining({ reporterId: "owner", reason: "account_deletion" }) });
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });
  it("deduplicates an open deletion request", async () => {
    mocks.prisma.report.findFirst.mockResolvedValue({ id: "existing" });
    expect((await requestDeletion(json({ confirmation: "DELETE" }))).status).toBe(409);
    expect(mocks.prisma.report.create).not.toHaveBeenCalled();
  });
  it("limits repeated closed deletion requests", async () => {
    mocks.prisma.report.count.mockResolvedValue(3);
    expect((await requestDeletion(json({ confirmation: "DELETE" }))).status).toBe(429);
    expect(mocks.prisma.report.create).not.toHaveBeenCalled();
  });
  it("stores a privacy message under its sender without accepting another user's id", async () => {
    const body = { topic: "privacy", details: "Please explain the data you hold." };
    expect((await contact(json({ ...body, reporterId: "other" }))).status).toBe(400);
    expect((await contact(json(body))).status).toBe(201);
    expect(mocks.prisma.report.create).toHaveBeenCalledWith({ data: { reporterId: "owner", reason: "privacy", details: body.details } });
  });
  it("limits support messages and rejects unsupported topics", async () => {
    expect((await contact(json({ topic: "account_deletion", details: "Please erase my account." }))).status).toBe(400);
    mocks.prisma.report.count.mockResolvedValue(3);
    expect((await contact(json({ topic: "support", details: "Please help with my account." }))).status).toBe(429);
    expect(mocks.prisma.report.create).not.toHaveBeenCalled();
  });
});
