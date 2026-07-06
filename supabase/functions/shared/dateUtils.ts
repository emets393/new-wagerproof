import { format } from "https://esm.sh/date-fns@3.6.0";
import { toZonedTime } from "https://esm.sh/date-fns-tz@3.0.0";

/**
 * Get today's date in Eastern Time (ET) formatted as YYYY-MM-DD
 * This ensures consistent date handling across all Supabase functions
 * regardless of server timezone
 */
export function getTodayInET(): string {
  const now = new Date();
  const easternTime = toZonedTime(now, 'America/New_York');
  return format(easternTime, 'yyyy-MM-dd');
}

/**
 * Get a specific date in Eastern Time (ET) formatted as YYYY-MM-DD
 * Useful for date calculations and comparisons
 */
export function getDateInET(date: Date): string {
  const easternTime = toZonedTime(date, 'America/New_York');
  return format(easternTime, 'yyyy-MM-dd');
}

/**
 * Get a date+time in Eastern Time formatted as YYYY-MM-DDTHH:mm:ss —
 * lexicographically comparable with `${game_date}T${game_time}` strings.
 */
export function getDateTimeInET(date: Date): string {
  const easternTime = toZonedTime(date, 'America/New_York');
  return format(easternTime, "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * Tuesday-anchored football week key (Tue..Mon window) in ET, matching the
 * NFL's Tuesday rollover. MUST stay in lockstep with SQL
 * public.football_week_key(). Returns YYYY-MM-DD (the Tuesday).
 */
export function getFootballWeekKeyET(now: Date = new Date()): string {
  const easternTime = toZonedTime(now, 'America/New_York');
  // Sun=0..Sat=6; Tue=2 → (day+5)%7 = days since Tuesday.
  easternTime.setDate(easternTime.getDate() - ((easternTime.getDay() + 5) % 7));
  return format(easternTime, 'yyyy-MM-dd');
}

/**
 * The football week's final game date (the Monday), i.e. week_key + 6 days.
 * Weekly parlays store this as target_date so date-based history bucketing
 * graduates them only after Monday night.
 */
export function footballWeekFinalDate(weekKey: string): string {
  const d = new Date(`${weekKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Get current date and time info for logging purposes
 */
export function getDateDebugInfo() {
  const now = new Date();
  const easternTime = toZonedTime(now, 'America/New_York');
  const utcTime = now.toISOString();
  const etDate = format(easternTime, 'yyyy-MM-dd');
  const etDateTime = format(easternTime, 'yyyy-MM-dd HH:mm:ss zzz');
  
  return {
    utcTime,
    etDate,
    etDateTime,
    easternTime
  };
}

/**
 * Check if a given date string is today in Eastern Time
 */
export function isTodayInET(dateString: string): boolean {
  return dateString === getTodayInET();
}

/**
 * Get yesterday's date in Eastern Time
 */
export function getYesterdayInET(): string {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const easternTime = toZonedTime(yesterday, 'America/New_York');
  return format(easternTime, 'yyyy-MM-dd');
}

/**
 * Get tomorrow's date in Eastern Time
 */
export function getTomorrowInET(): string {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const easternTime = toZonedTime(tomorrow, 'America/New_York');
  return format(easternTime, 'yyyy-MM-dd');
}

/**
 * Get the current hour in Eastern Time (0-23)
 */
export function getCurrentHourInET(): number {
  const now = new Date();
  const easternTime = toZonedTime(now, 'America/New_York');
  return easternTime.getHours();
} 