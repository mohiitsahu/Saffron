import { describe, expect, it } from "vitest";
import { readMealUpload } from "@/lib/mealUpload";
describe("bounded meal uploads", () => {
  it("limits the actual stream even when the declared size is false", async () => {
    const req = new Request("http://localhost/upload", { method: "POST", headers: { "Content-Length": "1", "Content-Type": "multipart/form-data; boundary=test" }, body: new Uint8Array(1_065_537) });
    expect(await readMealUpload(req)).toMatchObject({ status: 413 });
  });
  it("rejects oversized declared bodies before reading", async () => {
    const req = new Request("http://localhost/upload", { method: "POST", headers: { "Content-Length": "5000000" }, body: "x" });
    expect(await readMealUpload(req)).toMatchObject({ status: 413 });
  });
  it("rejects invalid sizes and malformed multipart requests", async () => {
    expect(await readMealUpload(new Request("http://localhost/upload", { method: "POST", headers: { "Content-Length": "-1" }, body: "x" }))).toMatchObject({ status: 400 });
    expect(await readMealUpload(new Request("http://localhost/upload", { method: "POST", body: "not an image" }))).toMatchObject({ status: 400 });
  });
});
