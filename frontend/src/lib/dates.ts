/** Local-date helpers — never use toISOString() for date fields: it converts
 * to UTC and shifts the date back a day in UTC+ timezones. */

/** Format a Date as YYYY-MM-DD in local time. */
export function localISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Monday of the current week, computed from the user's LOCAL date.
 *
 * Convention: the week is keyed by its Monday, and Sunday is treated as the
 * start of the upcoming week (Sun–Sat boundary). So:
 *   Mon–Sat  → that same week's Monday (0–5 days back)
 *   Sunday   → the next day's Monday (1 day forward)
 *
 * e.g. Sun 2026-10-04 → Mon 2026-10-05; Mon 2026-10-05 → 2026-10-05.
 */
export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay() + 1);
  return localISO(d);
}

/**
 * The Sun–Sat business week for a Monday-keyed `week_start` (YYYY-MM-DD):
 * start = the Sunday BEFORE the keying Monday, end = the following Saturday.
 */
export function businessWeek(weekStartMonday: string): {
  start: Date;
  end: Date;
} {
  const mon = new Date(`${weekStartMonday}T00:00:00`);
  const start = new Date(mon);
  start.setDate(mon.getDate() - 1);
  const end = new Date(mon);
  end.setDate(mon.getDate() + 5);
  return { start, end };
}

/** Short relative time ("2 hours ago" / "قبل ساعتين"), fully localized. */
export function relativeTime(iso: string, language: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
  ];
  for (let i = 0; i < divisions.length; i++) {
    const [seconds, unit] = divisions[i];
    if (abs < seconds) {
      const divisor = i === 0 ? 1 : divisions[i - 1][0];
      return rtf.format(Math.round(diffSec / divisor), unit);
    }
  }
  return rtf.format(Math.round(diffSec / 31557600), "year");
}
