import type { Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { hashPassword, normalizeEmail } from "../src/lib/password";
import { SESSION_COOKIE } from "../src/lib/session-cookie";
import { PORT } from "../playwright.config";

/**
 * Test-suite authentication.
 *
 * Every page in the app now requires a signed-in user, so each test has to
 * start as somebody. Rather than driving the login form 12 times — slow, and it
 * would test sign-in over and over instead of the thing under test — this mints
 * a session straight into the database and hands the browser the cookie. The
 * login form itself is covered properly in auth.spec.ts.
 */

// The same test database the app under test uses (relative to prisma/).
export const prisma = new PrismaClient({
  datasources: { db: { url: "file:./test.db" } },
});

export { SESSION_COOKIE };
const ORIGIN = `http://localhost:${PORT}`;

export type TestUser = { email: string; password: string; name?: string };

export const DEFAULT_USER: TestUser = {
  email: "tester@luma.local",
  password: "test-password",
  name: "Tester",
};

/** Create (or reset) an account, returning its id. */
export async function createUser(user: TestUser): Promise<string> {
  const email = normalizeEmail(user.email);
  const passwordHash = await hashPassword(user.password);
  const row = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name: user.name ?? "" },
    create: { email, passwordHash, name: user.name ?? "" },
  });
  return row.id;
}

/**
 * Wipe every account and all their data — the "completely new install" the
 * acceptance spec starts from. Deleting users cascades to their life areas and
 * projects, and from there to values, initiatives, tasks and reflections.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.user.deleteMany();
  // Anything left over would be pre-auth data with no owner; clear it too so a
  // failed run can't leak rows into the next one.
  await prisma.reflection.deleteMany();
  await prisma.task.deleteMany();
  await prisma.initiative.deleteMany();
  await prisma.project.deleteMany();
  await prisma.value.deleteMany();
  await prisma.lifeArea.deleteMany();
}

/** Give this browser a valid session for `userId`, without visiting /login. */
export async function attachSession(page: Page, userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: token,
      url: ORIGIN,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** Create a user and sign this browser in as them. Returns the user id. */
export async function signInAs(
  page: Page,
  user: TestUser = DEFAULT_USER,
): Promise<string> {
  const userId = await createUser(user);
  await attachSession(page, userId);
  return userId;
}
