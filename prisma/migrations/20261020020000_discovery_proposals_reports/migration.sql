ALTER TABLE "User" ADD COLUMN "notificationsReadAt" TIMESTAMP(3);
ALTER TABLE "ChefProfile" ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "proposedEventDate" TIMESTAMP(3), ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookingEvent" ADD COLUMN "kind" TEXT;

CREATE TABLE "Report" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reporterId" TEXT NOT NULL REFERENCES "User"("id"),
  "bookingId" TEXT REFERENCES "Booking"("id"),
  "chefProfileId" TEXT REFERENCES "ChefProfile"("id"),
  "reason" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolutionNote" TEXT,
  "resolvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "Report_one_target" CHECK (num_nonnulls("bookingId", "chefProfileId") = 1),
  CONSTRAINT "Report_status" CHECK ("status" IN ('OPEN', 'RESOLVED', 'DISMISSED'))
);
CREATE UNIQUE INDEX "Report_reporterId_bookingId_key" ON "Report"("reporterId", "bookingId");
CREATE UNIQUE INDEX "Report_reporterId_chefProfileId_key" ON "Report"("reporterId", "chefProfileId");
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

CREATE TABLE "AdminAction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");
