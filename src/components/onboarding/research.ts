/**
 * Research-time and stakes math + copy for onboarding — a direct port of the
 * iOS app's ResearchTime.swift so both platforms show identical numbers.
 */

export const WAKING_HOURS_PER_DAY = 16;
export const LIFETIME_HORIZON_YEARS = 46;
export const RECLAIM_FRACTION = 0.75;

// ── Research time ────────────────────────────────────────────────────────────

export const RESEARCH_TIME_BUCKETS = [
  'lt30m',
  'm30to60',
  'h1to2',
  'h2to3',
  'h3to4',
  'h4plus',
  'unknown',
] as const;
export type ResearchTimeBucket = (typeof RESEARCH_TIME_BUCKETS)[number];

interface ResearchTimeInfo {
  label: string;
  hoursPerDay: number;
  echoLine: string;
  replyLine: string;
}

export const RESEARCH_TIME_INFO: Record<ResearchTimeBucket, ResearchTimeInfo> = {
  lt30m: {
    label: '< 30 min',
    hoursPerDay: 0.5,
    echoLine: 'Under half an hour a day.',
    replyLine: "Disciplined. Let's keep it that way.",
  },
  m30to60: {
    label: '30–60 min',
    hoursPerDay: 0.75,
    echoLine: 'Half an hour to an hour a day.',
    replyLine: "Not bad — but that's still real time we can hand back.",
  },
  h1to2: {
    label: '1–2 hours',
    hoursPerDay: 1.5,
    echoLine: 'One to two hours a day.',
    replyLine: 'That adds up faster than it feels. Most of it is the same checks on repeat.',
  },
  h2to3: {
    label: '2–3 hours',
    hoursPerDay: 2.5,
    echoLine: 'Two to three hours a day.',
    replyLine: "That's a part-time habit — scores, lines, and refreshes, over and over.",
  },
  h3to4: {
    label: '3–4 hours',
    hoursPerDay: 3.5,
    echoLine: 'Three to four hours a day.',
    replyLine: "That's a second job you never applied for. Almost all of it is repeatable.",
  },
  h4plus: {
    label: '4+ hours',
    hoursPerDay: 5.0,
    echoLine: 'Four or more hours a day.',
    replyLine: "That's a huge chunk of your day going to the scroll. Let's win it back.",
  },
  unknown: {
    label: 'Honestly, no idea',
    hoursPerDay: 1.5,
    echoLine: 'Honestly, not sure.',
    replyLine: 'Most bettors underestimate it. Score checks and line refreshes add up fast.',
  },
};

export function resolveResearchTimeBucket(raw: string | undefined | null): ResearchTimeBucket {
  return (RESEARCH_TIME_BUCKETS as readonly string[]).includes(raw ?? '')
    ? (raw as ResearchTimeBucket)
    : 'unknown';
}

export interface ResearchTimeEstimates {
  daysThisYear: number;
  yearsOfLife: number;
  reclaimYears: number;
  reclaimHoursPerWeek: number;
}

export function researchTimeEstimates(bucket: ResearchTimeBucket): ResearchTimeEstimates {
  const hpd = RESEARCH_TIME_INFO[bucket].hoursPerDay;
  const yearsExact = (hpd / WAKING_HOURS_PER_DAY) * LIFETIME_HORIZON_YEARS;
  return {
    daysThisYear: Math.round((hpd / 24) * 365),
    yearsOfLife: Math.max(1, Math.round(yearsExact)),
    reclaimYears: Math.max(1, Math.trunc(yearsExact * RECLAIM_FRACTION)),
    reclaimHoursPerWeek: Math.max(1, Math.round(hpd * RECLAIM_FRACTION * 7)),
  };
}

export function yearsWord(n: number): string {
  return n === 1 ? 'year' : 'years';
}

// ── Weekly stakes ────────────────────────────────────────────────────────────

export const STAKES_BUCKETS = [
  'lt50',
  'h50to150',
  'h150to400',
  'h400to1000',
  'h1000plus',
  'unknown',
] as const;
export type StakesBucket = (typeof STAKES_BUCKETS)[number];

interface StakesInfo {
  label: string;
  weeklyDollars: number;
  echoLine: string;
  replyLine: string;
}

export const STAKES_INFO: Record<StakesBucket, StakesInfo> = {
  lt50: {
    label: 'Under $50',
    weeklyDollars: 25,
    echoLine: 'Under $50 a week.',
    replyLine: 'Keeping it light. Still adds up over a year.',
  },
  h50to150: {
    label: '$50–$150',
    weeklyDollars: 100,
    echoLine: 'Around $50 to $150 a week.',
    replyLine: 'A steady habit — bigger over a year than it feels.',
  },
  h150to400: {
    label: '$150–$400',
    weeklyDollars: 250,
    echoLine: 'About $150 to $400 a week.',
    replyLine: 'That adds up faster than it feels.',
  },
  h400to1000: {
    label: '$400–$1,000',
    weeklyDollars: 650,
    echoLine: 'About $400 to $1,000 a week.',
    replyLine: 'Serious action, every single week.',
  },
  h1000plus: {
    label: '$1,000+',
    weeklyDollars: 1500,
    echoLine: 'A thousand or more a week.',
    replyLine: 'High stakes. The yearly number is going to be eye-opening.',
  },
  unknown: {
    label: 'Prefer not to say',
    weeklyDollars: 150,
    echoLine: "I'd rather not say.",
    replyLine: "No problem — we'll use a middle estimate.",
  },
};

export function resolveStakesBucket(raw: string | undefined | null): StakesBucket {
  return (STAKES_BUCKETS as readonly string[]).includes(raw ?? '')
    ? (raw as StakesBucket)
    : 'unknown';
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export interface StakesEstimates {
  yearlyAction: number;
  lifetimeAction: number;
}

export function stakesEstimates(bucket: StakesBucket): StakesEstimates {
  const yearly = STAKES_INFO[bucket].weeklyDollars * 52;
  return {
    yearlyAction: roundTo(yearly, 100),
    lifetimeAction: roundTo(yearly * LIFETIME_HORIZON_YEARS, 10_000),
  };
}

export function money(n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}

// ── Reveal copy ──────────────────────────────────────────────────────────────

export const COST_FOOTNOTE =
  'Total wagered — money in play, not winnings or losses. Time at about 16 waking hours a day.';

export const RECLAIM_DISCLOSURE =
  "Estimates from your answers. Time projected across a betting lifetime at about 16 waking hours a day; dollars are money wagered, not winnings or losses. WagerProof does not promise profits or outcomes.";
