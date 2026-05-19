import type { ParkHRFactors } from '@/hooks/usePark';
import type { LineupRow, MatchupGame, PitchHand } from '@/types/mlb-matchups';
import { effectiveBatSide } from '@/utils/mlbArsenal';

export function effectiveBatSideForPark(
  batSide: 'R' | 'L' | 'S' | null | undefined,
  pitcherHand: PitchHand,
): 'R' | 'L' {
  if (batSide === 'S') return pitcherHand === 'R' ? 'L' : 'R';
  if (batSide === 'L' || batSide === 'R') return batSide;
  return 'R';
}

export function hrFactorForBatterSide(
  park: ParkHRFactors,
  effSide: 'R' | 'L',
): number {
  return effSide === 'L' ? park.lhb_hr_factor : park.rhb_hr_factor;
}

export function parkHrAdjustment(park: ParkHRFactors | null, effSide: 'R' | 'L'): number {
  if (!park) return 0;
  const hrFactor = hrFactorForBatterSide(park, effSide);
  return (hrFactor - 1.0) * 80;
}

export function dominantEffectiveLineupHand(
  lineup: LineupRow[],
  pitcherHand: PitchHand,
): 'R' | 'L' {
  let r = 0;
  let l = 0;
  for (const b of lineup) {
    const side = effectiveBatSide(b, pitcherHand);
    if (side === 'R') r += 1;
    else l += 1;
  }
  return l >= r ? 'L' : 'R';
}

export function parkSuppressesHr(park: ParkHRFactors): boolean {
  return park.lhb_hr_factor <= 0.93 && park.rhb_hr_factor <= 0.93;
}

export function parkFavorsHand(park: ParkHRFactors, hand: 'R' | 'L', threshold = 1.05): boolean {
  const f = hand === 'L' ? park.lhb_hr_factor : park.rhb_hr_factor;
  return f >= threshold;
}

export function buildParkTooltip(park: ParkHRFactors, game: MatchupGame): string {
  const lines: string[] = [
    `${park.venue_name} · LHB ${park.lhb_hr_factor.toFixed(2)}x · RHB ${park.rhb_hr_factor.toFixed(2)}x`,
  ];

  const porch: string[] = [];
  if (park.lf_short_porch) porch.push(`${park.lf_line_ft} ft LF (short porch)`);
  if (park.rf_short_porch) porch.push(`${park.rf_line_ft} ft RF (short porch)`);
  if (porch.length) lines.push(porch.join(' · '));

  const walls: string[] = [];
  if (park.lf_tall_wall) walls.push('tall LF wall');
  if (park.rf_tall_wall) walls.push('tall RF wall');
  if (walls.length) lines.push(walls.join(' · '));

  lines.push(
    `${park.altitude_ft} ft altitude · ${park.has_roof ? 'Roof (wind neutral)' : 'Outdoor (wind matters)'} · ${
      park.is_artificial ? 'Artificial turf' : 'Natural grass'
    }`,
  );

  if (park.notes?.trim()) lines.push(park.notes.trim());

  if (!park.has_roof && (game.wind_speed_mph ?? 0) >= 10) {
    lines.push(
      `Tonight: ${Math.round(game.wind_speed_mph!)} mph ${game.wind_direction ?? 'wind'}`,
    );
  }

  return lines.join('\n');
}
