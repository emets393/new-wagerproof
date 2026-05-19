import type {
  BatterVsArchetypeRow,
  PitcherArchetypeProfile,
  PitcherArchetypeType,
  PitchHand,
} from '@/types/mlb-matchups';

export type { BatterVsArchetypeRow, PitcherArchetypeProfile, PitcherArchetypeType };

export type DisplayPitcherArchetype = Exclude<PitcherArchetypeType, 'Insufficient'>;

/** Minimum PA to show vs-archetype stats in drilldown (still a small sample below SMALL_SAMPLE). */
export const MIN_PA_VS_ARCHETYPE_DISPLAY = 8;
/** PA below this shows a small-sample caveat alongside stats. */
export const MIN_PA_VS_ARCHETYPE_SMALL_SAMPLE = 15;
export const MIN_PA_VS_ARCHETYPE_INSIGHT = 20;
export const ARCHETYPE_XWOBA_DELTA = 0.05;

export const ARCHETYPE_META: Record<
  DisplayPitcherArchetype,
  { icon: string; color: string; label: string }
> = {
  Power: {
    icon: '🔥',
    color: 'bg-red-500/10 text-red-600 border-red-500/40 dark:text-red-400',
    label: 'Power Pitcher',
  },
  Groundball: {
    icon: '🪨',
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/40 dark:text-emerald-400',
    label: 'Groundball Pitcher',
  },
  Flyball: {
    icon: '🎈',
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/40 dark:text-amber-400',
    label: 'Flyball Pitcher',
  },
  Control: {
    icon: '🎯',
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/40 dark:text-blue-400',
    label: 'Control Pitcher',
  },
  Finesse: {
    icon: '🧪',
    color: 'bg-purple-500/10 text-purple-600 border-purple-500/40 dark:text-purple-400',
    label: 'Finesse / Crafty',
  },
  Balanced: {
    icon: '⚖️',
    color: 'bg-slate-500/10 text-slate-600 border-slate-500/40 dark:text-slate-400',
    label: 'Balanced (no extreme trait)',
  },
};

export const ARCHETYPE_FILTER_OPTIONS: DisplayPitcherArchetype[] = [
  'Power',
  'Groundball',
  'Flyball',
  'Control',
  'Finesse',
];

export function isDisplayArchetype(
  archetype: string | null | undefined,
): archetype is DisplayPitcherArchetype {
  return (
    archetype != null &&
    archetype !== 'Insufficient' &&
    archetype in ARCHETYPE_META
  );
}

export function archetypeDescription(archetype: PitcherArchetypeType | string): string {
  switch (archetype) {
    case 'Power':
      return 'Strikeout-heavy, velocity-driven. Misses bats with high-end stuff.';
    case 'Groundball':
      return 'Induces grounders, suppresses HRs. Sinker-heavy approach.';
    case 'Flyball':
      return 'Allows flies, lives up in the zone. HR-vulnerable, especially in hitter parks with wind out.';
    case 'Control':
      return 'Lives in the zone, avoids walks. Gets ahead in counts.';
    case 'Finesse':
      return 'Lower velocity, pitch-mix dependent. Survives on guile and command.';
    case 'Balanced':
      return 'No extreme trait — average across the board.';
    default:
      return 'Not enough batters faced to classify this season.';
  }
}

export function archetypeHandLabel(hand: PitchHand): string {
  return hand === 'R' ? 'RHP' : 'LHP';
}
