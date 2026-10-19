import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildBookingEmail, escapeHtml, type BookingEmailData, type BookingEmailKind } from "@/lib/emailTemplates";
import { sendEmail } from "@/lib/email";
import { notifyBooking, type NotifyBooking } from "@/lib/notify";

const base: BookingEmailData = {
  kind: "requested",
  recipientName: "Asha",
  chefName: "Chef Asha",
  customerName: "Rohan",
  eventDate: new Date("2030-11-02T14:00:00Z"), // 19:30 IST
  guests: 4,
  area: "Arera Colony",
  total: 2000,
  siteUrl: "https://saffron.example",
};

const KINDS: BookingEmailKind[] = [
  "requested",
  "accepted",
  "declined",
  "cancelledByCustomer",
  "cancelledByChef",
  "completed",
];

describe("buildBookingEmail", () => {
  it.each(KINDS)("builds a complete %s email", (kind) => {
    const mail = buildBookingEmail({ ...base, kind });
    expect(mail.subject.length).toBeGreaterThan(5);
    expect(mail.text).toContain("Hi Asha");
    expect(mail.text).toContain("https://saffron.example/");
    expect(mail.html).toContain("https://saffron.example/");
    expect(mail.text).toContain("Saffron never holds or moves your money");
  });

  it("shows the date in Indian time and the total in rupees", () => {
    const mail = buildBookingEmail(base);
    expect(mail.text).toMatch(/7:30\s*pm/i);
    expect(mail.text).toContain("₹2,000");
  });

  it("tells the chef about a request and links to My bookings", () => {
    const mail = buildBookingEmail({ ...base, kind: "requested" });
    expect(mail.subject).toMatch(/New booking request/);
    expect(mail.text).toContain("https://saffron.example/bookings");
    expect(mail.text).toContain("Area: Arera Colony");
  });

  it("invites a review after completion", () => {
    const mail = buildBookingEmail({ ...base, kind: "completed" });
    expect(mail.text).toContain("https://saffron.example/bookings?tab=mine");
    expect(mail.subject).toMatch(/How was your meal/);
  });

  it("sends a declined customer to find another chef", () => {
    expect(buildBookingEmail({ ...base, kind: "declined" }).text).toContain("https://saffron.example/chefs");
  });

  it("escapes names so they cannot inject HTML", () => {
    const mail = buildBookingEmail({
      ...base,
      recipientName: "<script>alert(1)</script>",
      customerName: `"><img src=x onerror=alert(1)>`,
      area: "<b>Arera</b>",
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).not.toContain("<b>Arera</b>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("escapeHtml handles every special character", () => {
    expect(escapeHtml(`<a href="x" title='y'>&`)).toBe("&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;");
  });
});

describe("sendEmail", () => {
  const message = { to: "a@example.com", subject: "Hi", text: "Hello", html: "<p>Hello</p>" };

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does nothing and does not fail when email is not set up", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(sendEmail(message)).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends through Resend with the key and sender", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    vi.stubEnv("EMAIL_FROM", "Saffron <hello@saffron.example>");
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);

    await expect(sendEmail(message)).resolves.toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test_123");
    const body = JSON.parse(init.body);
    expect(body.from).toBe("Saffron <hello@saffron.example>");
    expect(body.to).toEqual(["a@example.com"]);
    expect(body.subject).toBe("Hi");
  });

  it("returns false instead of throwing when the service rejects the email", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "no" }));
    await expect(sendEmail(message)).resolves.toBe(false);
  });

  it("returns false instead of throwing when the network fails", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(sendEmail(message)).resolves.toBe(false);
  });
});

describe("notifyBooking", () => {
  const booking: NotifyBooking = {
    eventDate: new Date("2030-11-02T14:00:00Z"),
    guests: 4,
    area: "Arera Colony",
    estimatedTotal: 2000,
    customer: { name: "Rohan Customer", email: "rohan@example.com" },
    chef: { name: "Asha Verma", email: "asha@example.com", chefProfile: { displayName: "Chef Asha" } },
  };

  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    vi.stubEnv("NEXTAUTH_URL", "https://saffron.example/");
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const sentTo = () => JSON.parse(fetchSpy.mock.calls[0][1].body).to[0];

  it.each(["requested", "cancelledByCustomer"] as const)("sends %s to the chef", async (kind) => {
    await notifyBooking(kind, booking);
    expect(sentTo()).toBe("asha@example.com");
  });

  it.each(["accepted", "declined", "cancelledByChef", "completed"] as const)("sends %s to the customer", async (kind) => {
    await notifyBooking(kind, booking);
    expect(sentTo()).toBe("rohan@example.com");
  });

  it("builds links from the site address without a double slash", async () => {
    await notifyBooking("accepted", booking);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.text).toContain("https://saffron.example/bookings?tab=mine");
    expect(body.text).not.toContain("example//");
  });

  it("uses the chef's display name and the customer's first name", async () => {
    await notifyBooking("requested", booking);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.text).toContain("Hi Chef Asha");
    expect(body.text).toContain("Rohan would like to book you");
  });

  it("skips quietly when the person has no email address", async () => {
    await notifyBooking("accepted", { ...booking, customer: { name: "Rohan", email: null } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never throws, even if email sending blows up", async () => {
    fetchSpy.mockRejectedValue(new Error("boom"));
    await expect(notifyBooking("requested", booking)).resolves.toBeUndefined();
  });
});
