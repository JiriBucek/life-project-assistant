import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EllieAvatar } from "@/components/EllieAvatar";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in — LUMA",
};

/**
 * The one page you can reach signed out. Calm and uncluttered, in the same
 * voice as the rest of the app: this is a welcome, not a gate.
 */
export default async function LoginPage() {
  // Already signed in? There's nothing to do here.
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="ellie-rise w-full max-w-[26rem]">
        <div className="flex flex-col items-center text-center">
          <EllieAvatar className="h-20 w-20" />
          <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-ink">
            LUMA
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            Life unfolds through meaningful action.
            <br />
            Sign in to return to your map.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-paper-raised p-6 shadow-sm md:p-7">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-sm text-ink-faint">
          Accounts are created by invitation while LUMA is finding its feet.
        </p>
      </div>
    </main>
  );
}
