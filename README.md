<div align="center">

# 🌶️ Saffron

**Book a verified home chef to cook in your own kitchen.**

Search for chefs by city, cuisine, dish and budget, send a booking request, and let the chef accept or decline. Prices are in ₹ and customers pay the chef directly: Saffron never handles money.

### 🔗 [Live demo: cheffron.netlify.app](https://cheffron.netlify.app/)

![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)

</div>

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Email notifications](#email-notifications)
- [Making yourself an admin](#making-yourself-an-admin)
- [Scripts](#scripts)
- [Testing](#testing)
- [Project structure](#project-structure)
- [How it works](#how-it-works)
- [Deployment](#deployment)
- [Author](#author)

## Overview

Saffron is a two-sided marketplace that connects customers with home chefs. A customer finds a chef, picks a date, time and guest count, and sends a request. The chef reviews it and accepts, declines, or suggests a different time. Once the chef accepts, the customer's address and the chef's phone number are revealed to each other, and never before.

Availability, capacity and booking rules are all enforced on the server, so the app stays consistent even under simultaneous requests.

## Features

### For customers
- **Discover chefs** by city, cuisine, dish and budget, with ratings and verified badges
- **Search by meal date, time (IST) and guest count**, with availability and capacity checked server-side
- **Rich chef profiles**: portrait, sample menu, reviews and up to six meal photos with dish names and captions
- **Booking requests** with accept, decline, cancel and complete flows
- **Time suggestions**: chefs can propose a new time, which the customer accepts or declines before it becomes a confirmed booking
- **Privacy by default**: address and phone number are only revealed after the chef accepts
- **Reviews** after a completed booking
- **Reporting** from bookings and chef profiles, plus cancellation guidance at `/cancellation`
- **Account settings** for name and phone, with account deletion requests

### For chefs
- **Profile management** with a separate portrait and a six-slot meal gallery (multi-image select, browser-side compression, drag or keyboard reordering, popup editor)
- **Unsaved-change protection**: portrait selections stay local until Save, and edits are guarded against link clicks and browser Back/Forward
- **Days off**: block a single day or a range so customers can't request them
- **Respond to requests** by accepting, declining, cancelling, or proposing a new time

### For admins (`/admin`)
- Verify chefs, hide profiles, and suspend profiles (with protection rules)
- Remove photos with an audit note
- Review and filter reports, add resolution notes, and view moderation history
- Handle account deletion requests and reply to support messages

### Platform
- **Automatic housekeeping**: unanswered requests expire, and accepted bookings close 3 days after the event
- **Email notifications** through Resend for every key booking event
- **In-app notifications** with read tracking
- **Abuse limits**: at most 5 waiting requests and 10 requests per hour per customer, and a 10-second pause between photo uploads
- **Help/FAQ**, privacy and terms pages, plus loading, retry and not-found screens
- **Paginated search** (12 results per page) where filters and sorting carry across pages

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL with Prisma ORM |
| Auth | NextAuth (Google sign-in) with the Prisma adapter |
| Validation | Zod |
| Email | Resend (optional) |
| Testing | Vitest, plus PostgreSQL integration tests in Docker |

## Getting started

### Prerequisites

- Node.js 20 or newer
- A PostgreSQL database (a free [Neon](https://neon.tech) database works well)
- A Google OAuth client ([setup guide](https://console.cloud.google.com), under APIs & Services → Credentials)

### Installation

```bash
git clone https://github.com/mohiitsahu/Saffron.git
cd Saffron
npm install
cp .env.example .env        # on Windows: copy .env.example .env
```

Open `.env` and fill in every value (see [Environment variables](#environment-variables)).

Create the database tables and start the app:

```bash
npx prisma migrate dev
npm run dev
```

Open <http://localhost:3000>.

## Environment variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by the app (use the pooled string with Neon) |
| `DIRECT_URL` | Direct, non-pooled connection string used for migrations |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `NEXTAUTH_SECRET` | Random string that signs login cookies. **Required in production** |
| `NEXTAUTH_URL` | Public address of the site, e.g. `http://localhost:3000` |
| `RESEND_API_KEY` | *Optional.* Key for sending email through [Resend](https://resend.com) |
| `EMAIL_FROM` | *Optional.* Sender, e.g. `Saffron <hello@yourdomain.com>` |

Add this redirect URI to your Google OAuth client:

- Development: `http://localhost:3000/api/auth/callback/google`
- Production: `https://YOUR-DOMAIN/api/auth/callback/google`

Generate a secret with `openssl rand -base64 32`.

## Email notifications

Emails are optional. If `RESEND_API_KEY` is empty, Saffron works normally and skips them (in development it prints a line in the terminal instead).

| Event | Recipient |
| --- | --- |
| New booking request | Chef |
| Customer cancels | Chef |
| Chef accepts | Customer |
| Chef declines | Customer |
| Chef cancels | Customer |
| Booking completed | Customer (asks for a review) |

To receive real emails:

1. Create a free Resend account and an API key, and put it in `RESEND_API_KEY`.
2. While testing, leave `EMAIL_FROM` empty. Resend's test sender only delivers to your own Resend account email, so use that address for your test accounts.
3. For real users, verify your domain in Resend and set `EMAIL_FROM` to an address on it.

Addresses and phone numbers are never put in an email. A failed or slow email never blocks a booking.

## Making yourself an admin

New accounts are customers. To get access to `/admin`, set your role in the database. In the Neon dashboard, open **SQL Editor** and run, with your own email:

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
| `npm test` | Run the unit tests once |
| `npm run test:watch` | Re-run tests whenever a file changes |
| `npm run test:integration` | Booking concurrency tests against temporary PostgreSQL (Docker required) |
| `npm run test:browser` | Isolated preview with disposable test accounts (Docker required) |
| `npm run test:build` | Build a temporary copy against disposable PostgreSQL (test sign-in only, no `.env` access) |
| `npx prisma migrate dev` | Apply new migrations to your development database |
| `npx prisma migrate deploy` | Apply migrations to a production database |
| `npx prisma studio` | Browse the database in your browser |

## Testing

### Unit tests

```bash
npm test
```

Tests live in `tests/` and run with [Vitest](https://vitest.dev). They need no database or Google login, because the database is replaced by a stand-in. They cover:

- Booking status rules (who can accept, decline, cancel and complete, and when)
- Which details are hidden from whom
- Expiry of old requests
- Date, phone and photo validation
- Availability, discovery, pagination and notifications
- Booking and account API limits

### PostgreSQL concurrency tests

Start Docker Desktop (Linux containers), then run:

```bash
npm run test:integration
```

The runner starts a temporary `postgres:16-alpine` container on a random localhost port, applies the committed migrations, and calls the real API routes with simultaneous requests. It checks overlapping acceptances, pending and hourly quotas, duplicate requests, and blocked days. Sign-in and email delivery are mocked. The container and temporary client are removed afterward, even if a test fails, and your application `.env` and database are never touched.

### Manual browser check

```bash
npm run test:browser
```

Open the localhost URL printed in the terminal and visit `/signin` to pick a test customer or chef. The preview runs from a temporary copy of the app with Google sign-in replaced only in that copy. Press Enter in the terminal to stop and clean up.

## Project structure

```
app/            Pages and API routes (App Router)
  api/          Bookings, chef profile, photos, reviews, reports, admin, account, support
components/     React components
lib/            Shared logic: booking rules, validation, auth, formatting, email
prisma/         Database schema and migrations
scripts/        Integration test and browser preview runners
tests/          Unit and integration tests
public/         Static files (logo)
types/          TypeScript type declarations
```

## How it works

- **Booking rules** live in `lib/bookings.ts`. Status changes go through `resolveTransition`, and `settleStaleBookings` expires old requests and closes finished bookings.
- **Privacy** is enforced on the server in `serializeBooking`: the browser never receives the address or phone number before a booking is accepted.
- **Photos** are shrunk in the browser (about 100 KB), stored in the database, and served from `/api/photos/[id]`. Only JPEG, PNG and WebP are accepted.
- **Days off** are stored as plain Indian calendar days (like `2030-11-02`), so there is no timezone maths. A booking is refused if its Indian calendar day is blocked. Bookings a chef already accepted are never cancelled automatically.
- **Emails** are built in `lib/emailTemplates.ts` and sent from `lib/email.ts`.

## Deployment

The app is deployed on Netlify at <https://cheffron.netlify.app/>.

The Prisma schema already includes the `rhel-openssl-3.0.x` binary target needed on Netlify and similar serverless hosts.

1. Set all the environment variables above. Set `NEXTAUTH_URL` to your real address and add `https://YOUR-DOMAIN/api/auth/callback/google` to your Google OAuth client.
2. Use `npm run build` as the build command.
3. Run `npx prisma migrate deploy` against the production database before (or as part of) each release that adds a migration.

> Never run `prisma migrate dev` against production, and never commit `.env` files.

For the full staging and production checklist, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Author

**Mohit Sahu**

- GitHub: [@mohiitsahu](https://github.com/mohiitsahu)
- LinkedIn: [mohitsahu7](https://www.linkedin.com/in/mohitsahu7/)
