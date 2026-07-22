"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { JourneyGuide } from "@/components/JourneyGuide";
import { EllieAvatar } from "@/components/EllieAvatar";

const OPEN_EVENT = "ellie:open-journey-guide";

/**
 * Open the journey guide from anywhere else in the app (e.g. the empty-map
 * "New here?" hint) without threading state across the page.
 */
export function openJourneyGuide() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * The header's two companions, deliberately separate doors:
 *  - Ellie herself is the Welcome button — her greeting, the warm words that
 *    used to open the home page.
 *  - The glowing "how this works" pill holds the concept — the rising-spiral
 *    diagram.
 * Both open as full-screen sheets on phones and centered cards on desktop,
 * portalled to <body> (the header's backdrop blur would otherwise trap a
 * fixed overlay inside the header's own box).
 */
export function GuideButtons() {
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setGuideOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  return (
    <>
      {/* Ellie waves you in — tap her for the welcome */}
      <button
        onClick={() => setWelcomeOpen(true)}
        aria-label="Welcome from Ellie"
        className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-paper-raised px-1 text-sm font-medium tracking-wide text-ink transition hover:border-sage hover:text-sage-deep md:h-auto md:py-1 md:pl-1.5 md:pr-3.5"
      >
        <span aria-hidden className="block">
          <EllieAvatar className="w-7" />
        </span>
        <span className="hidden md:inline" aria-hidden>
          WELCOME
        </span>
      </button>

      <button
        onClick={() => setGuideOpen(true)}
        aria-label="How this works"
        className="ellie-invite flex h-9 w-9 items-center justify-center rounded-full border border-periwinkle bg-paper-raised text-base font-medium text-ink transition hover:text-sage-deep md:h-auto md:w-auto md:px-4 md:py-1.5 md:text-sm md:tracking-wide"
      >
        <span className="md:hidden" aria-hidden>
          ?
        </span>
        <span className="hidden md:inline" aria-hidden>
          HOW THIS WORKS?
        </span>
      </button>

      {welcomeOpen && (
        <Overlay
          testid="welcome-note"
          closeLabel="Close welcome"
          maxW="md:max-w-xl"
          onClose={() => setWelcomeOpen(false)}
        >
          <div className="flex items-start gap-5 pr-8">
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">
                Hi, I’m glad you’re here!
                {/* The tiny constellation in place of the period — scattered,
                    twinkling out of step so it feels alive but calm. */}
                <span
                  aria-hidden
                  className="relative ml-3 inline-block h-6 w-12 align-baseline"
                >
                  <span className="ellie-twinkle absolute bottom-1 left-0 text-base leading-none text-sage">
                    ✦
                  </span>
                  <span
                    className="ellie-twinkle absolute -top-2 left-4 text-[11px] leading-none text-sage"
                    style={{ animationDelay: "1.1s" }}
                  >
                    ✧
                  </span>
                  <span
                    className="ellie-twinkle absolute bottom-0 left-7 text-[13px] leading-none text-clay"
                    style={{ animationDelay: "2.1s" }}
                  >
                    ⋆
                  </span>
                  <span
                    className="ellie-twinkle absolute -top-0.5 left-10 text-[9px] leading-none text-sage"
                    style={{ animationDelay: "0.5s" }}
                  >
                    ✧
                  </span>
                </span>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                This is where your thoughts come together and grow into
                beautiful plans. Shape them with intention, connect them to
                your values, and build a life that reflects what truly matters
                to you.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Start with a life area or create your first project. There is
                no right place to begin—only the one that feels right to you.
              </p>
            </div>
            <EllieAvatar className="ellie-rise w-20 shrink-0 sm:w-24" />
          </div>
        </Overlay>
      )}

      {guideOpen && (
        <Overlay
          testid="journey-guide"
          closeLabel="Close guide"
          maxW="md:max-w-3xl"
          onClose={() => setGuideOpen(false)}
        >
          <div className="pr-8">
            <h2 className="font-serif text-xl font-medium text-ink">
              How LUMA works{" "}
              <span aria-hidden className="ellie-twinkle text-sm text-sage">
                ✦
              </span>
            </h2>
            <p className="mt-0.5 text-xs tracking-wide text-ink-faint">
              Life Unfolds through Meaningful Action
            </p>
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            Every project is one turn of a rising spiral.
            <br />
            You come back around to where you started, but never at the same
            height.
          </p>
          <div className="mt-4">
            <JourneyGuide />
          </div>
        </Overlay>
      )}
    </>
  );
}

/** Shared overlay shell: full-screen on phones, a centered card from md up. */
function Overlay({
  testid,
  closeLabel,
  maxW,
  onClose,
  children,
}: {
  testid: string;
  closeLabel: string;
  maxW: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4">
      <div
        className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        data-testid={testid}
        className={`ellie-rise relative flex h-full w-full flex-col bg-paper-raised shadow-xl md:h-auto md:max-h-[92vh] md:rounded-2xl md:border md:border-line ${maxW}`}
      >
        <button
          aria-label={closeLabel}
          onClick={onClose}
          className="absolute right-4 top-4 z-10 p-1 text-ink-faint transition hover:text-ink"
        >
          ✕
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
