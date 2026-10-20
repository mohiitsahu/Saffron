import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const context = vi.hoisted(() => ({ session: null as AsyncLocalStorage<string> | null }));
vi.mock("@prisma/client", () => {
  if (!process.env.SAFFRON_TEST_CLIENT) throw Error("Use the isolated integration runner.");
  return createRequire(import.meta.url)(process.env.SAFFRON_TEST_CLIENT);
});
vi.mock("next-auth", () => ({ getServerSession: async () => { const id = context.session!.getStore(); return id ? { user: { id } } : null; } }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
import { prisma } from "@/lib/prisma";
import { PUT as save } from "@/app/api/chef/route";
context.session = new AsyncLocalStorage<string>();
const asUser = <T>(id: string, work: () => T) => context.session!.run(id, work);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aIVkAAAAASUVORK5CYII=", "base64");
const details = { displayName: "Test Chef", bio: "A chef cooking family dinners and celebrations.", city: "Bhopal", cuisines: ["indian"], pricePerPerson: 500, maxGuests: 10, yearsExperience: 5, phone: "9876543210", photoUrl: "", sampleMenu: "Dal", active: true };
function multipart(body = details, bytes: Uint8Array = png) {
  const form = new FormData(); form.append("profile", JSON.stringify(body)); form.append("file", new Blob([new Uint8Array(bytes).buffer]), "portrait.png");
  return new Request("http://localhost/api/chef", { method: "PUT", body: form });
}
const json = (body: object) => new Request("http://localhost/api/chef", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
async function seed() {
  const user = await prisma.user.create({ data: { name: "Chef", phone: details.phone, role: "CHEF" } });
  const old = await prisma.chefPhoto.create({ data: { userId: user.id, data: png, contentType: "image/png" } });
  const { phone: _phone, ...profile } = details; void _phone;
  await prisma.chefProfile.create({ data: { ...profile, userId: user.id, photoUrl: `/api/photos/${old.id}` } });
  return { user, old };
}
beforeEach(async () => {
  if (!process.env.DATABASE_URL?.includes("/saffron_test?")) throw Error("Disposable database required.");
  await prisma.report.deleteMany(); await prisma.adminAction.deleteMany(); await prisma.booking.deleteMany(); await prisma.user.deleteMany();
});
afterAll(() => prisma.$disconnect());
describe("portrait drafts committed with the profile", () => {
  it("requires authentication before processing a draft", async () => { expect((await save(multipart())).status).toBe(401); expect(await prisma.chefPhoto.count()).toBe(0); });
  it("replaces the old portrait and saves profile details together", async () => {
    const { user, old } = await seed();
    const response = await asUser(user.id, () => save(multipart({ ...details, city: "Indore" })));
    expect(response.status).toBe(200);
    const profile = await prisma.chefProfile.findUniqueOrThrow({ where: { userId: user.id } });
    const photo = await prisma.chefPhoto.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.city).toBe("Indore"); expect(profile.photoUrl).toBe(`/api/photos/${photo.id}`); expect(photo.id).not.toBe(old.id); expect(Buffer.from(photo.data)).toEqual(png);
    expect(await prisma.chefPhoto.findUnique({ where: { id: old.id } })).toBeNull();
  });
  it("leaves the saved photo intact when profile validation fails", async () => {
    const { user, old } = await seed();
    expect((await asUser(user.id, () => save(multipart({ ...details, displayName: "X" })))).status).toBe(400);
    expect((await prisma.chefPhoto.findUniqueOrThrow({ where: { userId: user.id } })).id).toBe(old.id);
  });
  it("rejects invalid image bytes without deleting the saved photo", async () => {
    const { user, old } = await seed();
    expect((await asUser(user.id, () => save(multipart(details, new TextEncoder().encode("not a photo"))))).status).toBe(415);
    expect((await prisma.chefPhoto.findUniqueOrThrow({ where: { userId: user.id } })).id).toBe(old.id);
    expect((await asUser(user.id, () => save(multipart(details, new Uint8Array(1_000_001))))).status).toBe(413);
  });
  it("only deletes the portrait when the profile removal is saved", async () => {
    const { user, old } = await seed();
    expect((await asUser(user.id, () => save(json(details)))).status).toBe(200);
    expect(await prisma.chefPhoto.findUnique({ where: { id: old.id } })).toBeNull();
    expect((await prisma.chefProfile.findUniqueOrThrow({ where: { userId: user.id } })).photoUrl).toBeNull();
  });
  it("rejects another user's portrait URL", async () => {
    const first = await seed(); const second = await seed();
    expect((await asUser(second.user.id, () => save(json({ ...details, photoUrl: `/api/photos/${first.old.id}` })))).status).toBe(400);
    expect((await prisma.chefPhoto.findUniqueOrThrow({ where: { userId: second.user.id } })).id).toBe(second.old.id);
  });
  it("rolls back portrait replacement if the profile write fails", async () => {
    const { user, old } = await seed();
    await prisma.$executeRawUnsafe('CREATE FUNCTION reject_portrait_profile_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'intentional test failure\'; END; $$');
    await prisma.$executeRawUnsafe('CREATE TRIGGER portrait_rollback_test BEFORE UPDATE ON "ChefProfile" FOR EACH ROW EXECUTE FUNCTION reject_portrait_profile_write()');
    try { await expect(asUser(user.id, () => save(multipart()))).rejects.toThrow(); }
    finally { await prisma.$executeRawUnsafe('DROP TRIGGER portrait_rollback_test ON "ChefProfile"'); await prisma.$executeRawUnsafe('DROP FUNCTION reject_portrait_profile_write()'); }
    expect((await prisma.chefPhoto.findUniqueOrThrow({ where: { userId: user.id } })).id).toBe(old.id);
    expect((await prisma.chefProfile.findUniqueOrThrow({ where: { userId: user.id } })).photoUrl).toBe(`/api/photos/${old.id}`);
  });
});
