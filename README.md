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
- Admin page (`/admin`) to verify chefs, hide profiles and remove photos

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
| `npx prisma migrate dev` | Apply new migrations to your development database |
| `npx prisma migrate deploy` | Apply migrations to a production database |
| `npx prisma studio` | Browse the database in your browser |

## Project layout

```
app/            pages and API routes (App Router)
  api/          bookings, chef profile, photos, reviews, notifications, admin
components/     React components
lib/            shared logic: booking rules, validation, auth, formatting
prisma/         database schema and migrations
public/         static files (logo)
```

## How things work

- **Booking rules** live in `lib/bookings.ts`. Status changes go through `resolveTransition`, and
  `settleStaleBookings` expires old requests and closes finished bookings.
- **Privacy** is enforced on the server in `serializeBooking`: the browser never receives the
  address or phone number before a booking is accepted.
- **Photos** are shrunk in the browser (about 100 KB) and stored in the `ChefPhoto` table, then
  served from `/api/photos/[id]`. Only JPEG, PNG and WebP are accepted.
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
