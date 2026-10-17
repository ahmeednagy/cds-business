import type { AttendanceToday } from "../types";

/**
 * Required working hours per day. There is no working-hours configuration in
 * the project yet — this is the single centralized default so it can later be
 * sourced from settings without hunting down magic numbers.
 */
export const REQUIRED_DAILY_HOURS = 8;

/**
 * Required working hours per business week — five 8-hour working days
 * (Sun–Thu) inside the Sun–Sat business week. Same centralized-default status
 * as REQUIRED_DAILY_HOURS until working-hours configuration exists.
 */
export const REQUIRED_WEEKLY_HOURS = REQUIRED_DAILY_HOURS * 5;

/**
 * Total seconds worked today: server-computed `worked_seconds` for completed
 * sessions plus the live elapsed time of the open session (if any).
 */
export function workedSecondsToday(
  today: AttendanceToday | undefined,
  now = new Date(),
): number {
  if (!today) return 0;
  const sessions = [...today.sessions];
  if (today.active && !sessions.some((s) => s.id === today.active!.id)) {
    sessions.push(today.active);
  }
  return sessions.reduce((sum, s) => {
    if (s.worked_seconds != null) return sum + s.worked_seconds;
    const end = s.check_out_at ? new Date(s.check_out_at) : now;
    return sum + Math.max(0, (end.getTime() - new Date(s.check_in_at).getTime()) / 1000);
  }, 0);
}
