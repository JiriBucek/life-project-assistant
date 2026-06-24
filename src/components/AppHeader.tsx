import Link from "next/link";

export function AppHeader({
  crumb,
}: {
  crumb?: { label: string; href?: string }[];
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-serif text-2xl font-semibold tracking-tight text-ink">
            Ellie
          </span>
          <span className="hidden text-xs text-ink-faint sm:inline">
            your life, intentionally planned
          </span>
        </Link>

        {crumb && crumb.length > 0 && (
          <nav className="flex items-center gap-2 text-sm text-ink-soft">
            {crumb.map((c, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="text-ink-faint">/</span>
                {c.href ? (
                  <Link href={c.href} className="hover:text-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-ink">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
