/**
 * Fill a showcase account with an example life map.
 *
 *   SHOWCASE_EMAIL=tester@example.com npm run db:showcase
 *
 * This exists because the hosted database isn't reachable from a laptop, so a
 * demo account can't be filled by hand. It runs as part of the production build
 * and is deliberately cautious:
 *
 *   - It only touches the one account named by SHOWCASE_EMAIL.
 *   - It only fills an account whose map is **empty**, so anything done during
 *     a demo survives the next deploy rather than being wiped by it.
 *   - Unset SHOWCASE_EMAIL and it does nothing at all.
 *
 * To deliberately reset the account to a pristine map, pass SHOWCASE_RESET=1.
 */
import { PrismaClient } from "@prisma/client";
import { normalizeEmail } from "../src/lib/password";
import { buildSampleMap } from "../prisma/sample-map";

const prisma = new PrismaClient();

async function main() {
  const raw = process.env.SHOWCASE_EMAIL;
  if (!raw?.trim()) {
    console.log("[showcase] SHOWCASE_EMAIL not set — nothing to do.");
    return;
  }

  const email = normalizeEmail(raw);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(
      `No account for ${email}. Create it first — add it to INVITE_USERS, or ` +
        "run `npm run user:add` locally.",
    );
  }

  const existing = await prisma.lifeArea.count({ where: { userId: user.id } });
  const reset = process.env.SHOWCASE_RESET === "1";

  if (existing > 0 && !reset) {
    console.log(
      `[showcase] ${email} already has ${existing} life area(s) — leaving it alone. ` +
        "Set SHOWCASE_RESET=1 to rebuild it from scratch.",
    );
    return;
  }

  if (existing > 0) {
    // Scoped to this account only. Deleting its areas and projects cascades to
    // values, initiatives, epics and reflections.
    await prisma.project.deleteMany({ where: { userId: user.id } });
    await prisma.lifeArea.deleteMany({ where: { userId: user.id } });
    console.log(`[showcase] cleared the previous map for ${email}.`);
  }

  const { areas, projects } = await buildSampleMap(prisma, user.id);
  console.log(
    `[showcase] filled ${email} with ${areas} life areas and ${projects} projects.`,
  );
}

main()
  .catch((error) => {
    console.error(`[showcase] ${error.message ?? error}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
