import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * Get today's date in Eastern Time (ET) formatted as YYYY-MM-DD
 * This ensures consistent date handling between frontend and backend
 * regardless of user's local timezone or server timezone
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
  const localTime = now.toLocaleString();
  const etDate = format(easternTime, 'yyyy-MM-dd');
  const etDateTime = format(easternTime, 'yyyy-MM-dd HH:mm:ss zzz');
  
  return {
    utcTime,
    localTime,
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
 * Format a date for display in Eastern Time
 */
export function formatDateForDisplay(date: Date): string {
  const easternTime = toZonedTime(date, 'America/New_York');
  return format(easternTime, 'EEEE, MMMM d, yyyy');
}

/**
 * Get the current hour in Eastern Time (0-23)
 */
export function getCurrentHourInET(): number {
  const now = new Date();
  const easternTime = toZonedTime(now, 'America/New_York');
  return easternTime.getHours();
}