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

### Neon on Netlify or another serverless host (Prisma 5)

Use Neon's pooled connection string for `DATABASE_URL` and the direct connection
for `DIRECT_URL` in the host's environment settings. The schema already uses
`DIRECT_URL` for migrations. Example placeholders, not working credentials:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@ep-EXAMPLE-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require&connection_limit=1"
DIRECT_URL="postgresql://USER:PASSWORD@ep-EXAMPLE.REGION.aws.neon.tech/DBNAME?sslmode=require"
```

Copy the actual hosts and required TLS parameters from Neon. Preserve existing
query parameters when adding options (`&` after the first `?`). For this project's
Prisma 5 client, `connection_limit=1` is a conservative serverless starting point;
adjust after testing concurrency and pool wait times. Warm function instances reuse
their Prisma client, but separate instances still have separate client pools.

Do not add `pgbouncer=true` automatically: Prisma recommends it for PgBouncer
versions below 1.21, and recommends leaving it unset for newer compatible poolers.
Use the provider's guidance for the actual pooler. Transaction-scoped advisory
locks remain on the same connection throughout the transaction; do not replace
them with session-scoped locks when using transaction pooling. Redeploy after
changing hosting variables. See [Neon's Prisma guide](https://neon.com/docs/guides/prisma)
and [Prisma's PgBouncer guidance](https://docs.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections/pgbouncer).

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

## Account requests, help and policies

Account deletion, support and privacy messages use the existing Report table. Apply
`20261020040000_account_support_requests` with `npx prisma migrate deploy` before
running this release. It extends the report-target constraint for account requests,
adds an owner/request lookup index, and prevents duplicate open deletion requests.
Administrators review them in the report queue. Replies on account deletion requests
are visible to their owner in Settings; support/privacy replies appear under Help.
Marking a deletion request reviewed does not delete account data. Handle the actual
deletion and any retained records separately before telling the owner it is complete.
There is currently no automatic account deletion/anonymisation endpoint. Booking
and review foreign keys intentionally restrict deleting a referenced User row.
A future deletion workflow should retain that row where necessary and anonymise
the appropriate personal data, revoke sessions and linked sign-in accounts, and
review chef profiles/photos and personal data stored in booking/report records.
Blanking only the User's name, email and phone is not a complete deletion workflow.

Before public launch, review the policy text for the real operator, hosting, retention
process and contact arrangements. The in-app contact form currently requires sign-in;
provide a public contact route for people who cannot sign in. The pages describe app
behaviour and are not a certification of legal compliance. Primary reference:
[MeitY: Digital Personal Data Protection Act 2023](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf).

## Meal galleries

Apply `20261020060000_meal_gallery` with `npx prisma migrate deploy`, then stop the
local server and run `npx prisma generate` before restarting it. The migration adds
a separate MealPhoto table; existing chef portraits are unchanged. Gallery images
are limited to six per chef and 1 MB each on the server; browser uploads are
compressed. Photo metadata queries do not load image bytes. Meal photo responses
revalidate before reuse so removals and hidden listings stop serving images on
subsequent requests. Verify upload/edit/reorder/delete and admin removal on staging.

## In-app booking updates

Signed-in users have a notification bell with a desktop panel and mobile bottom
sheet. It reads existing BookingEvent records, excludes the viewer's own actions,
and shows the latest 30 updates. “Mark all as read” saves the current snapshot's
time in User.notificationsReadAt without clearing later updates or other accounts.
The bell refreshes every minute while visible and when returning to the tab.
No new migration is needed when the existing discovery/proposals migration has
been applied. Links open the selected booking, including older history, after
checking that the viewer is a party. Notifications never include booking addresses
or phone numbers. These are in-app updates, not browser push notifications.
