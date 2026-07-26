/**
 * Create invited accounts from an environment variable.
 *
 *   INVITE_USERS="ana@example.com:her-password,ben@example.com:his-password"
 *
 * LUMA has no public sign-up, and the hosted database isn't reachable from a
 * laptop, so this is how someone gets an account on the deployed app: add them
 * to INVITE_USERS and redeploy. It runs as part of the production build.
 *
 * Two deliberate properties:
 *
 *   - **Create-only.** An account that already exists is left completely alone.
 *     A deploy must never silently change how someone signs in, so changing a
 *     password here does nothing — use `npm run user:add` for that.
 *   - **Idempotent.** Running it on every build is a no-op once the accounts
 *     exist, and it never touches anybody's data.
 *
 * New accounts start with an empty life map, which is what an invitee should
 * see. Passwords are visible to anyone who can read the project's environment
 * variables — fine for a proof of concept, not a long-term arrangement.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword, normalizeEmail } from "../src/lib/password";

const prisma = new PrismaClient();

type Invite = { email: string; password: string };

/** `a@b.com:pw,c@d.com:pw` → invites. Tolerates spaces and trailing commas. */
export function parseInvites(raw: string): Invite[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      // Split on the FIRST colon only — a password may well contain one.
      const at = entry.indexOf(":");
      if (at < 1) {
        throw new Error(
          `"${entry}" is not in the expected email:password form.`,
        );
      }
      const email = normalizeEmail(entry.slice(0, at));
      const password = entry.slice(at + 1);
      if (!email.includes("@")) {
        throw new Error(`"${email}" doesn't look like an email address.`);
      }
      if (password.length < 8) {
        throw new Error(`The password for ${email} is too short (min 8).`);
      }
      return { email, password };
    });
}

async function main() {
  const raw = process.env.INVITE_USERS;
  if (!raw?.trim()) {
    console.log("[provision] INVITE_USERS not set — nothing to do.");
    return;
  }

  const invites = parseInvites(raw);
  const created: string[] = [];
  const existing: string[] = [];

  for (const { email, password } of invites) {
    const already = await prisma.user.findUnique({ where: { email } });
    if (already) {
      existing.push(email);
      continue;
    }
    await prisma.user.create({
      data: { email, name: "", passwordHash: await hashPassword(password) },
    });
    created.push(email);
  }

  if (created.length) console.log(`[provision] created: ${created.join(", ")}`);
  if (existing.length) {
    console.log(
      `[provision] already existed, left untouched: ${existing.join(", ")}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(`[provision] ${error.message ?? error}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
