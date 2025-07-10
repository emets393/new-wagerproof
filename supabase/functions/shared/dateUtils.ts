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