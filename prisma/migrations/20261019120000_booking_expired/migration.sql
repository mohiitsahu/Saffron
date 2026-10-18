-- A request the chef never answered before the event time now becomes EXPIRED,
-- which frees the customer to book that chef again.
ALTER TYPE "BookingStatus" ADD VALUE 'EXPIRED';
