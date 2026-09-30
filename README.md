# Medicare CRM

A CRM for Medicare health insurance brokers: contacts/pipeline (with a
pipeline stage that auto-advances as a policy moves from application to
enrolled), policy & commission tracking (with doctor/medical group), a
dated notes log per contact, a plan document library (SOBs/EOCs/rate
sheets, organized by carrier and plan), bulk CSV import with a reviewed
diff before anything applies, automatic 30/60/90-day client check-in
emails, tasks/reminders (with a quick-add widget on the dashboard), an
enrollments tracker, and integrations with Integrity, Google Calendar,
Gmail (send + history per contact), Calendly, and Google Voice
click-to-call.

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

## Background jobs

There's no separate worker process or job queue — `src/instrumentation.ts`
uses Next.js's `register()` hook (runs once when the server process starts,
in dev and in the built `next start` container alike) to schedule a daily
`node-cron` job at 9:00 AM server time. It runs the 30/60/90-day milestone
email check and the Application Submitted → Enrolled stage automation.
Check container logs on startup for "Daily checks scheduled" to confirm it
registered. A global flag guards against double-registration from dev-mode
hot reloads.

## Deploying to a home server (Docker)

1. Copy `docker.env.example` to `docker.env` and fill in real values.
   `DATABASE_URL` should stay as-is (points inside the container's data
   volume). `GOOGLE_REDIRECT_URI` needs to match the server's real
   reachable address (e.g. a Tailscale hostname), and that same URL must
   be added as an authorized redirect URI in Google Cloud Console.
   `ALLOWED_ORIGINS` needs every hostname/IP you'll actually type into a
   browser to reach this server — see the gotcha below if you skip this.
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
public internet. Once real HTTPS is in front of it, set `COOKIE_SECURE=true`
in `docker.env` (login cookies are insecure-by-default over plain HTTP,
deliberately — see gotchas below).

### Unraid + Compose Manager Plus notes

- The plugin (at least the version tested) only sees files under
  `/mnt/user/compose/<name>/`, not `/mnt/user/appdata/` — clone/keep the
  repo there.
- Its "Compose Up" button doesn't reliably force a rebuild when the source
  changed. **For updates, always run this directly in Unraid's terminal**
  rather than relying on the plugin's button:
  ```bash
  cd /mnt/user/compose/medicare-crm && git pull && docker compose up -d --build
  ```
- Google's OAuth redirect URI must be a real domain — it rejects bare LAN
  IPs (`http://192.168.x.x:3000/...`). A Tailscale hostname
  (`http://your-server.tailXXXXX.ts.net:3000/...`) works and also solves
  remote access in one step. **Tailscale needs to be installed on both the
  server and any device that will reach that hostname** — a device without
  Tailscale running gets `DNS_PROBE_FINISHED_NXDOMAIN` on `.ts.net` addresses.
- If pasting long secrets (e.g. `CALENDLY_API_TOKEN`) into `docker.env` via
  Unraid's web terminal, verify afterward with
  `grep -c '•' docker.env` (should print `0`) — long pastes have silently
  corrupted characters into literal bullet points (•) in this terminal,
  in both nano and heredoc. If it's non-zero, base64-encode the correct
  content elsewhere and `echo '<blob>' | base64 -d > docker.env` instead —
  a plain letters/numbers blob has nothing for the paste path to corrupt.

### Gotchas hit building this (all fixed, kept here in case they regress)

- **Prisma client must be explicitly regenerated in the build stage.** It's
  gitignored (build output), so `npm ci`'s `postinstall` hook generates it
  in the `deps` stage, but only `node_modules` gets copied forward from
  there — `RUN npx prisma generate` in the `builder` stage (after `COPY . .`)
  is required too.
- **Pages that query Prisma directly need `export const dynamic =
  "force-dynamic"`** unless something else (searchParams, cookies) already
  forces dynamic rendering. Without it, Next.js tries to statically
  pre-render them at build time, which fails outright in Docker (no
  `DATABASE_URL` exists until the container starts) and would silently
  serve stale, build-time-frozen data even where it doesn't fail.
- **Session cookie's `Secure` flag must not be tied to `NODE_ENV`.**
  `NODE_ENV=production` doesn't mean "served over HTTPS" — browsers
  silently drop `Secure` cookies over plain HTTP, breaking login with no
  visible error. Controlled via the separate `COOKIE_SECURE` env var
  instead.
- **Don't build redirect URLs from `request.url`'s origin** in a route
  handler running behind Docker with no reverse proxy forwarding the real
  `Host` header — it resolves to `localhost`, silently sending users to a
  dead link after a real action (e.g. Google OAuth) already succeeded.
  Derive the origin from a known-correct source instead (here,
  `GOOGLE_REDIRECT_URI`).
- **Every hostname this app is reached through must be listed in
  `ALLOWED_ORIGINS`.** Next.js Server Actions reject a POST whose `Origin`
  header isn't on that list, as CSRF protection — and the failure is
  completely silent: no error, no console output, a save button that just
  does nothing. If a button appears to do nothing, this is the first thing
  to check. See `next.config.ts`.

## Integrations

- **Integrity** (`src/lib/integrity.ts`) — leads, addresses, emails, phones,
  Medicare number/Part A/B (via `PATCH /partners/leads/{id}`, confirmed
  live — accepts a partial body), and health profile
  (pharmacies/providers/prescriptions) sync, via OAuth2 client_credentials.
  Note: Integrity's own portal has a separate Sandbox/Production toggle at
  credential-generation time — a credential's *name* doesn't tell you which
  one it is; check `isSandbox` on the issued token if leads aren't showing
  up. The partner API has no read endpoint for a lead's saved
  providers/pharmacies/prescriptions (POST-only, confirmed via a live 405),
  so those are cached locally in this app's own database instead.
- **Google Calendar** (`src/lib/google.ts`) — OAuth2, task-to-event sync,
  month-view calendar page.
- **Gmail** (`src/lib/google.ts`) — same Google OAuth connection as
  Calendar (with `gmail.send`/`gmail.readonly` scopes added); send email
  and view history per contact. If Google was connected before these
  scopes existed, it needs reconnecting from Settings > Google. Also
  requires the Gmail API to be enabled on the underlying Google Cloud
  project (Google Cloud Console > APIs > Gmail API).
- **Calendly** (`src/lib/calendly.ts`) — Personal Access Token, pulls
  scheduled events into contacts/tasks.
- **Google Voice** (`src/lib/phone.ts`) — click-to-call links (unofficial
  web dialer URL, no public API exists for this).
