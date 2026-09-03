"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The four places you can be: the Life Map, the Projects timeline, the
 * Statistics page, and the community Forum. The same destinations render as
 * tabs in the desktop header and as a thumb-height bottom bar on phones —
 * identical order and labels, so navigation never moves around on the user.
 */
const TABS = [
  { href: "/", label: "Life Map", Glyph: MapGlyph },
  { href: "/projects", label: "Projects", Glyph: TimelineGlyph },
  { href: "/statistics", label: "Statistics", Glyph: StatsGlyph },
  { href: "/community", label: "Community", Glyph: ForumGlyph },
] as const;

// "/" only matches exactly; "/projects" also claims its detail pages, so the
// Projects tab stays lit while you're inside a journey.
function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Desktop header tabs — a soft segmented control. */
export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="flex items-center gap-1 rounded-full border border-line bg-paper p-1"
    >
      {TABS.map(({ href, label, Glyph }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${
              active
                ? "bg-sage-tint text-sage-deep"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <Glyph className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone navigation — a fixed bar at the bottom, where thumbs live. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="flex h-14">
        {TABS.map(({ href, label, Glyph }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                active ? "text-sage-deep" : "text-ink-soft"
              }`}
            >
              <Glyph className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** A tiny constellation — nodes and their connections, like the map itself. */
function MapGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
    >
      <circle cx="5" cy="14.5" r="2.2" />
      <circle cx="14.5" cy="5.5" r="2.2" />
      <circle cx="15.5" cy="15" r="1.5" />
      <path d="M6.6 12.9 12.9 7.1" />
      <path d="M7.2 14.6 13.9 14.9" />
    </svg>
  );
}

/** A rising line with an end-dot — the story the statistics tell. */
function StatsGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 15.5 8 10.5l3.5 2.5 5.5-7" />
      <circle
        cx="17"
        cy="6"
        r="1.7"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

/** A speech bubble with a little star — the community talking. */
function ForumGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 5.5 A2 2 0 0 1 5.5 3.5 H14.5 A2 2 0 0 1 16.5 5.5 V11 A2 2 0 0 1 14.5 13 H8.5 L5 16 V13 H5.5 A2 2 0 0 1 3.5 11 Z" />
      <path d="M10 6.2 l0.9 1.7 1.8 0.35 -1.3 1.3 0.3 1.85 -1.7 -0.9 -1.7 0.9 0.3 -1.85 -1.3 -1.3 1.8 -0.35 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Stacked bars — the shared timeline at a glance. */
function TimelineGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden fill="currentColor">
      <rect x="2" y="3.5" width="10" height="3.2" rx="1.6" />
      <rect x="6.5" y="8.4" width="11.5" height="3.2" rx="1.6" />
      <rect x="3.5" y="13.3" width="8" height="3.2" rx="1.6" />
    </svg>
  );
}
