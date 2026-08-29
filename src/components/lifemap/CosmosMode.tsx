"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Cosmos mode: the switch lives on the Life Map, but the mode belongs to the
 * whole app — toggling stamps `data-cosmos` on <html>, so every page picks up
 * the dark starlit token skin from globals.css. The choice is remembered per
 * browser, and an inline script in the root layout re-applies it before first
 * paint on the next visit.
 */
export function CosmosMode({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);

  // The pre-paint script has already stamped <html>; mirror it after mount.
  useEffect(() => {
    setOn(document.documentElement.hasAttribute("data-cosmos"));
  }, []);

  const toggle = () => {
    setOn((prev) => {
      const next = !prev;
      localStorage.setItem("cosmos-mode", next ? "1" : "0");
      if (next) document.documentElement.setAttribute("data-cosmos", "");
      else document.documentElement.removeAttribute("data-cosmos");
      return next;
    });
  };

  return (
    <div className="flex h-dvh flex-col bg-paper pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      {children}
      <button
        onClick={toggle}
        aria-pressed={on}
        aria-label={on ? "Leave cosmos mode" : "Enter cosmos mode"}
        title={on ? "Back to daylight" : "See your map among the stars"}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper-raised text-ink-soft shadow-md backdrop-blur transition hover:text-ink md:bottom-6 md:right-6"
      >
        {on ? <SunGlyph className="h-5 w-5" /> : <StarsGlyph className="h-5 w-5" />}
      </button>
    </div>
  );
}

/** A big star with two companions — the way in. */
function StarsGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden fill="currentColor">
      <path d="M10 3l1.55 3.9L15.5 8.4l-3.95 1.5L10 13.8 8.45 9.9 4.5 8.4l3.95-1.5L10 3z" />
      <circle cx="16" cy="14.5" r="1.1" />
      <circle cx="5" cy="15.5" r="0.9" />
    </svg>
  );
}

/** The sun — the way back to daylight. */
function SunGlyph({ className = "" }: { className?: string }) {
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
      <circle cx="10" cy="10" r="3.4" fill="currentColor" stroke="none" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4" />
    </svg>
  );
}
