import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

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
      const { payload } = await jwtVerify(token, secretKey);
      // A signed cookie isn't enough on its own: the login must still exist,
      // so deleting a user signs them out everywhere.
      valid =
        typeof payload.userId === "string" &&
        (await prisma.user.count({ where: { id: payload.userId } })) > 0;
    } catch {
      valid = false;
    }
  }

  if (!valid) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    if (token) res.cookies.delete("session");
    return res;
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
