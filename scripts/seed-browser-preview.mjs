import { createRequire } from "node:module";

if (!process.env.SAFFRON_TEST_CLIENT || !process.env.DATABASE_URL?.includes("/saffron_test?")) {
  throw new Error("Use npm run test:browser to seed a disposable database.");
}
const { PrismaClient } = createRequire(import.meta.url)(process.env.SAFFRON_TEST_CLIENT);
const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
try {
  await db.user.create({ data: { id: "smoke-customer", name: "Test Customer", phone: "9876543210" } });
  await db.user.create({ data: { id: "smoke-admin", name: "Test Admin", role: "ADMIN" } });
  await db.chefProfile.create({ data: {
    id: "smoke-asha", displayName: "Asha Sharma", city: "Bhopal", cuisines: ["indian", "punjabi"],
    bio: "I cook comforting home meals for family dinners and celebrations. My specialties include dal makhani, paneer dishes and fresh seasonal vegetables.",
    pricePerPerson: 500, maxGuests: 10, yearsExperience: 8, verified: true,
    sampleMenu: "Dal makhani\nPaneer tikka\nJeera rice\nFresh rotis",
    user: { create: { id: "smoke-chef", name: "Asha Sharma", phone: "9123456789", role: "CHEF" } },
  } });
  const day = 86_400_000;
  const when = (days) => new Date(Date.now() + days * day);
  const base = { customerId: "smoke-customer", chefId: "smoke-chef", guests: 4,
    city: "Bhopal", area: "Arera Colony", address: "12 Test Street", phone: "9876543210", estimatedTotal: 2000 };
  const samples = [
    { ...base, id: "preview-request", eventDate: when(3), status: "REQUESTED", notes: "Vegetarian dinner. Mild spices, please." },
    { ...base, id: "preview-proposal", eventDate: when(5), proposedEventDate: when(6), status: "REQUESTED" },
    { ...base, id: "preview-confirmed", eventDate: when(8), status: "ACCEPTED" },
    { ...base, id: "preview-complete", eventDate: when(-0.5), status: "ACCEPTED" },
    { ...base, id: "preview-review", eventDate: when(-2), status: "COMPLETED" },
    ...Array.from({ length: 8 }, (_, i) => ({ ...base, id: "preview-history-" + i, eventDate: when(-5 - i), status: i % 2 ? "CANCELLED" : "DECLINED" })),
  ];
  for (const [index, sample] of samples.entries()) {
    const guest = await db.user.create({ data: { name: "Test Guest " + (index + 1) } });
    const cook = await db.user.create({ data: { name: "Test Chef " + (index + 1), role: "CHEF", phone: "9123456789",
      chefProfile: { create: { displayName: "Chef " + (index + 1), city: "Bhopal", cuisines: ["indian"], bio: "Disposable chef profile for booking page checks.", pricePerPerson: 500, maxGuests: 10, yearsExperience: 5 } } } });
    for (const data of [{ ...sample, customerId: guest.id }, { ...sample, id: sample.id + "-customer", chefId: cook.id }]) {
      const booking = await db.booking.create({ data });
      await db.bookingEvent.create({ data: {
        bookingId: booking.id, toStatus: booking.status,
        actorId: booking.proposedEventDate || booking.status !== "REQUESTED" ? booking.chefId : booking.customerId,
        kind: booking.proposedEventDate ? "time_propose" : null,
        createdAt: new Date(Date.now() - index * 3_600_000),
      } });
    }
  }
} finally { await db.$disconnect(); }
