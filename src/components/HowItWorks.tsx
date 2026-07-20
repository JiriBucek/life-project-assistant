"use client";

import { useEffect, useState } from "react";
import { JourneyGuide } from "@/components/JourneyGuide";

const OPEN_EVENT = "ellie:open-journey-guide";

/**
 * Open the journey guide from anywhere else in the app (e.g. the empty-map
 * "New here?" hint) without threading state across the page.
 */
export function openJourneyGuide() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * The glowing "How this works" button plus the journey-road overlay it opens.
 * Self-contained so it can live in the welcome hero (next to Ellie's avatar)
 * while other corners of the page can still summon the same guide.
 */
export function HowItWorks() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ellie-invite rounded-full border border-periwinkle bg-paper-raised px-4 py-1.5 text-sm font-medium tracking-wide text-ink transition hover:text-sage-deep"
      >
        HOW THIS WORKS?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div
            data-testid="journey-guide"
            className="ellie-rise relative w-full max-w-3xl rounded-2xl border border-line bg-paper-raised p-6 shadow-xl"
          >
            <button
              aria-label="Close guide"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-ink-faint transition hover:text-ink"
            >
              ✕
            </button>
            <h2 className="font-serif text-xl font-medium text-ink">
              How LUMA works
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Every project is one turn of a rising spiral.
              <br />
              You come back around to where you started, but never at the same
              height.
            </p>
            <div className="mt-4">
              <JourneyGuide />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
