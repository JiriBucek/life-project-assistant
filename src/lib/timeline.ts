// Timeline date math for the Project Journey.
//
// The whole timeline is anchored to a project's Start Date and measured in
// whole days. We treat every date as "date-only" at UTC midnight so day
// arithmetic never drifts across timezones or DST — the same offset always
// maps to the same calendar day on the server and in the browser.

export const MS_PER_DAY = 86_400_000;

/** Normalize any Date/ISO value to UTC midnight of that calendar day. */
export function toUTCDay(value: Date | string): Date {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/** Today at UTC midnight. Call only on the client (depends on "now"). */
export function todayUTC(): Date {
  return toUTCDay(new Date());
}

/** Whole days from `a` to `b` (positive when b is later). */
export function dayDiff(a: Date | string, b: Date | string): number {
  return Math.round((toUTCDay(b).getTime() - toUTCDay(a).getTime()) / MS_PER_DAY);
}

/** A new UTC-midnight date `n` days after `base`. */
export function addDays(base: Date | string, n: number): Date {
  return new Date(toUTCDay(base).getTime() + n * MS_PER_DAY);
}

/** `yyyy-mm-dd` for <input type="date"> and stable keys. */
export function toDateInputValue(value: Date | string): string {
  return toUTCDay(value).toISOString().slice(0, 10);
}

/** Parse a `yyyy-mm-dd` (date input) into a UTC-midnight Date. */
export function fromDateInputValue(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** The project's span in days — always at least 1 so it can be drawn/divided. */
export function durationDays(start: Date | string, target: Date | string): number {
  return Math.max(1, dayDiff(start, target));
}

// A fixed locale for the timeline's structural labels. These render during SSR
// (unlike the mount-gated Today marker), so resolving to the runtime's default
// locale would risk a server/client hydration mismatch — pin it.
const LABEL_LOCALE = "en-US";

/** Short label, e.g. "Jun 28" or "Jun 28, 2026". */
export function formatDay(value: Date | string, withYear = false): string {
  return toUTCDay(value).toLocaleDateString(LABEL_LOCALE, {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

/** A calm, human sense of length, e.g. "12 weeks" or "about 4 months". */
export function humanDuration(days: number): string {
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 70) {
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  if (days < 365) {
    const months = Math.round(days / 30.4);
    return `about ${months} month${months === 1 ? "" : "s"}`;
  }
  const years = Math.round((days / 365) * 10) / 10;
  const display = Number.isInteger(years) ? `${years}` : years.toFixed(1);
  return `about ${display} year${years === 1 ? "" : "s"}`;
}

export type TimelineScale = {
  unit: "week" | "month";
  /** Horizontal pixels per day — tuned so each unit reads at a comfortable width. */
  pxPerDay: number;
};

// Short journeys are easiest to read in weeks; longer ones get noisy that way,
// so they step up to months. ~17 weeks is the changeover.
const WEEK_SCALE_MAX_DAYS = 119;

/** Pick the timeline's unit + density purely from how long the project is. */
export function pickScale(totalDays: number): TimelineScale {
  return totalDays <= WEEK_SCALE_MAX_DAYS
    ? { unit: "week", pxPerDay: 13 } // a week ≈ 91px
    : { unit: "month", pxPerDay: 4 }; // a month ≈ 120px
}

export type Gridline = {
  /** Days from the project start (can be 0 for the start edge). */
  dayOffset: number;
  label: string;
  /** First line of a new year (or the very first line) — render its year. */
  major: boolean;
};

/**
 * Gridlines across the project span, labelled with real dates so the timeline
 * gives temporal context rather than abstract "Week 1, 2, 3…".
 *
 * - week scale: a line every 7 days from the start.
 * - month scale: a line on the start, then the 1st of each following month.
 */
export function buildGridlines(
  start: Date | string,
  totalDays: number,
  scale: TimelineScale,
): Gridline[] {
  const startDay = toUTCDay(start);
  const lines: Gridline[] = [];

  if (scale.unit === "week") {
    let prevYear: number | null = null;
    for (let day = 0; day <= totalDays; day += 7) {
      const date = addDays(startDay, day);
      const year = date.getUTCFullYear();
      // "Major" = the first line, or the first line that crosses into a new
      // year — those get bolded and carry the year for disambiguation.
      const major = day === 0 || (prevYear !== null && year !== prevYear);
      lines.push({ dayOffset: day, label: formatDay(date, major), major });
      prevYear = year;
    }
    return lines;
  }

  // Month scale: the start edge, then each subsequent month boundary in range.
  lines.push({
    dayOffset: 0,
    label: monthLabel(startDay, true),
    major: true,
  });
  let cursor = new Date(
    Date.UTC(startDay.getUTCFullYear(), startDay.getUTCMonth() + 1, 1),
  );
  while (dayDiff(startDay, cursor) <= totalDays) {
    const offset = dayDiff(startDay, cursor);
    const isYearStart = cursor.getUTCMonth() === 0;
    lines.push({
      dayOffset: offset,
      label: monthLabel(cursor, isYearStart),
      major: isYearStart,
    });
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
  }
  return lines;
}

function monthLabel(value: Date, withYear: boolean): string {
  return toUTCDay(value).toLocaleDateString(LABEL_LOCALE, {
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}
