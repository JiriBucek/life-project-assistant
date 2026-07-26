/**
 * Ownership, expressed as query filters.
 *
 * Server Actions are ordinary HTTP endpoints — anyone can POST
 * `deleteProject("<some id>")`. Scoping only the reads would still leave every
 * write wide open, so each of the 22 actions must prove the row it touches
 * belongs to the caller.
 *
 * Rather than 22 hand-written `if` checks (22 chances to forget one), the proof
 * lives inside the query: Prisma lets a `where` combine the unique `id` with a
 * filter across relations, so "update this epic" becomes "update this epic **if
 * it hangs off one of my projects**" in a single statement. A wrong owner
 * matches nothing and the write simply never happens.
 *
 * The whole ownership tree is therefore visible in this one file:
 *
 *   User ─┬─ LifeArea ─┬─ Value ── (many-to-many) ── Project
 *         │            └─ SatisfactionEntry
 *         └─ Project ──┬─ Initiative ── Epic
 *                      └─ Reflection
 */

export const owned = {
  /** A life area is owned directly. */
  area: (id: string, userId: string) => ({ id, userId }),

  /** A value belongs to whoever owns its life area. */
  value: (id: string, userId: string) => ({ id, area: { userId } }),

  /** A project is owned directly. */
  project: (id: string, userId: string) => ({ id, userId }),

  /** An initiative belongs to whoever owns its project. */
  initiative: (id: string, userId: string) => ({ id, project: { userId } }),

  /** An epic is two hops from its owner: epic → initiative → project. */
  epic: (id: string, userId: string) => ({
    id,
    initiative: { project: { userId } },
  }),

  /** A reflection belongs to whoever owns its project. */
  reflection: (id: string, userId: string) => ({ id, project: { userId } }),
};

/**
 * Prisma's "record to update/delete not found" code.
 *
 * With the filters above, this is what a request for someone else's row — or a
 * row that has genuinely been deleted — comes back as. Actions treat it as a
 * no-op, matching how the app already ignores writes to records that vanished,
 * while any other error still surfaces.
 */
export function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2025"
  );
}

/**
 * Run a scoped write, treating "not yours / not there" as nothing to do.
 * Returns the result, or null when the row wasn't the caller's to touch.
 */
export async function ifOwned<T>(write: Promise<T>): Promise<T | null> {
  try {
    return await write;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}
