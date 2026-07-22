import Link from "next/link";
import { NavTabs, MobileNav } from "@/components/NavTabs";
import { GuideButtons } from "@/components/HowItWorks";

/**
 * The one bar every screen shares: LUMA home link, the two navigation tabs
 * (desktop), and on the right Ellie's welcome plus the how-it-works guide —
 * two separate doors. On phones the tabs move into a fixed bottom bar
 * (rendered here too, so every page gets both for free); the tagline now
 * lives inside the guide.
 */
export function AppHeader() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-5 px-4 md:h-16 md:px-6">
          <Link href="/" className="shrink-0">
            <span className="font-serif text-2xl font-semibold tracking-tight text-ink">
              LUMA
            </span>
          </Link>

          <div className="hidden md:block">
            <NavTabs />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <GuideButtons />
          </div>
        </div>
      </header>
      <MobileNav />
    </>
  );
}
