-- The live database already has this value (it was added outside the migration history).
-- IF NOT EXISTS makes this safe to run on a database that has it and on a fresh one that doesn't.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'REPORTED';
