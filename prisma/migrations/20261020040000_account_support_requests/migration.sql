-- Extend the existing administrator queue without weakening normal report targets.
ALTER TABLE "Report" DROP CONSTRAINT "Report_one_target";
ALTER TABLE "Report" ADD CONSTRAINT "Report_one_target" CHECK (
  ("reason" IN ('account_deletion', 'support', 'privacy') AND num_nonnulls("bookingId", "chefProfileId") = 0)
  OR
  ("reason" NOT IN ('account_deletion', 'support', 'privacy') AND num_nonnulls("bookingId", "chefProfileId") = 1)
);

CREATE INDEX "Report_reporterId_reason_createdAt_idx" ON "Report"("reporterId", "reason", "createdAt");
CREATE UNIQUE INDEX "Report_one_open_deletion_request" ON "Report"("reporterId")
  WHERE "reason" = 'account_deletion' AND "status" = 'OPEN';
