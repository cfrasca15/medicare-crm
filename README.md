# Medicare CRM

A CRM for Medicare health insurance brokers, with contacts/pipeline, policy &
commission tracking, tasks/reminders, and an Integrity API integration layer.

## Running locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `DATABASE_URL` — local SQLite file (defaults to `file:./dev.db`)
- `INTEGRITY_AUTH_URL` — Integrity's OAuth2 token endpoint
- `INTEGRITY_CLIENT_ID` / `INTEGRITY_CLIENT_SECRET` — Integrity API credentials
  (currently pointed at Integrity's **sandbox** environment)

## Database

Prisma + SQLite (via the libsql driver adapter, required by Prisma 7).

```bash
npx prisma migrate dev   # apply schema changes
npx prisma studio        # browse the local database
```

## Integrity integration

`src/lib/integrity.ts` handles OAuth2 client_credentials auth against
Integrity's partner API (token caching + auto-refresh included, verified
working against the sandbox endpoint). `integrityFetch()` is a fetch wrapper
that attaches a valid bearer token to any request.

Data sync (pulling contacts, policies, commissions from Integrity) isn't
wired up yet — that needs the endpoint docs for those resources beyond auth.
