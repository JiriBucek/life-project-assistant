"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login, type LoginState } from "@/lib/auth-actions";
import { Button } from "@/components/ui";

const FIELD =
  "w-full rounded-xl border border-line bg-paper-raised px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-ink-faint focus:border-sage focus:ring-2 focus:ring-sage-tint";

/** Disabled and re-labelled while the sign-in is in flight. */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full py-2.5">
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink-soft">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          // Survives a failed attempt — only the password is worth retyping.
          // Keyed so React re-seeds the field when a new state comes back.
          key={state.email}
          defaultValue={state.email}
          placeholder="you@example.com"
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink-soft">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={FIELD}
        />
      </div>

      {state.error ? (
        // aria-live so a screen reader hears the failure without moving focus.
        <p
          role="alert"
          aria-live="polite"
          data-testid="login-error"
          className="rounded-xl bg-clay-tint px-3.5 py-2.5 text-sm text-[#93330a]"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
