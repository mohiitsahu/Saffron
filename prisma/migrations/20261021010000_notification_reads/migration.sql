CREATE TABLE "NotificationRead" (
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("userId", "eventId"),
  CONSTRAINT "NotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NotificationRead_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "BookingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "NotificationRead_eventId_idx" ON "NotificationRead"("eventId");

-- Preserve existing read history once, then acknowledge individual events only.
INSERT INTO "NotificationRead" ("userId", "eventId")
SELECT u."id", e."id"
FROM "User" u
JOIN "Booking" b ON b."customerId" = u."id" OR b."chefId" = u."id"
JOIN "BookingEvent" e ON e."bookingId" = b."id"
WHERE u."notificationsReadAt" IS NOT NULL
  AND e."createdAt" <= u."notificationsReadAt"
  AND (e."actorId" IS NULL OR e."actorId" <> u."id");
