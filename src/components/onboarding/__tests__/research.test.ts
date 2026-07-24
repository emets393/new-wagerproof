import { describe, expect, it } from 'vitest';
import {
  researchTimeEstimates,
  stakesEstimates,
  money,
  resolveResearchTimeBucket,
  resolveStakesBucket,
} from '../research';

// Expected values precomputed from the iOS ResearchTime.swift implementation —
// web and iOS must show identical numbers.
describe('researchTimeEstimates', () => {
  const expected = {
    lt30m: { daysThisYear: 8, yearsOfLife: 1, reclaimYears: 1, reclaimHoursPerWeek: 3 },
    m30to60: { daysThisYear: 11, yearsOfLife: 2, reclaimYears: 1, reclaimHoursPerWeek: 4 },
    h1to2: { daysThisYear: 23, yearsOfLife: 4, reclaimYears: 3, reclaimHoursPerWeek: 8 },
    h2to3: { daysThisYear: 38, yearsOfLife: 7, reclaimYears: 5, reclaimHoursPerWeek: 13 },
    h3to4: { daysThisYear: 53, yearsOfLife: 10, reclaimYears: 7, reclaimHoursPerWeek: 18 },
    h4plus: { daysThisYear: 76, yearsOfLife: 14, reclaimYears: 10, reclaimHoursPerWeek: 26 },
    unknown: { daysThisYear: 23, yearsOfLife: 4, reclaimYears: 3, reclaimHoursPerWeek: 8 },
  } as const;

  for (const [bucket, values] of Object.entries(expected)) {
    it(`matches iOS for ${bucket}`, () => {
      expect(researchTimeEstimates(bucket as keyof typeof expected)).toEqual(values);
    });
  }
});

describe('stakesEstimates', () => {
  const expected = {
    lt50: { yearlyAction: 1300, lifetimeAction: 60000 },
    h50to150: { yearlyAction: 5200, lifetimeAction: 240000 },
    h150to400: { yearlyAction: 13000, lifetimeAction: 600000 },
    h400to1000: { yearlyAction: 33800, lifetimeAction: 1550000 },
    h1000plus: { yearlyAction: 78000, lifetimeAction: 3590000 },
    unknown: { yearlyAction: 7800, lifetimeAction: 360000 },
  } as const;

  for (const [bucket, values] of Object.entries(expected)) {
    it(`matches iOS for ${bucket}`, () => {
      expect(stakesEstimates(bucket as keyof typeof expected)).toEqual(values);
    });
  }

  it('formats money with thousands separators', () => {
    expect(money(1550000)).toBe('$1,550,000');
  });
});

describe('bucket resolution', () => {
  it('falls back to unknown', () => {
    expect(resolveResearchTimeBucket('bogus')).toBe('unknown');
    expect(resolveResearchTimeBucket(undefined)).toBe('unknown');
    expect(resolveStakesBucket(null)).toBe('unknown');
    expect(resolveStakesBucket('h1000plus')).toBe('h1000plus');
  });
});
