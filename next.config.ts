import type { NextConfig } from "next";

// Next.js Server Actions reject a POST whose Origin header doesn't match an
// allowed host, as CSRF protection — without this, a request that reaches
// the app via a hostname/port not covered here (Tailscale hostname, LAN IP,
// or a reverse proxy rewriting Host) fails silently on the client with no
// visible error, which looks exactly like a dead button. Read from an env
// var (comma-separated "host:port" entries) rather than hardcoding, since
// this is deployment-specific — every hostname:port the app is actually
// reached through needs to be listed via ALLOWED_ORIGINS in your env file.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins,
      // Default (1MB) is too small for plan documents (SOB/EOC PDFs, rate
      // sheet spreadsheets) — raised so uploads don't get silently rejected.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
