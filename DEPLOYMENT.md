# Saffron: staging and production deployment

This project uses Next.js 14 App Router, NextAuth v4, Prisma 5, PostgreSQL and Google OAuth.
Use staging before exposing a production domain to real customers. Do not commit `.env` files.

## 0. Back up your local edits

In PowerShell, from your existing local Saffron folder:

```powershell
git status
# Commit your work to a branch or make a copy of the folder before replacing source files.
```

## 1. Local prerequisites

- Node.js 20 LTS or newer compatible with these pinned package versions
- PostgreSQL database (local or hosted)
- Google OAuth web client with credentials

In PowerShell:

```powershell
npm ci
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
```

Fill `.env` with correct credentials. Both Next.js and Prisma CLI load this file;
Prisma CLI does not automatically load `.env.local`. Keep an existing `.env` rather than overwriting it.

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
GOOGLE_CLIENT_ID="your-google-web-client-id"
GOOGLE_CLIENT_SECRET="your-google-web-client-secret"
NEXTAUTH_SECRET="a-strong-random-secret"
NEXTAUTH_URL="http://localhost:3000"
RESEND_API_KEY=""
EMAIL_FROM=""
```

Generate a secret in PowerShell with cryptographically secure randomness:

```powershell
$b = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
[Convert]::ToBase64String($b)
```

Store secrets in hosting environment settings, never in Git. Do not put them in `NEXT_PUBLIC_*` variables.

## 2. Validate before migrations

```powershell
npx prisma validate
npx tsc --noEmit
npm test
npm run test:integration # requires Docker Desktop with Linux containers running
npm run lint
npm run build
```

If any command fails, fix it before deployment. Build may need env vars and a database connection.

## 3. Database migrations

The discovery/proposals/reports release adds `20261020020000_discovery_proposals_reports`.
Apply it before running this code against an existing database. It adds proposal fields,
moderation flags, reports, and the admin action log without
removing existing bookings. Existing profiles keep their current visibility. Back up first.
Stop your local dev server before regenerating Prisma on Windows so its engine DLL is not locked:

```powershell
npx prisma migrate deploy
npx prisma generate
```

Restart the app afterward. These commands use your locally configured environment; the
isolated test runners use only their own temporary databases.

Only use a fresh *staging* database initially. Never run `prisma migrate dev` against production.

```powershell
npx prisma migrate deploy
npx prisma migrate status
```

For an existing production database, back it up and verify migration compatibility first.
A preexisting custom partial index enforces one open request per customer/chef, as defined
by the committed migrations. Make sure all migrations have run successfully.

## 4. Google OAuth callback URL

In Google Cloud Console > APIs & Services > Credentials, configure an OAuth client of
**Web application** type. Add:

- Local callback: `http://localhost:3000/api/auth/callback/google`
- Staging callback: `https://YOUR-STAGING-DOMAIN/api/auth/callback/google`
- Production callback: `https://YOUR-DOMAIN/api/auth/callback/google`

Add the corresponding authorized JavaScript origins (without path).
On staging and production, `NEXTAUTH_URL` must match the site's HTTPS origin.

## 5. Deploy to staging on Vercel (example)

1. Create a **separate** staging PostgreSQL database (Neon is one option).
2. Push your branch to GitHub and import the repository into Vercel.
3. Use the repository root, Next.js framework preset, install command `npm ci`,
   and build command `npm run build`.
4. Configure `DATABASE_URL`, `DIRECT_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and optional email variables in Vercel environment settings.
5. Run `npx prisma migrate deploy` explicitly against the staging database; verify status.
6. Deploy and check runtime logs for migration, Prisma, and OAuth errors.
7. Ensure the host limits request body size on image-upload endpoints; the `Content-Length`
   precheck in the app is *not* a hard limit for untrusted streaming requests.

IMPORTANT: Do not automatically run migrations on every serverless function invocation.
Use a controlled release step, not an API endpoint.

## 6. Staging checklist

- [ ] New customer can sign in via Google.
- [ ] New chef can create/edit a profile and upload/delete a JPEG, PNG or WebP image.
- [ ] Non-chefs cannot create blocked days.
- [ ] Blocking a day rejects a subsequent booking request and acceptance of an older pending request.
- [ ] A chef can accept/decline; only parties can view the booking.
- [ ] Two overlapping acceptances cannot both succeed.
- [ ] Two simultaneous customers requesting a chef while the chef blocks a day are serialized.
- [ ] Maximum five open requests and ten requests/hour are enforced under concurrent load.
- [ ] Pending requests hide the customer's address and phone from the chef.
- [ ] Accepted bookings show contact details only to the parties.
- [ ] Cancellation, completion, expiry and reviews work as expected.
- [ ] Email failures do not undo saved bookings.
- [ ] Error pages and logs do not leak phone numbers, addresses or secrets.
- [ ] Mobile booking flow works on common phone sizes.
- [ ] Database backup and restore have been tested.

## 7. Go live

1. Create a separate **production** database; ensure backups and a restore plan.
2. Set production-only secrets and Google OAuth callback URLs.
3. Set `NEXTAUTH_URL=https://YOUR-DOMAIN`.
4. Run migrations against the production database from a controlled release environment.
5. Deploy tested code, verify health, authentication and the end-to-end booking journey.
6. Set up errors, uptime monitoring and scheduled backups.
7. Publish privacy, cancellation, refund (if payments are added) and terms policies.

## Known remaining work

- Database-backed images are fine for a small MVP, but consider object storage/CDN as traffic grows.
- Request-body size enforcement needs an infrastructure-level guard.
- The app has no payment flow; do not imply payment is collected or confirmed.
- A comprehensive content security policy needs testing with actual OAuth and frontend assets.
- Review dependency security advisories and upgrade pinned packages with regression testing.
- Unit tests cannot replace real-database tests for PostgreSQL advisory-lock behavior.
