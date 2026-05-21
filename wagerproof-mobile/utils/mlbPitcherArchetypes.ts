import type { PitcherArchetypeType } from '@/types/mlbPitcherMatchups';

export type DisplayPitcherArchetype = Exclude<PitcherArchetypeType, 'Insufficient'>;

export const ARCHETYPE_META: Record<
  DisplayPitcherArchetype,
  { icon: string; color: string; label: string }
> = {
  Power: { icon: '🔥', color: '#ef4444', label: 'Power Pitcher' },
  Groundball: { icon: '🪨', color: '#10b981', label: 'Groundball Pitcher' },
  Flyball: { icon: '🎈', color: '#f59e0b', label: 'Flyball Pitcher' },
  Control: { icon: '🎯', color: '#3b82f6', label: 'Control Pitcher' },
  Finesse: { icon: '🧪', color: '#a855f7', label: 'Finesse / Crafty' },
  Balanced: { icon: '⚖️', color: '#64748b', label: 'Balanced' },
};

export function isDisplayArchetype(
  archetype: string | null | undefined,
): archetype is DisplayPitcherArchetype {
  return Boolean(archetype && archetype !== 'Insufficient' && archetype in ARCHETYPE_META);
}

export function archetypeDescription(archetype: PitcherArchetypeType | string | null | undefined): string {
  switch (archetype) {
    case 'Power':
      return 'Strikeout-heavy, velocity-driven. Misses bats with high-end stuff.';
    case 'Groundball':
      return 'Induces grounders, suppresses HRs. Sinker-heavy approach.';
    case 'Flyball':
      return 'Allows flies, lives up in the zone. HR-vulnerable in hitter parks.';
    case 'Control':
      return 'Lives in the zone, avoids walks, and gets ahead in counts.';
    case 'Finesse':
      return 'Lower velocity, pitch-mix dependent. Survives on guile and command.';
    case 'Balanced':
      return 'No extreme trait - average across the board.';
    default:
      return 'Not enough batters faced to classify this season.';
  }
}
