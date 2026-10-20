import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const context = vi.hoisted(() => ({ session: null as AsyncLocalStorage<string> | null }));
vi.mock("@prisma/client", () => {
  if (!process.env.SAFFRON_TEST_CLIENT) throw Error("Use the isolated integration runner.");
  return createRequire(import.meta.url)(process.env.SAFFRON_TEST_CLIENT);
});
vi.mock("next-auth", () => ({ getServerSession: async () => { const id = context.session!.getStore(); return id ? { user: { id, role: id === "gallery-admin" ? "ADMIN" : "CUSTOMER" } } : null; } }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
import { prisma } from "@/lib/prisma";
import { GET as list, POST as upload, PATCH as order } from "@/app/api/chef/meals/route";
import { PATCH as edit, DELETE as remove } from "@/app/api/chef/meals/[id]/route";
import { GET as image } from "@/app/api/meal-photos/[id]/route";
import { DELETE as adminRemove } from "@/app/api/admin/chefs/[id]/meals/[photoId]/route";
context.session = new AsyncLocalStorage<string>();
const asUser = <T>(id: string, work: () => T) => context.session!.run(id, work);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aIVkAAAAASUVORK5CYII=", "base64");
const json = (body: object) => new Request("http://localhost/api/test", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
function fileRequest(name = "Test meal", bytes: Uint8Array = png) {
  const form = new FormData(); form.append("file", new Blob([new Uint8Array(bytes).buffer], { type: "image/png" }), "meal.png"); form.append("dishName", name); form.append("caption", "Cooked for a family dinner.");
  return new Request("http://localhost/api/chef/meals", { method: "POST", body: form });
}
async function chef() { return prisma.chefProfile.create({ data: { displayName: "Test chef", bio: "Meal gallery fixture profile", city: "Bhopal", cuisines: ["indian"], pricePerPerson: 500, photoUrl: "/api/photos/existingportrait", user: { create: { name: "Cook", role: "CHEF" } } } }); }
async function seedPhotos(chefId: string, count: number) { await prisma.mealPhoto.createMany({ data: Array.from({ length: count }, (_, position) => ({ chefId, position, contentType: "image/png", data: png, dishName: `Meal ${position + 1}` })) }); return prisma.mealPhoto.findMany({ where: { chefId }, orderBy: { position: "asc" } }); }
const params = (id: string) => ({ params: { id } });
const photoRequest = (etag?: string) => new Request("http://localhost/api/meal-photos/test", { headers: etag ? { "If-None-Match": etag } : {} });

beforeEach(async () => {
  if (!process.env.DATABASE_URL?.includes("/saffron_test?")) throw Error("Disposable database required.");
  await prisma.report.deleteMany(); await prisma.adminAction.deleteMany(); await prisma.booking.deleteMany(); await prisma.user.deleteMany();
});
afterAll(() => prisma.$disconnect());

describe("meal gallery ownership, limits and moderation", () => {
  it("protects every write/list endpoint from signed-out users", async () => {
    expect((await list()).status).toBe(401); expect((await upload(fileRequest())).status).toBe(401);
    expect((await order(json({ ids: [] }))).status).toBe(401);
    expect((await edit(json({ dishName: "Meal" }), params("unknown"))).status).toBe(401);
    expect((await remove(json({}), params("unknown"))).status).toBe(401);
    expect((await adminRemove(json({ note: "Remove this" }), { params: { id: "chef", photoId: "photo" } })).status).toBe(403);
  });
  it("requires a chef profile and cannot use an arbitrary chef id from the caller", async () => {
    const customer = await prisma.user.create({ data: { name: "Customer" } });
    expect((await asUser(customer.id, () => upload(fileRequest()))).status).toBe(403);
    expect((await asUser(customer.id, () => list())).status).toBe(403);
  });
  it("uploads real image bytes and returns only gallery metadata", async () => {
    const profile = await chef();
    const response = await asUser(profile.userId, () => upload(fileRequest("  Dal makhani  ")));
    expect(response.status).toBe(201); const body = await response.json();
    expect(body.photos).toHaveLength(1); expect(body.photos[0]).toMatchObject({ dishName: "Dal makhani", position: 0 });
    expect(body.photos[0].data).toBeUndefined(); expect(body.photos[0].chefId).toBeUndefined();
    expect(await prisma.chefProfile.findUniqueOrThrow({ where: { id: profile.id } })).toMatchObject({ photoUrl: "/api/photos/existingportrait" });
    const picture = await image(photoRequest(), params(body.photos[0].id));
    expect(picture.status).toBe(200); expect(picture.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await picture.arrayBuffer())).toEqual(png);
  });
  it("enforces the six-photo limit when two uploads compete for the last slot", async () => {
    const profile = await chef(); await seedPhotos(profile.id, 5);
    const replies = await Promise.all(["A", "B"].map((name) => asUser(profile.userId, () => upload(fileRequest(name)))));
    expect(replies.map((reply) => reply.status).sort()).toEqual([201, 409]);
    const rows = await prisma.mealPhoto.findMany({ where: { chefId: profile.id }, orderBy: { position: "asc" } });
    expect(rows.map((row) => row.position)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("rejects spoofed SVG, overlong captions and oversized images", async () => {
    const profile = await chef();
    expect((await asUser(profile.userId, () => upload(fileRequest("Bad", new TextEncoder().encode("<svg onload=alert(1)></svg>"))))).status).toBe(415);
    expect((await asUser(profile.userId, () => upload(fileRequest("X".repeat(81))))).status).toBe(400);
    expect((await asUser(profile.userId, () => upload(fileRequest("Large", new Uint8Array(1_000_001))))).status).toBe(413);
    expect(await prisma.mealPhoto.count()).toBe(0);
  });
  it("only allows owners to edit or delete their own photos", async () => {
    const owner = await chef(); const stranger = await chef(); const [photo] = await seedPhotos(owner.id, 1);
    expect((await asUser(stranger.userId, () => edit(json({ dishName: "Stolen", caption: "" }), params(photo.id)))).status).toBe(404);
    expect((await asUser(stranger.userId, () => remove(json({}), params(photo.id)))).status).toBe(404);
    expect((await asUser(owner.userId, () => edit(json({ dishName: "Paneer tikka", caption: "Smoky and freshly grilled." }), params(photo.id)))).status).toBe(200);
    expect(await prisma.mealPhoto.findUniqueOrThrow({ where: { id: photo.id } })).toMatchObject({ dishName: "Paneer tikka" });
    expect((await asUser(owner.userId, () => edit(json({ chefId: stranger.id }), params(photo.id)))).status).toBe(400);
  });
  it("rejects duplicate, foreign and stale order lists without corrupting positions", async () => {
    const owner = await chef(); const other = await chef(); const rows = await seedPhotos(owner.id, 3); const [foreign] = await seedPhotos(other.id, 1);
    for (const ids of [[rows[0].id, rows[0].id, rows[2].id], [rows[0].id], [rows[0].id, rows[1].id, foreign.id]]) expect((await asUser(owner.userId, () => order(json({ ids })))).status).toBe(409);
    const response = await asUser(owner.userId, () => order(json({ ids: rows.map((row) => row.id).reverse() })));
    expect(response.status).toBe(200); expect((await response.json()).photos.map((photo: { id: string }) => photo.id)).toEqual(rows.map((row) => row.id).reverse());
  });
  it("fills a removed slot without exceeding the allowed position range", async () => {
    const owner = await chef(); const rows = await seedPhotos(owner.id, 6);
    expect((await asUser(owner.userId, () => remove(json({}), params(rows[0].id)))).status).toBe(200);
    expect((await asUser(owner.userId, () => upload(fileRequest("Replacement")))).status).toBe(201);
    expect((await prisma.mealPhoto.findMany({ where: { chefId: owner.id }, orderBy: { position: "asc" } })).map((row) => row.position)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("protects hidden images even when the browser supplies an old ETag", async () => {
    const owner = await chef(); const other = await chef(); const [photo] = await seedPhotos(owner.id, 1);
    const response = await image(photoRequest(), params(photo.id)); const etag = response.headers.get("etag")!;
    expect((await image(photoRequest(etag), params(photo.id))).status).toBe(304);
    await prisma.chefProfile.update({ where: { id: owner.id }, data: { suspended: true, active: false } });
    expect((await image(photoRequest(etag), params(photo.id))).status).toBe(404);
    expect((await asUser(other.userId, () => image(photoRequest(), params(photo.id)))).status).toBe(404);
    expect((await asUser(owner.userId, () => image(photoRequest(), params(photo.id)))).status).toBe(200);
    await prisma.user.create({ data: { id: "gallery-admin", role: "ADMIN" } });
    expect((await asUser("gallery-admin", () => image(photoRequest(), params(photo.id)))).status).toBe(200);
  });
  it("requires an admin note, scopes moderation to the chef, and audits removal", async () => {
    const owner = await chef(); const other = await chef(); const [photo] = await seedPhotos(owner.id, 1);
    await prisma.user.create({ data: { id: "gallery-admin", role: "ADMIN" } });
    const route = { params: { id: owner.id, photoId: photo.id } };
    expect((await asUser(owner.userId, () => adminRemove(json({ note: "Inappropriate photo" }), route))).status).toBe(403);
    expect((await asUser("gallery-admin", () => adminRemove(json({}), route))).status).toBe(400);
    expect((await asUser("gallery-admin", () => adminRemove(json({ note: "Wrong profile target" }), { params: { id: other.id, photoId: photo.id } }))).status).toBe(404);
    expect((await asUser("gallery-admin", () => adminRemove(json({ note: "Removed inappropriate content" }), route))).status).toBe(200);
    expect(await prisma.adminAction.findFirstOrThrow()).toMatchObject({ action: "remove_meal_photo", actorId: "gallery-admin", targetId: owner.id });
    expect((await image(photoRequest(`"${photo.id}"`), params(photo.id))).status).toBe(404);
    expect(await prisma.chefProfile.findUniqueOrThrow({ where: { id: owner.id } })).toMatchObject({ photoUrl: "/api/photos/existingportrait" });
  });
});
