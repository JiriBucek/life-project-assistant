/**
 * Create (or re-password) a user.
 *
 *   npm run user:add -- jiri@example.com "a good password" "Jiri Bucek"
 *
 * Accounts are made by hand while LUMA is a proof of concept — there is no
 * public sign-up. Re-running with an existing email sets a new password, which
 * doubles as the password-reset tool.
 *
 * Imports the app's own hashing so the two can never drift apart.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword, normalizeEmail } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const [rawEmail, password, ...nameParts] = process.argv.slice(2);

  if (!rawEmail || !password) {
    console.error(
      'Usage: npm run user:add -- <email> <password> [name]\n' +
        '   e.g. npm run user:add -- jiri@example.com "correct horse battery" "Jiri"',
    );
    process.exit(1);
  }

  const email = normalizeEmail(rawEmail);
  if (!email.includes("@")) {
    console.error(`"${rawEmail}" doesn't look like an email address.`);
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Choose a password of at least 8 characters.");
    process.exit(1);
  }

  const name = nameParts.join(" ").trim();
  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({ where: { email } });

  const user = await prisma.user.upsert({
    where: { email },
    // An existing account keeps its name unless a new one was given.
    update: { passwordHash, ...(name ? { name } : {}) },
    create: { email, name, passwordHash },
  });

  console.log(
    existing
      ? `Updated the password for ${user.email} (${user.id}).`
      : `Created ${user.email} (${user.id}). They can sign in now — their life map starts empty.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
