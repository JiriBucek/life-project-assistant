// Server-only by construction: importing `next/headers` from a client
// component is a build error, so this module can never reach the browser.
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Session management: a random token in an httpOnly cookie, backed by a row
 * in the database.
 *
 * Only the SHA-256 of the token is stored. The raw token exists in the user's
 * cookie and nowhere else, so a dump of the database can't be replayed as a
 * login. Because sessions are rows, they're also revocable — deleting the row
 * signs that browser out immediately, which a stateless JWT can't do.
 */
export { SESSION_COOKIE };

const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A token is only ever compared by its hash. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + SESSION_DAYS * DAY_MS);
}

/**
 * Mint a session row and return its raw token. Kept separate from the cookie
 * so non-browser callers (the e2e suite, scripts) can create a session too.
 */
export async function createSessionToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt: sessionExpiry() },
  });
  return token;
}

/** Cookie options — identical everywhere a session cookie is written. */
function cookieOptions(expires: Date) {
  return {
    httpOnly: true, // never readable from JavaScript
    sameSite: "lax" as const, // survives normal navigation, blocks cross-site POSTs
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

/** Sign this browser in as `userId`. Must be called from a Server Action. */
export async function startSession(userId: string): Promise<void> {
  const token = await createSessionToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, cookieOptions(sessionExpiry()));
}

/**
 * The signed-in user, or null. Expired sessions are deleted as they're found,
 * so the table cleans itself up through normal traffic.
 */
export async function readSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session;
}

/**
 * Sign this browser out: drop the row (so the token is dead even if the cookie
 * lingers) and clear the cookie. Must be called from a Server Action.
 */
export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE);
}
