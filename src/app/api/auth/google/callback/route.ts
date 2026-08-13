import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  GOOGLE_FLOW_COOKIE,
  exchangeCode,
  type GoogleFlowState,
} from "@/lib/google-auth";
import { normalizeEmail } from "@/lib/password";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionExpiry,
} from "@/lib/session";

/**
 * "Continue with Google", step two: Google sends the visitor back here with a
 * one-time code. Verify the round trip, learn who they are, and sign them in.
 *
 * Matching order:
 *   1. A user already linked to this Google account signs straight in.
 *   2. Otherwise, a user with the same (Google-verified) email is claimed —
 *      this is how an invited password user adds Google to their account.
 *   3. Otherwise a fresh account is created, as the schema always intended:
 *      "a future Google sign-in can create — or claim — an account".
 *
 * Every failure lands back on /login with a notice code instead of an error
 * page — from the visitor's side the door just didn't open, with a sentence
 * saying why to try again.
 */
export async function GET(request: NextRequest) {
  const fail = (notice: string) => {
    const response = NextResponse.redirect(
      new URL(`/login?notice=${notice}`, request.url),
    );
    response.cookies.delete(GOOGLE_FLOW_COOKIE);
    return response;
  };

  const flowCookie = request.cookies.get(GOOGLE_FLOW_COOKIE)?.value;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!flowCookie || !code || !state) return fail("google-failed");

  let flow: GoogleFlowState;
  try {
    flow = JSON.parse(flowCookie);
  } catch {
    return fail("google-failed");
  }
  if (!flow.state || flow.state !== state) return fail("google-failed");

  const identity = await exchangeCode(
    request.nextUrl.origin,
    code,
    flow.verifier,
  );
  if (!identity) return fail("google-failed");

  // Never claim an account by an address Google hasn't verified — that would
  // let anyone with an unverified Google profile take over an invited user.
  if (!identity.emailVerified) return fail("google-email");

  const email = normalizeEmail(identity.email);
  const linked = await prisma.user.findUnique({
    where: { googleId: identity.googleId },
  });
  const user =
    linked ??
    (await prisma.user.upsert({
      where: { email },
      update: { googleId: identity.googleId },
      create: {
        email,
        name: identity.name,
        googleId: identity.googleId,
      },
    }));

  // The cookie goes on the redirect response directly — same options as
  // startSession, which exists for Server Actions rather than redirects.
  const token = await createSessionToken(user.id);
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: sessionExpiry(),
  });
  response.cookies.delete(GOOGLE_FLOW_COOKIE);
  return response;
}
