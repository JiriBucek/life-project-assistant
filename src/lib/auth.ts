import { cache } from "react";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";

export type CurrentUser = { id: string; email: string; name: string };

/**
 * The Data Access Layer's front door.
 *
 * Every read and every write in the app goes through `requireUser()` and scopes
 * itself to the id it returns — the authorization check lives next to the data,
 * not in the routing layer. `proxy.ts` also redirects signed-out visitors, but
 * that is only a fast path for nicer navigation: server actions are ordinary
 * HTTP endpoints that can be called directly, so they must never rely on it.
 *
 * `cache` memoizes per render pass, so a page that reads the user in three
 * places still costs one session lookup.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  return session?.user ?? null;
});

/**
 * The current user, or a redirect to the login screen. Returning a non-null
 * user means callers can't accidentally forget the signed-out case.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
