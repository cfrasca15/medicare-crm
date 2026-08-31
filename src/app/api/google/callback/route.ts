import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // Deliberately NOT built from request.url's origin — behind Docker (no
  // reverse proxy forwarding the real Host), Next.js resolves it to
  // localhost instead of the actual public address, silently sending
  // users to a dead link after Google auth completes. GOOGLE_REDIRECT_URI
  // is guaranteed correct: it's the exact URL Google just used to reach us.
  const appOrigin = new URL(process.env.GOOGLE_REDIRECT_URI!).origin;
  const settingsUrl = new URL("/settings/google", appOrigin);

  if (error) {
    settingsUrl.searchParams.set("error", error);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code) {
    settingsUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    await exchangeCodeForTokens(code);
    settingsUrl.searchParams.set("connected", "1");
  } catch (err) {
    settingsUrl.searchParams.set(
      "error",
      err instanceof Error ? err.message : "unknown_error"
    );
  }

  return NextResponse.redirect(settingsUrl);
}
