import { EllieAvatar } from "@/components/EllieAvatar";
import { HowItWorks } from "@/components/HowItWorks";

/**
 * The warm greeting at the top of the home page. Pure content — no controls,
 * no borders-as-boxes — so it reads as a companion's welcome, not a dashboard
 * widget. The star glyphs are text dingbats (not emoji), tinted to the app's
 * palette. Ellie's avatar sits to the right, head slowly turning.
 */
export function WelcomeHero() {
  return (
    <section
      className="border-b border-line py-7 md:py-8"
      style={{
        background:
          "radial-gradient(50rem 20rem at 15% -6rem, var(--gold-tint), transparent 70%)",
      }}
    >
      {/* Same container as the header (max-w + px inside), so the text edge
          matches the logo exactly. Each line rises in a beat after the last,
          so the greeting feels like it breathes in rather than popping on. */}
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-8 px-6">
        <div className="min-w-0 flex-1">
        <h1 className="ellie-rise font-serif text-2xl font-medium tracking-tight text-ink md:text-3xl">
          Hi, I’m glad you’re here!
          {/* A tiny constellation in place of the period — scattered, varied
              sizes, twinkling out of step so it feels alive but calm. */}
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
        </h1>
        <p
          className="ellie-rise mt-3 max-w-3xl text-lg leading-relaxed text-ink-soft"
          style={{ animationDelay: "0.1s" }}
        >
          This is where your thoughts come together and grow into beautiful
          plans. Shape them with intention, connect them to your values, and
          build a life that reflects what truly matters to you.
        </p>
        <p
          className="ellie-rise mt-2 max-w-3xl text-lg leading-relaxed text-ink-soft"
          style={{ animationDelay: "0.2s" }}
        >
          Start with a life area or create your first project. There is no
          right place to begin—only the one that feels right to you.
        </p>
        </div>

        {/* Ellie herself, watching over the page — and offering the tour */}
        <div className="flex shrink-0 flex-col items-center gap-3">
          <EllieAvatar className="ellie-rise hidden w-24 md:block lg:w-28" />
          <HowItWorks />
        </div>
      </div>
    </section>
  );
}
