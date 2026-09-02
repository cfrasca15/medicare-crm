import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js Server Actions reject a POST whose Origin header doesn't match
  // an allowed host, as CSRF protection — without this, a request that
  // reaches the app via a hostname/port not covered here (Tailscale
  // hostname, LAN IP, or a reverse proxy rewriting Host) fails silently on
  // the client with no visible error, which looks exactly like a dead
  // button. Add every hostname:port this app is actually reached through.
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "frascahomeserver.taila1ca37.ts.net:3000",
        "frascahomeserver.taila1ca37.ts.net",
        "192.168.86.24:3000",
      ],
    },
  },
};

export default nextConfig;
