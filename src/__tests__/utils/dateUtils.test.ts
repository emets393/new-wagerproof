import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTodayInET,
  getDateInET,
  getDateDebugInfo,
  isTodayInET,
  getYesterdayInET,
  getTomorrowInET,
  formatDateForDisplay,
  getCurrentHourInET,
} from '@/utils/dateUtils';

describe('dateUtils', () => {
  describe('getTodayInET', () => {
    it('returns a date string in YYYY-MM-DD format', () => {
      const result = getTodayInET();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns a valid date', () => {
      const result = getTodayInET();
      const parsed = new Date(result + 'T12:00:00');
      expect(parsed.getTime()).not.toBeNaN();
    });
  });

  describe('getDateInET', () => {
    it('formats a specific date to YYYY-MM-DD in Eastern Time', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const result = getDateInET(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('handles midnight UTC (which may be previous day in ET)', () => {
      // 2024-01-15 at 2am UTC = 2024-01-14 at 9pm ET
      const date = new Date('2024-01-15T02:00:00Z');
      const result = getDateInET(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getDateDebugInfo', () => {
    it('returns all required debug fields', () => {
      const info = getDateDebugInfo();
      expect(info).toHaveProperty('utcTime');
      expect(info).toHaveProperty('localTime');
      expect(info).toHaveProperty('etDate');
      expect(info).toHaveProperty('etDateTime');
      expect(info).toHaveProperty('easternTime');
    });

    it('utcTime is in ISO format', () => {
      const info = getDateDebugInfo();
      expect(info.utcTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('etDate is in YYYY-MM-DD format', () => {
      const info = getDateDebugInfo();
      expect(info.etDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('isTodayInET', () => {
    it('returns true for today\'s date in ET', () => {
      const today = getTodayInET();
      expect(isTodayInET(today)).toBe(true);
    });

    it('returns false for a past date', () => {
      expect(isTodayInET('2020-01-01')).toBe(false);
    });

    it('returns false for a future date', () => {
      expect(isTodayInET('2099-12-31')).toBe(false);
    });
  });

  describe('getYesterdayInET', () => {
    it('returns a date string in YYYY-MM-DD format', () => {
      const result = getYesterdayInET();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns a date before today', () => {
      const yesterday = getYesterdayInET();
      const today = getTodayInET();
      expect(yesterday < today).toBe(true);
    });
  });

  describe('getTomorrowInET', () => {
    it('returns a date string in YYYY-MM-DD format', () => {
      const result = getTomorrowInET();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns a date after today', () => {
      const tomorrow = getTomorrowInET();
      const today = getTodayInET();
      expect(tomorrow > today).toBe(true);
    });
  });

  describe('formatDateForDisplay', () => {
    it('formats a date with day of week, month, day, and year', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const result = formatDateForDisplay(date);
      // Should contain "Monday" or the day, "January", "15", "2024"
      expect(result).toMatch(/\w+,\s+\w+\s+\d+,\s+\d{4}/);
    });
  });

  describe('getCurrentHourInET', () => {
    it('returns a number between 0 and 23', () => {
      const hour = getCurrentHourInET();
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThanOrEqual(23);
    });

    it('returns an integer', () => {
      const hour = getCurrentHourInET();
      expect(Number.isInteger(hour)).toBe(true);
    });
  });

  describe('date consistency', () => {
    it('yesterday < today < tomorrow', () => {
      const yesterday = getYesterdayInET();
      const today = getTodayInET();
      const tomorrow = getTomorrowInET();
      expect(yesterday < today).toBe(true);
      expect(today < tomorrow).toBe(true);
    });
  });
});
