import type { ParkHRFactors } from '@/hooks/usePark';
import {
  countColdSignals,
  countHotSignals,
  MIN_L10_BBE,
} from '@/utils/mlbRecentForm';
import type {
  BatterSplitRow,
  BatterVsArchetypeRow,
  BatterVsPitchTypeRow,
  Insight,
  LineupRow,
  MatchupGame,
  PitcherArchetypeType,
  PitcherArsenalByHand,
  PitcherArsenalRow,
  PitcherBattedBallProfile,
  PitchHand,
} from '@/types/mlb-matchups';
import {
  ARCHETYPE_META,
  ARCHETYPE_XWOBA_DELTA,
  MIN_PA_VS_ARCHETYPE_INSIGHT,
  isDisplayArchetype,
} from '@/utils/mlbPitcherArchetypes';
import { defaultArsenalTab, effectiveBatSide, getArsenalForBatter } from '@/utils/mlbArsenal';
import {
  effectiveBatSideForPark,
  hrFactorForBatterSide,
  parkSuppressesHr,
} from '@/utils/parkHr';
import { formatPct, formatRate, pitchFamily, toMilliRate } from '@/utils/mlbPitcherMatchups';

export type { Insight };

/** Centralized thresholds — tune here only. */
export const T = {
  MIN_PA_SPLIT: 30,
  MIN_PITCHES_VS_TYPE: 20,
  MIN_PITCHES_PER_TYPE: 50,
  FB_HEAVY_PITCHER: 38,
  WIND_OUT_THRESHOLD_MPH: 12,
  WIND_IN_THRESHOLD_MPH: 12,
  PULL_AIR_THREAT: 35,
  PULL_AIR_HR_FB: 15,
  LINEUP_K_HEAVY: 25,
  PITCHER_K_HEAVY: 25,
  PITCH_USAGE_RELEVANT: 22,
  WIPEOUT_WHIFF: 30,
  WIPEOUT_USAGE: 18,
  WIPEOUT_WHIFF_STRICT: 35,
  CRUSH_XWOBA: 0.4,
  CRUSH_SLG: 0.5,
  HOT_COLD_DELTA: 0.06,
  HOT_BARREL_CORROBORATION: 10,
  POWER_ISO: 0.2,
  POWER_BARREL: 11,
  VULNERABLE_XWOBA: 0.38,
  PITCHER_VULN_XWOBA: 0.36,
  GB_HEAVY: 50,
  FB_LOW: 25,
  HR_FB_LOW: 8,
  PLATOON_MIN_HITTERS: 6,
  PLATOON_XWOBA_ALLOWED: 0.35,
  LINEUP_CRUSH_COUNT: 3,
  LINEUP_CRUSH_MIN_PA: 20,
  HIGH_TOTAL: 8.5,
  PLATOON_MIX_SHIFT_PP: 15,
} as const;

export interface GameContext {
  game: MatchupGame;
  park: ParkHRFactors | null;
  awayArsenal: PitcherArsenalByHand;
  homeArsenal: PitcherArsenalByHand;
  awayBattedBall: PitcherBattedBallProfile;
  homeBattedBall: PitcherBattedBallProfile;
  awayLineup: LineupRow[];
  homeLineup: LineupRow[];
  awayLineupSplits: BatterSplitRow[];
  homeLineupSplits: BatterSplitRow[];
  awayBatterVsPitch: BatterVsPitchTypeRow[];
  homeBatterVsPitch: BatterVsPitchTypeRow[];
}

export interface PitcherContext {
  pitcherId: number;
  pitcherName: string;
  pitchHand: PitchHand;
  arsenal: PitcherArsenalByHand;
  battedBall: PitcherBattedBallProfile;
  opposingLineup: LineupRow[];
  opposingSplits: BatterSplitRow[];
  opposingVsPitch: BatterVsPitchTypeRow[];
  game: MatchupGame;
}

export interface BatterContext {
  batter: BatterSplitRow;
  lineup: LineupRow;
  opposingPitcherId: number;
  opposingPitcherName: string;
  opposingPitcherHand: PitchHand;
  opposingArsenal: PitcherArsenalByHand;
  opposingBattedBall: PitcherBattedBallProfile;
  batterVsPitchType: BatterVsPitchTypeRow[];
  opposingPitcherArchetype: PitcherArchetypeType;
  batterVsArchetype: BatterVsArchetypeRow | null;
  game: MatchupGame;
  park: ParkHRFactors | null;
}

function arsenalForOpposingLineup(
  arsenal: PitcherArsenalByHand,
  opposingLineup: LineupRow[],
  pitcherHand: PitchHand,
): PitcherArsenalRow[] {
  const tab = defaultArsenalTab(opposingLineup, pitcherHand);
  const rows = arsenal[tab];
  return rows.filter(p => (p.pitches_thrown ?? 0) >= 25).length >= 3 ? rows : arsenal.A;
}

function teamForSide(side: 'away' | 'home', game: MatchupGame): Pick<Insight, 'team_abbrev' | 'team_name'> {
  return side === 'away'
    ? { team_abbrev: game.away_abbr, team_name: game.away_team_name }
    : { team_abbrev: game.home_abbr, team_name: game.home_team_name };
}

function platoonMixShiftInsights(
  pitcherId: number,
  pitcherName: string,
  arsenal: PitcherArsenalByHand,
  team: Pick<Insight, 'team_abbrev' | 'team_name'>,
): Insight[] {
  const insights: Insight[] = [];
  const byType = new Map<string, { r?: PitcherArsenalRow; l?: PitcherArsenalRow }>();
  for (const row of arsenal.R) {
    const cur = byType.get(row.pitch_type) ?? {};
    cur.r = row;
    byType.set(row.pitch_type, cur);
  }
  for (const row of arsenal.L) {
    const cur = byType.get(row.pitch_type) ?? {};
    cur.l = row;
    byType.set(row.pitch_type, cur);
  }
  for (const [pitchType, { r, l }] of byType) {
    if (!r || !l) continue;
    const diff = Math.abs((r.usage_pct ?? 0) - (l.usage_pct ?? 0));
    if (diff < T.PLATOON_MIX_SHIFT_PP) continue;
    const moreVs = (r.usage_pct ?? 0) > (l.usage_pct ?? 0) ? 'right-handed' : 'left-handed';
    const label = r.pitch_type_label || l.pitch_type_label || pitchType;
    insights.push({
      id: `mix_shift_${pitcherId}_${pitchType}`,
      dedupeKey: `mix_shift:${pitcherId}:${pitchType}`,
      icon: '💡',
      tone: 'neutral',
      scope: 'game',
      pitcher_id: pitcherId,
      ...team,
      priority: 60,
      headline: `💡 Platoon mix shift — ${label} +${Math.round(diff)}pp vs ${moreVs} bats`,
      detail: `${pitcherName} throws ${label} ${Math.round(r.usage_pct ?? 0)}% vs RHB and ${Math.round(l.usage_pct ?? 0)}% vs LHB.`,
    });
    if (insights.length >= 2) break;
  }
  return insights;
}

function windOut(dir: string | null): boolean {
  return /out/i.test(dir ?? '');
}

function windIn(dir: string | null): boolean {
  return /in/i.test(dir ?? '');
}

function wobaMilli(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(3).replace(/^0/, '');
}

function platoonInsightsForBatter(batter: BatterSplitRow): Insight[] {
  const out: Insight[] = [];
  if (!batter.platoon_signal) return out;

  const deltaPts = Math.round((batter.woba_delta_vs_other_hand ?? 0) * 1000);
  const thisWoba = wobaMilli(batter.woba);
  const otherWoba = wobaMilli(batter.other_hand_woba);
  const otherHand = batter.vs_pitcher_hand === 'R' ? 'L' : 'R';
  const vsHand = batter.vs_pitcher_hand;

  switch (batter.platoon_signal) {
    case 'strong_advantage':
      out.push({
        id: `platoon_strong_advantage_${batter.batter_id}`,
        dedupeKey: `platoon:${batter.batter_id}`,
        icon: '💪',
        tone: 'positive',
        scope: 'batter',
        batter_id: batter.batter_id,
        priority: 78,
        headline: `💪 Crushes ${vsHand}HP (+${deltaPts} wOBA pts)`,
        detail: `${thisWoba} wOBA vs ${vsHand}HP this season (${batter.pa} PA), vs ${otherWoba} vs ${otherHand}HP. Strong platoon advantage tonight.`,
      });
      break;
    case 'advantage':
      out.push({
        id: `platoon_advantage_${batter.batter_id}`,
        dedupeKey: `platoon:${batter.batter_id}`,
        icon: '⬆️',
        tone: 'positive',
        scope: 'batter',
        batter_id: batter.batter_id,
        priority: 55,
        headline: `⬆️ Modest edge vs ${vsHand}HP (+${deltaPts} wOBA)`,
        detail: `Modest platoon advantage tonight (${thisWoba} vs ${otherWoba}).`,
      });
      break;
    case 'strong_disadvantage':
      out.push({
        id: `platoon_strong_disadvantage_${batter.batter_id}`,
        dedupeKey: `platoon:${batter.batter_id}`,
        icon: '🪦',
        tone: 'danger',
        scope: 'batter',
        batter_id: batter.batter_id,
        priority: 78,
        headline: `🪦 Buried vs ${vsHand}HP (${deltaPts} wOBA pts)`,
        detail: `Only ${thisWoba} wOBA vs ${vsHand}HP (${batter.pa} PA), vs ${otherWoba} vs ${otherHand}HP. Classic platoon disadvantage.`,
      });
      break;
    case 'reverse_split': {
      const sideLabel =
        batter.bat_side === 'L' ? 'lefty' : batter.bat_side === 'R' ? 'righty' : 'switch hitter';
      out.push({
        id: `platoon_reverse_split_${batter.batter_id}`,
        dedupeKey: `platoon:${batter.batter_id}`,
        icon: '🔀',
        tone: 'positive',
        scope: 'batter',
        batter_id: batter.batter_id,
        priority: 82,
        headline: `🔀 Reverse split — ${batter.bat_side ?? '?'}HB crushes ${vsHand}HP`,
        detail: `${batter.batter_name} is a ${sideLabel} hitting same-handed pitching better than opposite (${thisWoba} vs ${otherWoba}). Market typically misprices this.`,
      });
      break;
    }
    default:
      break;
  }

  return out;
}

function shortPorchBatterInsight(
  batter: BatterSplitRow,
  park: ParkHRFactors,
  pitcherHand: PitchHand,
): Insight | null {
  const effSide = effectiveBatSideForPark(batter.bat_side, pitcherHand);
  const isShortPorchSide =
    (effSide === 'L' && park.rf_short_porch) || (effSide === 'R' && park.lf_short_porch);

  if (
    !isShortPorchSide ||
    (batter.pull_air_pct ?? 0) < 35 ||
    (batter.hr_per_fb_pct ?? 0) < 12 ||
    batter.pa < 30
  ) {
    return null;
  }

  const distance = effSide === 'L' ? park.rf_line_ft : park.lf_line_ft;
  const hrFactor = hrFactorForBatterSide(park, effSide);

  return {
    id: `short_porch_${batter.batter_id}`,
    dedupeKey: `short_porch:${batter.batter_id}`,
    icon: '🏟️',
    tone: 'positive',
    scope: 'batter',
    batter_id: batter.batter_id,
    priority: 80,
    headline: `🏟️ Short porch matchup — ${distance} ft ${effSide === 'L' ? 'RF' : 'LF'}`,
    detail: `${park.venue_name}'s ${distance} ft ${effSide === 'L' ? 'right' : 'left'} field is HR-friendly for this batter (${formatPct(batter.pull_air_pct)} pull-air, ${formatPct(batter.hr_per_fb_pct)} HR/FB). Park HR factor ${hrFactor.toFixed(2)}x.`,
  };
}

function parkGameInsights(ctx: GameContext): Insight[] {
  const park = ctx.park;
  if (!park) return [];

  const insights: Insight[] = [];
  const homeTeam = teamForSide('home', ctx.game);

  const lineupConfigs = [
    {
      splits: ctx.awayLineupSplits,
      pitcherHand: ctx.game.home_sp_hand,
      teamName: ctx.game.away_team_name,
      team: teamForSide('away', ctx.game),
    },
    {
      splits: ctx.homeLineupSplits,
      pitcherHand: ctx.game.away_sp_hand,
      teamName: ctx.game.home_team_name,
      team: homeTeam,
    },
  ] as const;

  for (const favoredHand of ['L', 'R'] as const) {
    const benefits = favoredHand === 'L' ? park.lhb_hr_factor >= 1.08 : park.rhb_hr_factor >= 1.08;
    const factor = favoredHand === 'L' ? park.lhb_hr_factor : park.rhb_hr_factor;
    if (!benefits) continue;

    for (const { splits, pitcherHand, teamName, team } of lineupConfigs) {
      const favored = splits.filter(
        b =>
          effectiveBatSide(b, pitcherHand) === favoredHand &&
          (b.pull_air_pct ?? 0) >= 30 &&
          (b.barrel_pct ?? 0) >= 9 &&
          b.pa >= 30,
      );
      if (favored.length < 2) continue;

      const names = favored
        .slice(0, 3)
        .map(b => b.batter_name)
        .join(', ');
      insights.push({
        id: `park_friendly_${favoredHand}_${teamName}`,
        dedupeKey: `park_friendly:${favoredHand}:${teamName}`,
        icon: '🏟️',
        tone: 'positive',
        scope: 'game',
        ...team,
        priority: 75,
        headline: `🏟️ ${park.venue_name} HR-friendly for ${favoredHand}HB (${factor.toFixed(2)}x)`,
        detail: `${favored.length} ${favoredHand}HB hitters in ${teamName}'s lineup with pull-air ≥ 30% + barrel ≥ 9%: ${names}.`,
      });
    }
  }

  for (const favoredHand of ['L', 'R'] as const) {
    const suppresses =
      favoredHand === 'L' ? park.lhb_hr_factor <= 0.92 : park.rhb_hr_factor <= 0.92;
    const factor = favoredHand === 'L' ? park.lhb_hr_factor : park.rhb_hr_factor;
    if (!suppresses) continue;

    for (const { splits, pitcherHand, teamName, team } of lineupConfigs) {
      const threats = splits.filter(
        b =>
          effectiveBatSide(b, pitcherHand) === favoredHand &&
          (b.pull_air_pct ?? 0) >= 30 &&
          (b.barrel_pct ?? 0) >= 9 &&
          (b.hr_per_fb_pct ?? 0) >= 12 &&
          b.pa >= 30,
      );
      if (threats.length < 2) continue;

      const names = threats
        .slice(0, 3)
        .map(b => b.batter_name)
        .join(', ');
      insights.push({
        id: `park_suppress_${favoredHand}_${teamName}`,
        dedupeKey: `park_suppress:${favoredHand}:${teamName}`,
        icon: '🏟️',
        tone: 'danger',
        scope: 'game',
        ...team,
        priority: 70,
        headline: `🏟️ ${park.venue_name} HR-suppressing for ${favoredHand}HB (${factor.toFixed(2)}x)`,
        detail: `Park typically -${Math.round((1 - factor) * 100)}% HR rate for ${favoredHand}HB. Notable hitters who may underperform: ${names}.`,
      });
    }
  }

  return insights;
}

function lineupPlatoonGameInsights(ctx: GameContext): Insight[] {
  const insights: Insight[] = [];
  const sides = [
    {
      splits: ctx.awayLineupSplits,
      teamName: ctx.game.away_team_name,
      opposingPitcherName: ctx.game.home_sp_name,
      side: 'away',
    },
    {
      splits: ctx.homeLineupSplits,
      teamName: ctx.game.home_team_name,
      opposingPitcherName: ctx.game.away_sp_name,
      side: 'home',
    },
  ] as const;

  for (const { splits, teamName, opposingPitcherName, side } of sides) {
    const advantaged = splits.filter(
      b => b.platoon_signal === 'strong_advantage' || b.platoon_signal === 'reverse_split',
    );
    if (advantaged.length < 3) continue;

    const names = advantaged
      .sort((a, b) => (b.woba_delta_vs_other_hand ?? 0) - (a.woba_delta_vs_other_hand ?? 0))
      .slice(0, 3)
      .map(b => `${b.batter_name} +${Math.round((b.woba_delta_vs_other_hand ?? 0) * 1000)}`)
      .join(', ');

    insights.push({
      id: `lineup_platoon_${side}`,
      dedupeKey: `lineup_platoon:${side}`,
      icon: '🎯',
      tone: 'positive',
      scope: 'game',
      ...teamForSide(side, ctx.game),
      priority: 80,
      headline: `🎯 ${teamName} lineup has ${advantaged.length} platoon edges vs ${opposingPitcherName}`,
      detail: `Strong-side hitters tonight: ${names}.`,
    });
  }

  return insights;
}

function splitPaOk(pa: number | undefined): boolean {
  return (pa ?? 0) >= T.MIN_PA_SPLIT;
}

function pitchesSeenOk(n: number | undefined): boolean {
  return (n ?? 0) >= T.MIN_PITCHES_VS_TYPE;
}

function finalize(insights: Insight[], max: number): Insight[] {
  const sorted = [...insights].sort((a, b) => b.priority - a.priority);
  const seen = new Set<string>();
  const out: Insight[] = [];
  for (const ins of sorted) {
    const key = ins.dedupeKey ?? ins.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ins);
    if (out.length >= max) break;
  }
  return out;
}

function avgSplitStat(splits: BatterSplitRow[], pick: (b: BatterSplitRow) => number | null): number | null {
  const vals = splits.filter(s => splitPaOk(s.pa)).map(pick).filter((v): v is number => v != null && Number.isFinite(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function batterVsPitchFor(
  rows: BatterVsPitchTypeRow[],
  batterId: number,
  pitchType: string,
): BatterVsPitchTypeRow | undefined {
  return rows.find(r => Number(r.batter_id) === batterId && r.pitch_type === pitchType);
}

function topUsagePitch(arsenal: PitcherArsenalRow[], minUsage = 25): PitcherArsenalRow | null {
  const sorted = [...arsenal]
    .filter(p => (p.pitches_thrown ?? 0) >= T.MIN_PITCHES_PER_TYPE)
    .sort((a, b) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0));
  const top = sorted[0];
  if (!top || (top.usage_pct ?? 0) < minUsage) return null;
  return top;
}

function wipeoutPitch(arsenal: PitcherArsenalRow[]): PitcherArsenalRow | null {
  return (
    arsenal.find(
      p =>
        (p.whiff_pct ?? 0) >= T.WIPEOUT_WHIFF &&
        (p.usage_pct ?? 0) >= T.WIPEOUT_USAGE &&
        (p.pitches_thrown ?? 0) >= T.MIN_PITCHES_PER_TYPE,
    ) ?? null
  );
}

function gameInsightsForPitcher(
  ctx: GameContext,
  side: 'away' | 'home',
): Insight[] {
  const insights: Insight[] = [];
  const pitcher =
    side === 'away'
      ? {
          id: ctx.game.away_sp_id,
          name: ctx.game.away_sp_name,
          hand: ctx.game.away_sp_hand,
          arsenal: ctx.awayArsenal,
          bb: ctx.awayBattedBall,
        }
      : {
          id: ctx.game.home_sp_id,
          name: ctx.game.home_sp_name,
          hand: ctx.game.home_sp_hand,
          arsenal: ctx.homeArsenal,
          bb: ctx.homeBattedBall,
        };
  const oppLineup = side === 'away' ? ctx.homeLineup : ctx.awayLineup;
  const oppSplits = side === 'away' ? ctx.homeLineupSplits : ctx.awayLineupSplits;
  const oppVsPitch = side === 'away' ? ctx.homeBatterVsPitch : ctx.awayBatterVsPitch;
  const handArsenal = arsenalForOpposingLineup(pitcher.arsenal, oppLineup, pitcher.hand);
  const handLabel = pitcher.hand === 'R' ? 'right' : 'left';
  const team = teamForSide(side, ctx.game);

  const overall = pitcher.bb.overall;
  const wind = ctx.game.wind_speed_mph ?? 0;

  // HR risk
  if (
    overall &&
    (overall.fb_pct ?? 0) >= T.FB_HEAVY_PITCHER &&
    wind >= T.WIND_OUT_THRESHOLD_MPH &&
    windOut(ctx.game.wind_direction) &&
    !ctx.park?.has_roof
  ) {
    const threats = oppSplits.filter(
      s =>
        splitPaOk(s.pa) &&
        (s.pull_air_pct ?? 0) >= T.PULL_AIR_THREAT &&
        (s.hr_per_fb_pct ?? 0) >= T.PULL_AIR_HR_FB,
    );
    const pullAir = oppSplits.filter(
      s => splitPaOk(s.pa) && (s.pull_air_pct ?? 0) >= T.PULL_AIR_THREAT,
    );
    if (threats.length >= 2 && pullAir.length >= 2) {
      const names = threats
        .slice(0, 3)
        .map(s => `${s.batter_name} (${Math.round(s.pull_air_pct ?? 0)}% pull-air, ${formatPct(s.hr_per_fb_pct)} HR/FB)`)
        .join('; ');
      insights.push({
        id: `hr_risk_${side}`,
        dedupeKey: `hr_risk:${pitcher.id}`,
        icon: '🌪️',
        tone: 'danger',
        scope: 'game',
        pitcher_id: pitcher.id,
        ...team,
        priority: 95,
        headline: `🌪️ ${pitcher.name} (fly-ball) vs ${pullAir.length} pull-air hitters, ${Math.round(wind)} mph out`,
        detail: `Pitcher fly-ball rate ${formatPct(overall.fb_pct)}. Wind blowing out. Threats: ${names}.`,
      });
    }
  }

  insights.push(...platoonMixShiftInsights(pitcher.id, pitcher.name, pitcher.arsenal, team));

  // K-prop over
  const wipeout = wipeoutPitch(handArsenal);
  const lineupK = avgSplitStat(oppSplits, s => s.k_pct);
  const pitcherK = overall?.k_pct;
  if (
    wipeout &&
    lineupK != null &&
    lineupK >= T.LINEUP_K_HEAVY &&
    pitcherK != null &&
    pitcherK >= T.PITCHER_K_HEAVY
  ) {
    const highKHitters = oppSplits.filter(s => {
      if (!splitPaOk(s.pa) || (s.k_pct ?? 0) < 30) return false;
      const vs = batterVsPitchFor(oppVsPitch, s.batter_id, wipeout.pitch_type);
      return vs != null && pitchesSeenOk(vs.pitches_seen) && (vs.whiff_pct ?? 0) >= 30;
    });
    insights.push({
      id: `k_upside_${side}`,
      dedupeKey: `k_upside:${pitcher.id}`,
      icon: '🎯',
      tone: 'positive',
      scope: 'game',
      pitcher_id: pitcher.id,
      ...team,
      priority: 90,
      headline: `🎯 Strikeout upside — ${wipeout.pitch_type_label} (${formatPct(wipeout.whiff_pct)} whiff), lineup ${Math.round(lineupK)}% K vs ${handLabel}HP`,
      detail: `${wipeout.pitch_type_label} used ${Math.round(wipeout.usage_pct ?? 0)}% with ${formatPct(wipeout.whiff_pct)} whiff. Pitcher K% ${formatPct(pitcherK)}. ${highKHitters.length} lineup hitters whiff ≥30% on this pitch.`,
    });
  }

  // Pitch mismatch — lineup crushes heavily-used pitch
  for (const pitch of handArsenal) {
    if ((pitch.usage_pct ?? 0) < T.PITCH_USAGE_RELEVANT) continue;
    if ((pitch.xwoba_allowed ?? 0) < T.PITCHER_VULN_XWOBA) continue;
    const crushers = oppSplits.filter(s => {
      const vs = batterVsPitchFor(oppVsPitch, s.batter_id, pitch.pitch_type);
      if (!vs || !pitchesSeenOk(vs.pitches_seen) || (vs.pa ?? 0) < T.LINEUP_CRUSH_MIN_PA) return false;
      return (vs.xwoba ?? 0) >= T.CRUSH_XWOBA && (vs.slg ?? 0) >= T.CRUSH_SLG;
    });
    if (crushers.length >= T.LINEUP_CRUSH_COUNT) {
      const list = crushers
        .slice(0, 4)
        .map(s => {
          const vs = batterVsPitchFor(oppVsPitch, s.batter_id, pitch.pitch_type)!;
          return `${s.batter_name} (.${formatRate(vs.slg)} SLG, ${formatRate(vs.xwoba)} xwOBA)`;
        })
        .join('; ');
      insights.push({
        id: `pitch_crush_${side}_${pitch.pitch_type}`,
        dedupeKey: `pitch_crush:${pitcher.id}:${pitch.pitch_type}`,
        icon: '⚠️',
        tone: 'warn',
        scope: 'game',
        pitcher_id: pitcher.id,
        ...team,
        priority: 85,
        headline: `⚠️ ${pitcher.name}'s ${pitch.pitch_type_label} hittable — ${crushers.length} hitters crush it`,
        detail: `Usage ${Math.round(pitch.usage_pct ?? 0)}%, pitcher allows ${formatRate(pitch.xwoba_allowed)} xwOBA on pitch. ${list}.`,
      });
      break;
    }
  }

  // Ground-ball pitcher
  if (
    overall &&
    (overall.gb_pct ?? 0) >= T.GB_HEAVY &&
    (overall.fb_pct ?? 0) <= T.FB_LOW &&
    (overall.hr_per_fb_pct ?? 0) <= T.HR_FB_LOW
  ) {
    const lineupGb = avgSplitStat(oppSplits, s => s.gb_pct);
    if (lineupGb != null && lineupGb < 42) {
      insights.push({
        id: `gb_machine_${side}`,
        dedupeKey: `gb_machine:${pitcher.id}`,
        icon: '🧱',
        tone: 'neutral',
        scope: 'game',
        pitcher_id: pitcher.id,
        ...team,
        priority: 70,
        headline: `🧱 Ground-ball profile — ${formatPct(overall.gb_pct)} ground-ball rate`,
        detail: `Fly-ball lineup (avg ${Math.round(lineupGb)}% GB vs ${handLabel}HP) vs extreme ground-ball pitcher. Often caps total upside.`,
      });
    }
  }

  // Platoon advantage
  const platoonSide = pitcher.hand === 'R' ? 'L' : 'R';
  const platoonCount = (side === 'away' ? ctx.homeLineup : ctx.awayLineup).filter(l =>
    platoonSide === 'L' ? l.bat_side === 'L' || l.bat_side === 'S' : l.bat_side === 'R' || l.bat_side === 'S',
  ).length;
  const vsHandBb = platoonSide === 'L' ? pitcher.bb.vs_L : pitcher.bb.vs_R;
  if (
    platoonCount >= T.PLATOON_MIN_HITTERS &&
    vsHandBb &&
    (vsHandBb.xwoba_allowed ?? 0) >= T.PLATOON_XWOBA_ALLOWED
  ) {
    const handName = platoonSide === 'L' ? 'left-handed' : 'right-handed';
    insights.push({
      id: `platoon_${side}`,
      dedupeKey: `platoon:${pitcher.id}`,
      icon: '☀️',
      tone: 'positive',
      scope: 'game',
      pitcher_id: pitcher.id,
      ...team,
      priority: 65,
      headline: `☀️ Platoon edge — ${platoonCount} ${handName} bats vs ${pitcher.name}`,
      detail: `Allows ${formatRate(vsHandBb.xwoba_allowed)} xwOBA to ${handName} batters this season.`,
    });
  }

  return insights;
}

export function generateGameInsights(ctx: GameContext): Insight[] {
  const wind = ctx.game.wind_speed_mph ?? 0;
  const gameLevel: Insight[] = [];

  if (wind >= T.WIND_IN_THRESHOLD_MPH && windIn(ctx.game.wind_direction)) {
    const total = ctx.game.total_line;
    if (total != null && total >= T.HIGH_TOTAL) {
      gameLevel.push({
        id: 'wind_in_total',
        icon: '🪶',
        tone: 'neutral',
        scope: 'game',
        priority: 75,
        headline: `🪶 Wind ${Math.round(wind)} mph blowing in — home run suppression`,
        detail: `Game total ${total} may not fully reflect wind-in effect on fly balls.`,
      });
    }
  }

  const pitcherInsights = [
    ...gameInsightsForPitcher(ctx, 'away'),
    ...gameInsightsForPitcher(ctx, 'home'),
  ];

  return finalize(
    [...gameLevel, ...parkGameInsights(ctx), ...lineupPlatoonGameInsights(ctx), ...pitcherInsights],
    5,
  );
}

export function generatePitcherInsights(ctx: PitcherContext): Insight[] {
  const insights: Insight[] = [];
  const { arsenal, battedBall, pitcherId, pitcherName } = ctx;

  const wipeout = arsenal.A.find(
    p =>
      (p.whiff_pct ?? 0) >= T.WIPEOUT_WHIFF_STRICT &&
      (p.usage_pct ?? 0) >= T.WIPEOUT_USAGE &&
      (p.pitches_thrown ?? 0) >= 100,
  );
  if (wipeout) {
    insights.push({
      id: `pitcher_wipeout_${pitcherId}`,
      dedupeKey: `wipeout:${pitcherId}`,
      icon: '🥊',
      tone: 'positive',
      scope: 'pitcher',
      pitcher_id: pitcherId,
      priority: 80,
      headline: `🥊 ${wipeout.pitch_type_label}: ${formatPct(wipeout.whiff_pct)} whiff`,
      detail: `Used ${Math.round(wipeout.usage_pct ?? 0)}% of the time (${wipeout.pitches_thrown} pitches).`,
    });
  }

  const top = topUsagePitch(arsenal.A, 20);
  if (
    top &&
    pitchFamily(top.pitch_type) === 'fastball' &&
    (top.xwoba_allowed ?? 0) >= 0.37 &&
    (top.pitches_thrown ?? 0) >= 100
  ) {
    insights.push({
      id: `pitcher_hittable_fb_${pitcherId}`,
      dedupeKey: `hittable_fb:${pitcherId}`,
      icon: '💣',
      tone: 'warn',
      scope: 'pitcher',
      pitcher_id: pitcherId,
      priority: 75,
      headline: `💣 Hittable ${top.pitch_type_label} (${formatRate(top.xwoba_allowed)} xwOBA)`,
      detail: `Primary pitch at ${Math.round(top.usage_pct ?? 0)}% usage.`,
    });
  }

  const diverse = arsenal.A.filter(
    p => (p.usage_pct ?? 0) >= 10 && (p.pitches_thrown ?? 0) >= T.MIN_PITCHES_PER_TYPE,
  ).length;
  if (diverse >= 5) {
    insights.push({
      id: `pitcher_diverse_${pitcherId}`,
      dedupeKey: `diverse:${pitcherId}`,
      icon: '🎪',
      tone: 'neutral',
      scope: 'pitcher',
      pitcher_id: pitcherId,
      priority: 40,
      headline: '🎪 Five-pitch mix',
      detail: 'Deep arsenal — harder for hitters to sit on one pitch type.',
    });
  }

  void battedBall;
  void pitcherName;

  return finalize(insights, 2);
}

export function generateBatterInsights(ctx: BatterContext): Insight[] {
  const insights: Insight[] = [];
  const { batter, opposingArsenal, opposingBattedBall, batterVsPitchType, game, park } = ctx;

  if (!splitPaOk(batter.pa)) return [];

  const handLabel = ctx.opposingPitcherHand === 'R' ? 'right' : 'left';
  const pitcherFb = opposingBattedBall.overall?.fb_pct ?? 0;
  const wind = game.wind_speed_mph ?? 0;

  const handArsenal = getArsenalForBatter(batter, ctx.opposingPitcherHand, opposingArsenal);

  // Crushes #1 pitch
  const top = topUsagePitch(handArsenal, 25);
  if (top) {
    const vs = batterVsPitchFor(batterVsPitchType, batter.batter_id, top.pitch_type);
    if (
      vs &&
      pitchesSeenOk(vs.pitches_seen) &&
      (vs.pitches_seen ?? 0) >= 25 &&
      (vs.xwoba ?? 0) >= T.CRUSH_XWOBA &&
      (vs.slg ?? 0) >= T.CRUSH_SLG
    ) {
      insights.push({
        id: `batter_crush_${batter.batter_id}_${top.pitch_type}`,
        icon: '⚔️',
        tone: 'positive',
        scope: 'batter',
        batter_id: batter.batter_id,
        priority: 90,
        headline: `⚔️ Crushes ${ctx.opposingPitcherName}'s ${top.pitch_type_label} (.${formatRate(vs.slg)} SLG)`,
        detail: `${vs.pitches_seen} pitches seen, ${formatRate(vs.xwoba)} xwOBA vs ${formatRate(top.xwoba_allowed)} allowed on pitch.`,
      });
    }
  }

  // Whiffs vs wipeout
  const wipeout = wipeoutPitch(handArsenal);
  if (wipeout) {
    const vs = batterVsPitchFor(batterVsPitchType, batter.batter_id, wipeout.pitch_type);
    if (
      vs &&
      pitchesSeenOk(vs.pitches_seen) &&
      (vs.whiff_pct ?? 0) >= 35 &&
      (batter.k_pct ?? 0) >= 25
    ) {
      insights.push({
        id: `batter_whiff_${batter.batter_id}_${wipeout.pitch_type}`,
        dedupeKey: `batter_whiff:${batter.batter_id}:${wipeout.pitch_type}`,
        icon: '🚫',
        tone: 'warn',
        scope: 'batter',
        batter_id: batter.batter_id,
        priority: 85,
        headline: `🚫 Whiffs vs ${wipeout.pitch_type_label} (${formatPct(vs.whiff_pct)})`,
        detail: `${vs.pitches_seen} pitches seen on ${wipeout.pitch_type_label}. Season ${formatPct(batter.k_pct)} K% vs ${handLabel}HP.`,
      });
    }
  }

  // Pull-air HR threat
  if (
    (batter.pull_air_pct ?? 0) >= T.PULL_AIR_THREAT &&
    (batter.hr_per_fb_pct ?? 0) >= 12 &&
    pitcherFb >= 35 &&
    wind >= 10 &&
    windOut(game.wind_direction) &&
    !park?.has_roof
  ) {
    insights.push({
      id: `batter_pull_hr_${batter.batter_id}`,
      icon: '🎯',
      tone: 'danger',
      scope: 'batter',
      batter_id: batter.batter_id,
      priority: 88,
      headline: '🎯 Pull-air home run threat in this matchup',
      detail: `${formatPct(batter.pull_air_pct)} pull-air, ${formatPct(batter.hr_per_fb_pct)} HR/FB vs ${handLabel}HP. Pitcher ${formatPct(pitcherFb)} FB. Wind out ${Math.round(wind)} mph.`,
    });
  }

  // Hot vs hand (platoon delta)
  const delta = batter.xwoba_delta_vs_other_hand;
  if (
    delta != null &&
    delta >= T.HOT_COLD_DELTA &&
    (batter.barrel_pct ?? 0) >= T.HOT_BARREL_CORROBORATION
  ) {
    insights.push({
      id: `batter_hot_${batter.batter_id}`,
      icon: '🔥',
      tone: 'positive',
      scope: 'batter',
      batter_id: batter.batter_id,
      priority: 70,
      headline: `🔥 ${formatRate(batter.xwoba)} xwOBA vs ${handLabel}HP (+${delta.toFixed(3)})`,
      detail: `${batter.pa} PA in split. ${formatPct(batter.barrel_pct)} barrel rate confirms quality contact vs other hand.`,
    });
  } else if (delta != null && delta <= -T.HOT_COLD_DELTA) {
    insights.push({
      id: `batter_cold_${batter.batter_id}`,
      icon: '❄️',
      tone: 'warn',
      scope: 'batter',
      batter_id: batter.batter_id,
      priority: 65,
      headline: `❄️ ${formatRate(batter.xwoba)} xwOBA vs ${handLabel}HP (${delta.toFixed(3)})`,
      detail: `${batter.pa} PA in split — ${Math.round(delta * 1000)} wOBA pts below opposite hand.`,
    });
  }

  // K-prone vs wipeout pitch type
  if (wipeout) {
    const vs = batterVsPitchFor(batterVsPitchType, batter.batter_id, wipeout.pitch_type);
    if (
      vs &&
      pitchesSeenOk(vs.pitches_seen) &&
      (vs.k_pct ?? 0) >= 35
    ) {
      insights.push({
        id: `batter_k_pitch_${batter.batter_id}_${wipeout.pitch_type}`,
        dedupeKey: `batter_k_pitch:${batter.batter_id}:${wipeout.pitch_type}`,
        icon: '😬',
        tone: 'warn',
        scope: 'batter',
        batter_id: batter.batter_id,
        priority: 60,
        headline: `😬 ${formatPct(vs.k_pct)} K vs ${wipeout.pitch_type_label}`,
        detail: `${vs.pitches_seen} pitches seen. Pitcher uses ${wipeout.pitch_type_label} ${Math.round(wipeout.usage_pct ?? 0)}% vs this hand.`,
      });
    }
  }

  // Power profile
  if (
    (batter.iso ?? 0) >= T.POWER_ISO &&
    (batter.barrel_pct ?? 0) >= T.POWER_BARREL &&
    (opposingBattedBall.overall?.hr_per_fb_pct ?? 0) >= 12 &&
    wind >= 10 &&
    windOut(game.wind_direction) &&
    !park?.has_roof
  ) {
    insights.push({
      id: `batter_power_${batter.batter_id}`,
      icon: '💪',
      tone: 'positive',
      scope: 'batter',
      batter_id: batter.batter_id,
      priority: 75,
      headline: `💪 Power up — ${formatRate(batter.iso)} ISO, ${formatPct(batter.barrel_pct)} barrel`,
      detail: `Pitcher allows ${formatPct(opposingBattedBall.overall?.hr_per_fb_pct)} HR/FB. Favorable wind for fly balls.`,
    });
  }

  // L10 recent form vs season (independent of platoon delta)
  if (batter.recent_form && (batter.recent_form.bbe ?? 0) >= MIN_L10_BBE) {
    const recent = batter.recent_form;
    const barrelDelta = (recent.barrel_pct ?? 0) - (batter.barrel_pct ?? 0);
    const hardHitDelta = (recent.hard_hit_pct ?? 0) - (batter.hard_hit_pct ?? 0);
    const xwobaDelta = (recent.xwoba ?? 0) - (batter.xwoba ?? 0);

    if (countHotSignals(batter, recent) >= 2) {
      insights.push({
        id: `recent_hot_${batter.batter_id}`,
        icon: '🔥',
        tone: 'positive',
        scope: 'batter',
        batter_id: batter.batter_id,
        priority: 72,
        headline: `Hot — L10 barrel ${recent.barrel_pct?.toFixed(0)}%, hard-hit ${recent.hard_hit_pct?.toFixed(0)}%`,
        detail:
          `Last 10 games vs ${batter.vs_pitcher_hand}HP: ` +
          `barrel ${recent.barrel_pct?.toFixed(1)}% (season ${batter.barrel_pct?.toFixed(1)}%, ` +
          `${barrelDelta >= 0 ? '+' : ''}${barrelDelta.toFixed(1)}pp), ` +
          `hard-hit ${recent.hard_hit_pct?.toFixed(1)}% (season ${batter.hard_hit_pct?.toFixed(1)}%, ` +
          `${hardHitDelta >= 0 ? '+' : ''}${hardHitDelta.toFixed(1)}pp), ` +
          `xwOBA .${Math.round((recent.xwoba ?? 0) * 1000)} (season .${Math.round((batter.xwoba ?? 0) * 1000)}).`,
      });
    }

    if (countColdSignals(batter, recent) >= 2) {
      insights.push({
        id: `recent_cold_${batter.batter_id}`,
        icon: '🥶',
        tone: 'danger',
        scope: 'batter',
        batter_id: batter.batter_id,
        priority: 68,
        headline: 'Cold — L10 contact has fallen off',
        detail:
          `Recent form below season: barrel ${barrelDelta.toFixed(1)}pp, hard-hit ${hardHitDelta.toFixed(1)}pp, ` +
          `xwOBA ${xwobaDelta >= 0 ? '+' : ''}${xwobaDelta.toFixed(3)}. Skip for player-prop OVERs.`,
      });
    }
  }

  const { opposingPitcherArchetype, batterVsArchetype } = ctx;
  if (
    isDisplayArchetype(opposingPitcherArchetype) &&
    batterVsArchetype &&
    batterVsArchetype.pa >= MIN_PA_VS_ARCHETYPE_INSIGHT &&
    batterVsArchetype.xwoba != null &&
    batter.xwoba != null
  ) {
    const xwobaDelta = batterVsArchetype.xwoba - batter.xwoba;
    const archMeta = ARCHETYPE_META[opposingPitcherArchetype];
    const handHp = ctx.opposingPitcherHand === 'R' ? 'R' : 'L';

    if (xwobaDelta >= ARCHETYPE_XWOBA_DELTA) {
      insights.push({
        id: `crushes_archetype_${batter.batter_id}`,
        icon: archMeta.icon,
        tone: 'positive',
        scope: 'batter',
        batter_id: batter.batter_id,
        priority: 80,
        headline: `Crushes ${opposingPitcherArchetype} pitchers (+${toMilliRate(xwobaDelta)} xwOBA pts)`,
        detail: `${batter.batter_name} has .${toMilliRate(batterVsArchetype.xwoba)} xwOBA vs ${opposingPitcherArchetype} ${handHp}HP this season (${batterVsArchetype.pa} PA), vs .${toMilliRate(batter.xwoba)} overall.`,
      });
    } else if (xwobaDelta <= -ARCHETYPE_XWOBA_DELTA) {
      insights.push({
        id: `struggles_archetype_${batter.batter_id}`,
        icon: archMeta.icon,
        tone: 'danger',
        scope: 'batter',
        batter_id: batter.batter_id,
        priority: 75,
        headline: `Struggles vs ${opposingPitcherArchetype} pitchers (${toMilliRate(xwobaDelta)} xwOBA pts)`,
        detail: `${batter.batter_name} has .${toMilliRate(batterVsArchetype.xwoba)} xwOBA vs ${opposingPitcherArchetype} ${handHp}HP this season (${batterVsArchetype.pa} PA), vs .${toMilliRate(batter.xwoba)} overall.`,
      });
    }
  }

  insights.push(...platoonInsightsForBatter(batter));

  if (park) {
    const porch = shortPorchBatterInsight(batter, park, ctx.opposingPitcherHand);
    if (porch) insights.push(porch);
  }

  return finalize(insights, 2);
}

export function buildGameContext(
  game: MatchupGame,
  data: {
    awayArsenal: PitcherArsenalByHand;
    homeArsenal: PitcherArsenalByHand;
    awayBattedBall: PitcherBattedBallProfile;
    homeBattedBall: PitcherBattedBallProfile;
    awayLineup: LineupRow[];
    homeLineup: LineupRow[];
    awayLineupSplits: BatterSplitRow[];
    homeLineupSplits: BatterSplitRow[];
    awayBatterVsPitch: BatterVsPitchTypeRow[];
    homeBatterVsPitch: BatterVsPitchTypeRow[];
  },
  park: ParkHRFactors | null = null,
): GameContext {
  return { game, park, ...data };
}

export { parkSuppressesHr };
