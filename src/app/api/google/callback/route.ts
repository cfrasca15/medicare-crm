import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const settingsUrl = new URL("/settings/google", request.url);

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
