"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dummyHash, normalizeEmail, verifyPassword } from "@/lib/password";
import { endSession, startSession } from "@/lib/session";

// `email` is echoed back so a failed attempt doesn't make the user retype it —
// only the password is cleared.
export type LoginState = { error?: string; email?: string };

/**
 * Sign in with email and password.
 *
 * The failure message is deliberately the same whether the address is unknown
 * or the password is wrong, so the form can't be used to discover who has an
 * account. For the same reason an unknown email still runs a password
 * comparison — otherwise the response time alone would give it away.
 */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password.", email };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(
    password,
    user?.passwordHash ?? (await dummyHash()),
  );

  if (!user || !ok) {
    return { error: "That email and password don't match an account.", email };
  }

  await startSession(user.id);
  redirect("/");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}
