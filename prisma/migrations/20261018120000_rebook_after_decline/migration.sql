-- A chef's answer no longer blocks the customer: only pending or accepted requests count as open.
DROP INDEX IF EXISTS "Booking_one_open_request_key";

CREATE UNIQUE INDEX "Booking_one_open_request_key"
ON "Booking" ("customerId", "chefId")
WHERE "status" IN ('REQUESTED', 'ACCEPTED');