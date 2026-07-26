/**
 * Give the pre-auth data an owner.
 *
 *   npm run db:backfill
 *
 * LUMA began as a single-user app, so the life areas and projects already in
 * the database have no `userId`. This claims every one of those rows for one
 * account — the person whose data it actually is — so nothing is lost when the
 * app becomes multi-user.
 *
 * It is idempotent and runs as part of the production build: once every row has
 * an owner it does nothing at all, so leaving it in the build is harmless.
 *
 * Configured by environment variables:
 *   OWNER_EMAIL     the account that inherits the existing data
 *   OWNER_PASSWORD  only needed if that account doesn't exist yet
 *
 * If there are unowned rows and OWNER_EMAIL is missing, this fails loudly on
 * purpose. Unowned rows are invisible to every user, so a "successful" deploy
 * would look exactly like the data had been deleted — better to stop the build.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword, normalizeEmail } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const [orphanAreas, orphanProjects] = await Promise.all([
    prisma.lifeArea.count({ where: { userId: null } }),
    prisma.project.count({ where: { userId: null } }),
  ]);

  if (orphanAreas === 0 && orphanProjects === 0) {
    console.log("[backfill] every life area and project already has an owner.");
    return;
  }

  const rawEmail = process.env.OWNER_EMAIL;
  if (!rawEmail) {
    throw new Error(
      `Found ${orphanAreas} life area(s) and ${orphanProjects} project(s) with no owner, ` +
        "but OWNER_EMAIL is not set. Set OWNER_EMAIL (and OWNER_PASSWORD if the " +
        "account doesn't exist yet) so this data has somewhere to go — without an " +
        "owner it would be invisible to everyone.",
    );
  }

  const email = normalizeEmail(rawEmail);
  let owner = await prisma.user.findUnique({ where: { email } });

  if (!owner) {
    const password = process.env.OWNER_PASSWORD;
    if (!password) {
      throw new Error(
        `No account for ${email} yet, and OWNER_PASSWORD is not set. ` +
          "Set it so the account can be created, or create the user first with " +
          "`npm run user:add`.",
      );
    }
    owner = await prisma.user.create({
      data: { email, name: "", passwordHash: await hashPassword(password) },
    });
    console.log(`[backfill] created the owner account ${email}.`);
  } else {
    // An existing account keeps its current password — a deploy should never
    // silently change how someone signs in.
    console.log(`[backfill] using the existing account ${email}.`);
  }

  const [areas, projects] = await Promise.all([
    prisma.lifeArea.updateMany({
      where: { userId: null },
      data: { userId: owner.id },
    }),
    prisma.project.updateMany({
      where: { userId: null },
      data: { userId: owner.id },
    }),
  ]);

  console.log(
    `[backfill] ${areas.count} life area(s) and ${projects.count} project(s) now belong to ${email}. ` +
      "Everything beneath them — values, initiatives, epics, reflections — follows its parent.",
  );
}

main()
  .catch((error) => {
    console.error(`[backfill] ${error.message ?? error}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
