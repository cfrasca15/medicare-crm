import { NextRequest } from "next/server";
import { addressForPlace, suggestAddresses } from "@/lib/addressLookup";

// Address autofill for the contact forms (signed-in users only, via proxy.ts).
//   ?q=123 Main&session=…        -> { provider, suggestions }
//   ?placeId=…&session=…         -> { address }  (Google suggestions only)
// Failures come back as { error } so typing by hand keeps working.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const session = (params.get("session") ?? "").slice(0, 36);
  const placeId = (params.get("placeId") ?? "").trim();

  try {
    if (placeId) {
      return Response.json({ address: await addressForPlace(placeId.slice(0, 300), session) });
    }
    const q = (params.get("q") ?? "").trim().slice(0, 200);
    if (q.length < 3) return Response.json({ provider: null, suggestions: [] });
    return Response.json(await suggestAddresses(q, session));
  } catch (err) {
    console.error("Address autofill failed:", err);
    return Response.json({ error: "Address lookup isn't available right now." }, { status: 502 });
  }
}
