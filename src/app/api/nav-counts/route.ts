import { NextRequest } from "next/server";
import { loadNavCounts } from "@/lib/navCounts";

export const dynamic = "force-dynamic";

// The counts shown next to the menu's "To do" links. "?fresh=1" right after
// a save, so the counts reflect it.
export async function GET(request: NextRequest) {
  return Response.json(await loadNavCounts(request.nextUrl.searchParams.has("fresh")));
}
