# Saffron

Book a verified home chef to cook in your own kitchen. Customers search for chefs and send a
booking request; chefs accept or decline. Prices are in ₹ and customers pay the chef directly
(Saffron never handles money).

Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma + PostgreSQL, NextAuth
(Google sign-in) and Zod.

## Features

- Find chefs by city, cuisine, dish and budget, with ratings and verified badges
- Chef profiles with photo upload, sample menu and reviews
- Booking requests: accept, decline, cancel and complete, with the customer's address and the
  chef's phone number revealed only after the chef accepts
- Requests that nobody answers expire on their own; accepted bookings close themselves
  3 days after the event
- Chefs can block out days they're unavailable (one day or a range), and customers can't request
  those days
- Email notifications: a chef is emailed about a new request or a cancellation, and a customer
  when a booking is accepted, declined, cancelled or completed
- Admin page (`/admin`) to verify chefs, hide profiles and remove photos
- Search by meal date, time (IST), and guest count, with availability and capacity checked on the server
- Chef time suggestions that customers accept or decline before a request becomes a confirmed booking
- Cancellation guidance at `/cancellation`, with reporting from bookings and chef profiles
- Admin review filters, report resolution notes, moderation history, and protected profile suspensions

## Getting started

You need Node.js 20 or newer and a PostgreSQL database (a free [Neon](https://neon.tech)
database works well).

```bash
npm install
cp .env.example .env        # on Windows: copy .env.example .env
```

Open `.env` and fill in every value. The comments in `.env.example` explain each one.

Create the database tables and start the app:

```bash
npx prisma migrate dev
npm run dev
```

Open <http://localhost:3000>.

### Environment variables

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string the app uses |
| `DIRECT_URL` | Direct (non-pooled) connection string, used for migrations |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `NEXTAUTH_SECRET` | Random string that signs login cookies. Required in production |
| `NEXTAUTH_URL` | The site's public address, for example `http://localhost:3000` |
| `RESEND_API_KEY` | Optional. Key for sending email through [Resend](https://resend.com) |
| `EMAIL_FROM` | Optional. Sender, for example `Saffron <hello@yourdomain.com>` |

## Email notifications

Emails are sent through Resend. They are optional: if `RESEND_API_KEY` is empty, Saffron works as
normal and skips the emails (in development it prints a line in the terminal instead).

| Event | Who gets the email |
| --- | --- |
| New booking request | The chef |
| Customer cancels | The chef |
| Chef accepts | The customer |
| Chef declines | The customer |
| Chef cancels | The customer |
| Booking completed | The customer (asks for a review) |

To receive real emails:

1. Create a free Resend account and an API key, and put it in `RESEND_API_KEY`.
2. While testing, leave `EMAIL_FROM` empty. Resend's test sender only delivers to the email
   address of your own Resend account, so test by using that address for your accounts.
3. For real users, verify your domain in Resend and set `EMAIL_FROM` to an address on it.

Addresses and phone numbers are never put in an email. They stay inside My bookings, after the
chef accepts. A failed or slow email never blocks a booking.

## Making yourself an admin

New accounts are customers. To get access to `/admin`, set your role in the database. In the
Neon dashboard open **SQL Editor** and run, with your own email:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
```

Sign out and back in. An **Admin** link appears in the navbar.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm start` | Run the production build |
| `npm run lint` | Check the code with ESLint |
| `npm test` | Run the automated tests once |
| `npm run test:integration` | Test booking concurrency against temporary PostgreSQL (Docker required) |
| `npm run test:browser` | Start an isolated preview with disposable test accounts (Docker required) |
| `npm run test:build` | Build a temporary copy against disposable PostgreSQL (test sign-in only, no .env access) |
| `npm run test:watch` | Re-run tests whenever a file changes |
| `npx prisma migrate dev` | Apply new migrations to your development database |
| `npx prisma migrate deploy` | Apply migrations to a production database |
| `npx prisma studio` | Browse the database in your browser |

## Tests

```bash
npm test
```

Tests live in `tests/` and run with [Vitest](https://vitest.dev). They need no database or
Google login: the database is replaced by a stand-in. They cover the booking status rules
(who can accept, decline, cancel and complete, and when), which details are hidden from
whom, expiry of old requests, date and phone validation, photo type checks, and the booking
API's limits. Run them before every deploy.

### PostgreSQL concurrency tests

Start Docker Desktop (Linux containers), then run:

```bash
npm run test:integration
```

The runner starts a temporary `postgres:16-alpine` container on a random localhost port,
applies the committed migrations, and calls the real API routes with simultaneous requests.
It checks overlapping acceptances, pending and hourly quotas, duplicate requests, and blocked
days. Sign-in and email delivery are mocked; database operations use real PostgreSQL.
The runner removes its container and temporary generated client afterward, including on test
failure. The first run may download the PostgreSQL image. It does not load application `.env`
files or connect to your application database. Normal `npm test` runs only the unit tests.

For a manual browser check, run `npm run test:browser` and open the localhost URL printed
in the terminal. Visit `/signin` to choose the test customer or chef. This preview copies the
app to a temporary folder and replaces Google sign-in only in that copy. The production
authentication code is unchanged. Press Enter in its terminal to stop and clean up when finished. Google OAuth
and real email delivery need separate staging checks.

## Project layout

```
app/            pages and API routes (App Router)
  api/          bookings, chef profile, photos, reviews, admin
components/     React components
lib/            shared logic: booking rules, validation, auth, formatting
prisma/         database schema and migrations
tests/          automated tests
public/         static files (logo)
```

## How things work

- **Booking rules** live in `lib/bookings.ts`. Status changes go through `resolveTransition`, and
  `settleStaleBookings` expires old requests and closes finished bookings.
- **Privacy** is enforced on the server in `serializeBooking`: the browser never receives the
  address or phone number before a booking is accepted.
- **Photos** are shrunk in the browser (about 100 KB) and stored in the `ChefPhoto` table, then
  served from `/api/photos/[id]`. Only JPEG, PNG and WebP are accepted.
- **Days off** are stored as plain Indian calendar days (`ChefBlockedDay`, like `2030-11-02`), so
  there is no timezone maths. A booking is refused if its Indian calendar day is blocked.
  Bookings a chef already accepted are never cancelled automatically.
- **Emails** are built in `lib/emailTemplates.ts` and sent from `lib/email.ts`.
- **Limits** on abuse: at most 5 waiting requests and 10 requests per hour per customer, and a
  10-second pause between photo uploads.

## Deploying

The Prisma schema already includes the `rhel-openssl-3.0.x` binary target needed on Netlify and
similar serverless hosts. On your host:

1. Set all the environment variables above. Set `NEXTAUTH_URL` to your real address and add
   `https://YOUR-DOMAIN/api/auth/callback/google` to your Google OAuth client.
2. Use `npm run build` as the build command.
3. Run `npx prisma migrate deploy` against the production database before (or as part of) each
   release that adds a migration.
