import type { CurrentUser } from "@/lib/auth";

// The shared showcase account. It reads the forum like everyone else, but it
// never writes to it — it is effectively public access, and the forum belongs
// to real members.
const DEMO_EMAIL = "demo@luma.local";

/**
 * The admin — identified by the ADMIN_EMAIL environment variable. Admin
 * replies render as LUMA (sun-headed avatar, no personal name), and
 * moderation (deleting posts, stamping idea statuses) unlocks.
 */
export function isAdmin(user: CurrentUser): boolean {
  const admin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return !!admin && user.email === admin;
}

/** Whether this account may post, reply and vote (the admin always may). */
export function canWrite(user: CurrentUser): boolean {
  return isAdmin(user) || user.email !== DEMO_EMAIL;
}
