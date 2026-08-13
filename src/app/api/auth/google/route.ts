import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  GOOGLE_FLOW_COOKIE,
  buildAuthUrl,
  isGoogleConfigured,
  newFlowState,
} from "@/lib/google-auth";

/**
 * "Continue with Google", step one: remember a one-time state in a cookie and
 * hand the visitor to Google's consent screen. Google returns them to the
 * sibling callback route.
 */
export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      new URL("/login?notice=google-off", request.url),
    );
  }

  const flow = newFlowState();
  const response = NextResponse.redirect(
    buildAuthUrl(request.nextUrl.origin, flow),
  );
  response.cookies.set(GOOGLE_FLOW_COOKIE, JSON.stringify(flow), {
    httpOnly: true,
    sameSite: "lax", // must survive the top-level redirect back from Google
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60, // the round trip takes seconds; 10 minutes is generous
  });
  return response;
}
