import type { ParkHRFactors } from '@/hooks/usePark';
import type {
  BatterSplitRow,
  BatterVsPitchTypeRow,
  MatchupGame,
  PitcherArsenalByHand,
  PitcherArsenalRow,
  PitcherBattedBallRow,
  PitchHand,
} from '@/types/mlb-matchups';
import { effectiveBatSide, getArsenalForBatter } from '@/utils/mlbArsenal';
import { effectiveBatSideForPark, parkHrAdjustment } from '@/utils/parkHr';

export const SCORE_CONSTANTS = {
  MIN_PA_BATTER_SPLIT: 30,
  MIN_PITCHES_VS_TYPE: 15,
  MIN_BF_PITCHER: 30,
  MIN_PITCHES_PER_PITCH_TYPE: 50,
  MIN_SCORE_TO_DISPLAY: 50,
  TOP_N_PER_COLUMN: 5,
  POWER_STACK_MIN_HR_SCORE: 75,
  POWER_STACK_MIN_HITTERS: 3,
  POWER_STACK_MAX_DISPLAYED: 3,
} as const;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function avg(arr: number[]) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function battedBallForBatter(
  batter: BatterSplitRow,
  pitcherHand: PitchHand,
  profile: { overall: PitcherBattedBallRow | null; vs_R: PitcherBattedBallRow | null; vs_L: PitcherBattedBallRow | null },
): PitcherBattedBallRow | null {
  const side = effectiveBatSide(batter, pitcherHand);
  return side === 'R' ? profile.vs_R ?? profile.overall : profile.vs_L ?? profile.overall;
}

export interface HrThreatBreakdownLine {
  component: string;
  value: number;
  detail?: string;
}

export interface HrThreatResult {
  score: number;
  breakdown: HrThreatBreakdownLine[];
}

export function computeHrThreat(
  batter: BatterSplitRow,
  oppPitcher: PitcherBattedBallRow,
  arsenalsByHand: PitcherArsenalByHand,
  batterVsPitchType: BatterVsPitchTypeRow[],
  game: MatchupGame,
  pitcher_hand: PitchHand,
  park: ParkHRFactors | null,
  oppPitcherName: string,
): HrThreatResult {
  const empty: HrThreatResult = { score: 0, breakdown: [] };
  if (batter.pa < SCORE_CONSTANTS.MIN_PA_BATTER_SPLIT) return empty;
  if (oppPitcher.batters_faced < SCORE_CONSTANTS.MIN_BF_PITCHER) return empty;

  const power = avg([
    clamp((batter.barrel_pct ?? 0) / 18 * 100, 0, 100),
    clamp((batter.hr_per_fb_pct ?? 0) / 20 * 100, 0, 100),
    clamp((batter.iso ?? 0) / 0.25 * 100, 0, 100),
    clamp((batter.pull_air_pct ?? 0) / 45 * 100, 0, 100),
  ]);

  const vuln = avg([
    clamp((oppPitcher.fb_pct ?? 0) / 45 * 100, 0, 100),
    clamp((oppPitcher.hr_per_fb_pct ?? 0) / 18 * 100, 0, 100),
    clamp((oppPitcher.barrel_pct ?? 0) / 12 * 100, 0, 100),
  ]);

  const handArsenal = getArsenalForBatter(batter, pitcher_hand, arsenalsByHand);
  const top3 = handArsenal
    .filter(
      p =>
        (p.usage_pct ?? 0) >= 10 &&
        p.pitches_thrown >= SCORE_CONSTANTS.MIN_PITCHES_PER_PITCH_TYPE,
    )
    .sort((a, b) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0))
    .slice(0, 3);

  let weightSum = 0;
  let slgWeighted = 0;
  const matchupPitchLines: string[] = [];
  for (const pitch of top3) {
    const row = batterVsPitchType.find(
      p => p.pitch_type === pitch.pitch_type && p.vs_pitcher_hand === pitcher_hand,
    );
    if (!row || row.pitches_seen < SCORE_CONSTANTS.MIN_PITCHES_VS_TYPE) continue;
    const w = pitch.usage_pct ?? 0;
    weightSum += w;
    slgWeighted += w * clamp((row.slg ?? 0) / 0.7 * 100, 0, 100);
    matchupPitchLines.push(
      `${pitch.pitch_type_label || pitch.pitch_type} ${formatRate(row.slg)} SLG`,
    );
  }
  const matchup = weightSum > 0 ? slgWeighted / weightSum : power * 0.7;

  let score = 0.4 * power + 0.3 * vuln + 0.3 * matchup;

  const effSide = effectiveBatSideForPark(batter.bat_side, pitcher_hand);
  const parkAdjustment = parkHrAdjustment(park, effSide);
  score += parkAdjustment;

  let windBonus = 0;
  if (
    !park?.has_roof &&
    game.wind_speed_mph !== null &&
    game.wind_speed_mph >= 10 &&
    /out/i.test(game.wind_direction ?? '')
  ) {
    windBonus = clamp((game.wind_speed_mph - 8) * 1.2, 0, 12);
    score += windBonus;
  }

  const finalScore = clamp(Math.round(score), 0, 100);

  const breakdown: HrThreatBreakdownLine[] = [
    {
      component: 'Power profile',
      value: Math.round(power),
      detail: `barrel ${formatPct(batter.barrel_pct)} · ISO ${formatRate(batter.iso)} · HR/FB ${formatPct(batter.hr_per_fb_pct)} · pull-air ${formatPct(batter.pull_air_pct)}`,
    },
    {
      component: 'Vulnerability',
      value: Math.round(vuln),
      detail: `${oppPitcherName} FB ${formatPct(oppPitcher.fb_pct)} · HR/FB allowed ${formatPct(oppPitcher.hr_per_fb_pct)}`,
    },
    {
      component: 'Matchup',
      value: Math.round(matchup),
      detail:
        matchupPitchLines.length > 0
          ? `vs top pitches: ${matchupPitchLines.join(', ')}`
          : undefined,
    },
  ];

  if (park && Math.abs(parkAdjustment) >= 3) {
    const hrFactor = effSide === 'L' ? park.lhb_hr_factor : park.rhb_hr_factor;
    breakdown.push({
      component: 'Park',
      value: Math.round(parkAdjustment),
      detail: `${park.venue_name} — ${hrFactor.toFixed(2)}x ${effSide === 'L' ? 'LHB' : 'RHB'} HR factor`,
    });
  }

  breakdown.push({ component: 'Wind bonus', value: Math.round(windBonus) });

  return { score: finalScore, breakdown };
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}%`;
}

function formatRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(3);
}

export function hrThreatScore(
  batter: BatterSplitRow,
  oppPitcher: PitcherBattedBallRow,
  arsenalsByHand: PitcherArsenalByHand,
  batterVsPitchType: BatterVsPitchTypeRow[],
  game: MatchupGame,
  pitcher_hand: PitchHand,
  park: ParkHRFactors | null = null,
  oppPitcherName = '',
): number {
  return computeHrThreat(
    batter,
    oppPitcher,
    arsenalsByHand,
    batterVsPitchType,
    game,
    pitcher_hand,
    park,
    oppPitcherName,
  ).score;
}

export function hitLeanScore(
  batter: BatterSplitRow,
  oppPitcher: PitcherBattedBallRow,
  arsenalsByHand: PitcherArsenalByHand,
  batterVsPitchType: BatterVsPitchTypeRow[],
  pitcher_hand: PitchHand,
): number {
  if (batter.pa < SCORE_CONSTANTS.MIN_PA_BATTER_SPLIT) return 0;
  if (oppPitcher.batters_faced < SCORE_CONSTANTS.MIN_BF_PITCHER) return 0;

  const contact = avg([
    clamp((batter.xwoba ?? 0) / 0.42 * 100, 0, 100),
    clamp((batter.hard_hit_pct ?? 0) / 50 * 100, 0, 100),
    clamp((35 - (batter.k_pct ?? 35)) / 35 * 100, 0, 100),
    clamp((batter.babip ?? 0) / 0.35 * 100, 0, 100),
  ]);

  const handArsenal = getArsenalForBatter(batter, pitcher_hand, arsenalsByHand);
  const top3 = handArsenal
    .filter(
      p =>
        (p.usage_pct ?? 0) >= 10 &&
        p.pitches_thrown >= SCORE_CONSTANTS.MIN_PITCHES_PER_PITCH_TYPE,
    )
    .sort((a, b) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0))
    .slice(0, 3);

  let weightSum = 0;
  let avgWeighted = 0;
  for (const pitch of top3) {
    const row = batterVsPitchType.find(
      p => p.pitch_type === pitch.pitch_type && p.vs_pitcher_hand === pitcher_hand,
    );
    if (!row || row.pitches_seen < SCORE_CONSTANTS.MIN_PITCHES_VS_TYPE) continue;
    const w = pitch.usage_pct ?? 0;
    weightSum += w;
    avgWeighted += w * clamp((row.avg ?? 0) / 0.35 * 100, 0, 100);
  }
  const matchup = weightSum > 0 ? avgWeighted / weightSum : contact * 0.7;

  const hittability = avg([
    clamp((30 - (oppPitcher.k_pct ?? 30)) / 30 * 100, 0, 100),
    clamp((oppPitcher.xwoba_allowed ?? 0) / 0.38 * 100, 0, 100),
    clamp((oppPitcher.bb_pct ?? 0) / 12 * 100, 0, 100),
  ]);

  return clamp(Math.round(0.4 * contact + 0.35 * matchup + 0.25 * hittability), 0, 100);
}

export function pitcherPerformanceScore(
  pitcher: PitcherBattedBallRow,
  pitcherArsenal: PitcherArsenalRow[],
  oppLineupSplits: BatterSplitRow[],
  game: MatchupGame,
): number {
  if (pitcher.batters_faced < SCORE_CONSTANTS.MIN_BF_PITCHER) return 0;

  const quality = avg([
    clamp((0.38 - (pitcher.xwoba_allowed ?? 0.38)) / 0.38 * 100, 0, 100),
    clamp((pitcher.k_pct ?? 0) / 32 * 100, 0, 100),
    clamp((12 - (pitcher.bb_pct ?? 12)) / 12 * 100, 0, 100),
    clamp((20 - (pitcher.hr_per_fb_pct ?? 20)) / 20 * 100, 0, 100),
  ]);

  const eligible = oppLineupSplits.filter(b => b.pa >= SCORE_CONSTANTS.MIN_PA_BATTER_SPLIT);
  if (eligible.length < 3) return 0;
  const avgLineupXwoba = avg(eligible.map(b => b.xwoba ?? 0));
  const avgLineupKPct = avg(eligible.map(b => b.k_pct ?? 0));
  const lineupComp = avg([
    clamp((0.35 - avgLineupXwoba) / 0.35 * 100, 0, 100),
    clamp(avgLineupKPct / 28 * 100, 0, 100),
  ]);

  let context = 50;
  if ((game.wind_speed_mph ?? 0) >= 10) {
    if (/out/i.test(game.wind_direction ?? '')) {
      if ((pitcher.fb_pct ?? 0) >= 38) context -= 15;
      if ((pitcher.gb_pct ?? 0) >= 50) context += 8;
    }
    if (/in/i.test(game.wind_direction ?? '')) {
      if ((pitcher.fb_pct ?? 0) >= 38) context += 15;
    }
  }

  const arsenalScore = pitcherArsenal
    .filter(
      p =>
        (p.usage_pct ?? 0) >= 10 &&
        p.pitches_thrown >= SCORE_CONSTANTS.MIN_PITCHES_PER_PITCH_TYPE,
    )
    .reduce((s, p) => s + (p.usage_pct ?? 0) * ((p.whiff_pct ?? 0) / 100), 0);
  const arsenalComp = clamp((arsenalScore / 14) * 100, 0, 100);

  return clamp(
    Math.round(0.4 * quality + 0.35 * lineupComp + 0.15 * context + 0.1 * arsenalComp),
    0,
    100,
  );
}

export function strikeoutLeanScore(
  pitcher: PitcherBattedBallRow,
  pitcherArsenal: PitcherArsenalRow[],
  oppLineupSplits: BatterSplitRow[],
  oppLineupVsPitchType: BatterVsPitchTypeRow[],
  pitcher_hand: PitchHand,
): number {
  if (pitcher.batters_faced < SCORE_CONSTANTS.MIN_BF_PITCHER) return 0;

  const wipeout = pitcherArsenal
    .filter(
      p =>
        (p.usage_pct ?? 0) >= 15 &&
        p.pitches_thrown >= SCORE_CONSTANTS.MIN_PITCHES_PER_PITCH_TYPE,
    )
    .sort((a, b) => (b.whiff_pct ?? 0) - (a.whiff_pct ?? 0))[0];

  const pitcherK = avg([
    clamp((pitcher.k_pct ?? 0) / 32 * 100, 0, 100),
    wipeout ? clamp((wipeout.whiff_pct ?? 0) / 40 * 100, 0, 100) : 50,
  ]);

  const top3 = pitcherArsenal
    .filter(
      p =>
        (p.usage_pct ?? 0) >= 10 &&
        p.pitches_thrown >= SCORE_CONSTANTS.MIN_PITCHES_PER_PITCH_TYPE,
    )
    .sort((a, b) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0))
    .slice(0, 3);

  const lineupIds = oppLineupSplits.map(b => b.batter_id);
  let weight = 0;
  let kWeighted = 0;
  for (const pitch of top3) {
    const ks = oppLineupVsPitchType.filter(
      r =>
        lineupIds.includes(r.batter_id) &&
        r.pitch_type === pitch.pitch_type &&
        r.vs_pitcher_hand === pitcher_hand &&
        r.pitches_seen >= 15,
    );
    if (ks.length < 3) continue;
    const avgK = avg(ks.map(r => r.k_pct ?? 0));
    weight += pitch.usage_pct ?? 0;
    kWeighted += (pitch.usage_pct ?? 0) * avgK;
  }
  const lineupK =
    weight > 0 ? clamp(kWeighted / weight / 28 * 100, 0, 100) : 50;

  return clamp(Math.round(0.5 * pitcherK + 0.5 * lineupK), 0, 100);
}

export { battedBallForBatter };
