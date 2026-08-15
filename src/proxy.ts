import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_SECRET = process.env.SESSION_SECRET!;
const secretKey = new TextEncoder().encode(SESSION_SECRET);

const PUBLIC_PATHS = ["/login", "/setup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;
  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, secretKey);
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (!valid) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
