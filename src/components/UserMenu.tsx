import { logout } from "@/lib/auth-actions";
import { getCurrentUser } from "@/lib/auth";

/**
 * Who you're signed in as, and the way out. A plain form posting to a server
 * action — sign-out needs no client JavaScript.
 *
 * The name is hidden on phones, where header space belongs to navigation.
 */
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  const label = user.name || user.email;

  return (
    <div className="flex items-center gap-2">
      <span
        className="hidden max-w-[14ch] truncate text-sm text-ink-soft lg:inline"
        title={user.email}
      >
        {label}
      </span>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-full px-3.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-line/60 hover:text-ink"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
