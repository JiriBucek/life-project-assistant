import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Deliberately the dependency-free constant, not @/lib/session — see the note
// in session-cookie.ts. Pulling Prisma into the edge bundle breaks the server.
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * An optimistic redirect, and nothing more.
 *
 * This only asks "is there a session cookie?" — it never validates it, because
 * proxy runs on every request and shouldn't be doing database work. A forged or
 * expired cookie sails straight through, which is fine: the real check is
 * `requireUser()` in the data layer, which every read and every write goes
 * through. This exists so a signed-out visitor lands on /login immediately
 * rather than rendering a page that redirects a moment later.
 *
 * Note the asymmetry: we redirect *to* /login but never away from it. Sending
 * cookie-holders away from /login would loop forever once a cookie outlives its
 * session row — the page bounces to /, `requireUser()` bounces back to /login.
 * The login page does that check itself, against a validated session.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname !== "/login" && !request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's own assets — /login is the app's only page that
  // a signed-out visitor is allowed to see, and it's handled above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
