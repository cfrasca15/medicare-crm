# Medicare CRM

A CRM for Medicare health insurance brokers: contacts/pipeline, policy &
commission tracking (with doctor/medical group), tasks/reminders, an
enrollments tracker, and integrations with Integrity, Google Calendar,
Calendly, and Google Voice click-to-call.

## Running locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000 — first run shows a one-time setup page to
create your login.

## Environment variables

Copy `.env.example` to `.env.local` and fill in your real values (Integrity,
Google, Calendly credentials, and a random `SESSION_SECRET`).

## Database

Prisma + SQLite (via the libsql driver adapter, required by Prisma 7).

```bash
npx prisma migrate dev   # apply schema changes
npx prisma studio        # browse the local database
```

## Deploying to a home server (Docker)

1. Copy `docker.env.example` to `docker.env` and fill in real values.
   `DATABASE_URL` should stay as-is (points inside the container's data
   volume). `GOOGLE_REDIRECT_URI` needs to match the server's real
   reachable address (e.g. a Tailscale hostname), and that same URL must
   be added as an authorized redirect URI in Google Cloud Console.
2. Build and start:
   ```bash
   docker compose up -d --build
   ```
3. The SQLite database persists in the `crm-data` named volume across
   container rebuilds/updates. Migrations run automatically on container
   start (`prisma migrate deploy`, safe to run repeatedly).
4. To deploy an update: pull the latest code, then
   `docker compose up -d --build` again.

Put this behind a reverse proxy (e.g. Caddy) for HTTPS, and use a VPN like
Tailscale for remote access — never expose the container directly to the
public internet.

## Integrations

- **Integrity** (`src/lib/integrity.ts`) — leads, addresses, emails, phones,
  and health profile (pharmacies/providers/prescriptions) sync, via
  OAuth2 client_credentials. Currently pointed at Integrity's sandbox.
- **Google Calendar** (`src/lib/google.ts`) — OAuth2, task-to-event sync,
  month-view calendar page.
- **Calendly** (`src/lib/calendly.ts`) — Personal Access Token, pulls
  scheduled events into contacts/tasks.
- **Google Voice** (`src/lib/phone.ts`) — click-to-call links (unofficial
  web dialer URL, no public API exists for this).
