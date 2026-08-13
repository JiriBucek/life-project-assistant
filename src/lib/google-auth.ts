// Server-only by construction, like session.ts: node:crypto can't be bundled
// for the browser, so importing this from a client component is a build error.
import { createHash, randomBytes } from "node:crypto";

/**
 * The Google half of "Sign in with Google" — building the URL that hands the
 * visitor to Google, and turning what Google hands back into a verified
 * identity. The account and session work stays in the callback route, next to
 * the rest of the auth code.
 *
 * This is the standard OAuth authorization-code flow with PKCE, written out
 * by hand rather than through a library: the whole exchange is two redirects
 * and one fetch, and owning it keeps the app's auth in one readable place.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Where Google sends the visitor back to. Derived from the request's own
 * origin so the same code serves localhost and the deployed site — each
 * origin just has to be registered with Google. */
export const CALLBACK_PATH = "/api/auth/google/callback";

/**
 * Configured means both keys are present. Absent keys are not an error —
 * the login page simply explains that Google sign-in isn't switched on yet.
 */
export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

/**
 * Everything the start route must remember until Google calls back, carried
 * in one short-lived cookie: `state` ties the callback to this browser (CSRF),
 * `verifier` is the PKCE secret proving the callback and the start were the
 * same conversation.
 */
export type GoogleFlowState = { state: string; verifier: string };

export const GOOGLE_FLOW_COOKIE = "luma_google_flow";

export function newFlowState(): GoogleFlowState {
  return {
    state: randomBytes(16).toString("hex"),
    verifier: randomBytes(32).toString("base64url"),
  };
}

export function buildAuthUrl(origin: string, flow: GoogleFlowState): string {
  const url = new URL(AUTH_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: origin + CALLBACK_PATH,
    response_type: "code",
    // openid+email+profile: exactly what's needed to recognise a person and
    // greet them by name. No wider Google-account access is ever requested.
    scope: "openid email profile",
    state: flow.state,
    code_challenge: createHash("sha256")
      .update(flow.verifier)
      .digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

/** The subset of Google's ID token this app cares about. */
export type GoogleIdentity = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

/**
 * Trade the one-time code for the visitor's identity.
 *
 * The ID token's signature is deliberately not checked: the token arrives in
 * the body of our own HTTPS request to Google's token endpoint, so its origin
 * is already certain. Signatures matter when a token travels through an
 * untrusted party — here there is none.
 *
 * Returns null on any failure; the caller turns that into a friendly retry
 * message rather than a broken page.
 */
export async function exchangeCode(
  origin: string,
  code: string,
  verifier: string,
): Promise<GoogleIdentity | null> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: origin + CALLBACK_PATH,
      code,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) return null;

  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  const payload = idToken?.split(".")[1];
  if (!payload) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof claims.sub !== "string" || typeof claims.email !== "string") {
      return null;
    }
    return {
      googleId: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified === true,
      name: typeof claims.name === "string" ? claims.name : "",
    };
  } catch {
    return null;
  }
}
