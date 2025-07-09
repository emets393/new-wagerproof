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