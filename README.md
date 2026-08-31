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
