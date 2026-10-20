import { describe, expect, it, vi } from "vitest";
import { safeSignInCallback } from "@/lib/signin";

vi.mock("next-auth", () => ({ getServerSession: async () => ({ user: { id: "signed-in" } }) }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Object.assign(new Error("Redirect"), { url }); } }));
import SignInPage from "@/app/signin/page";

const origin = "https://saffron.example";
describe("safe sign-in callbacks", () => {
  it.each([
    "/\\example.org", "/\\\\example.org", "//example.org", "https://example.org/path",
    "https://saffron.example.evil.example/path", "javascript:alert(1)",
    "https://saffron.example//example.org", "/%2Fexample.org", "/%5cexample.org",
    "/\texample.org", "/%09example.org", " /bookings", "https://user:secret@saffron.example/bookings",
  ])("refuses redirect escape: %s", (value) => {
    expect(safeSignInCallback(value, origin)).toBe("/");
  });
  it.each(["/signin", "/api/auth/callback/google", "/a/../signin", "/%73ignin", "/SIGNIN"])("avoids authentication loops: %s", (value) => {
    expect(safeSignInCallback(value, origin)).toBe("/");
  });
  it("keeps local destinations, encoded queries and anchors", () => {
    expect(safeSignInCallback("/bookings?tab=mine", origin)).toBe("/bookings?tab=mine");
    expect(safeSignInCallback("/help#contact", origin)).toBe("/help#contact");
    expect(safeSignInCallback(`${origin}/chefs?q=dal%20rice`, origin)).toBe("/chefs?q=dal%20rice");
    expect(safeSignInCallback(["/settings", "//example.org"], origin)).toBe("/settings");
  });
  it("handles missing or malformed configuration without trusting another origin", () => {
    expect(safeSignInCallback("/settings")).toBe("/settings");
    expect(safeSignInCallback("https://example.org/path")).toBe("/");
    expect(safeSignInCallback("/settings", "not-a-url")).toBe("/");
    expect(safeSignInCallback(undefined, origin)).toBe("/");
  });
  it("blocks the original exploit on the actual signed-in page", async () => {
    await expect(SignInPage({ searchParams: { callbackUrl: "/\\example.org" } })).rejects.toMatchObject({ url: "/" });
  });
});
