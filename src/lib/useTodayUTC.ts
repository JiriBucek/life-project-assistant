"use client";

import { useSyncExternalStore } from "react";
import { todayUTC } from "@/lib/timeline";

// "Today" is a client-only value: rendering it during SSR would risk a
// hydration mismatch. useSyncExternalStore gives us exactly that contract —
// the server snapshot is null, and the client swaps in the real date after
// hydration. The snapshot is cached so its identity stays stable (a fresh
// Date each call would make React loop).
let cached: Date | null = null;

const subscribe = () => () => {};
const getSnapshot = (): Date => (cached ??= todayUTC());
const getServerSnapshot = (): Date | null => null;

/** The current day at UTC midnight on the client, or null during SSR/first paint. */
export function useTodayUTC(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
