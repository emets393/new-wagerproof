import type {
  BatterSplitRow,
  BatterVsPitchTypeRow,
  LineupRow,
  MatchupGame,
  PitcherArsenalRow,
  PitcherBattedBallProfile,
  PitchHand,
} from '@/types/mlb-matchups';
import { formatPct, formatRate, pitchFamily } from '@/utils/mlbPitcherMatchups';

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
} as const;

export interface Insight {
  id: string;
  icon: string;
  tone: 'positive' | 'warn' | 'danger' | 'neutral';
  scope: 'game' | 'pitcher' | 'batter';
  pitcher_id?: number;
  batter_id?: number;
  priority: number;
  headline: string;
  detail: string;
  /** Dedupe key for suppressing lower-priority related insights */
  dedupeKey?: string;
}

export interface GameContext {
  game: MatchupGame;
  awayArsenal: PitcherArsenalRow[];
  homeArsenal: PitcherArsenalRow[];
  awayBattedBall: PitcherBattedBallProfile;
  homeBattedBall: PitcherBattedBallProfile;
  awayLineup: LineupRow[];
  homeLineup: LineupRow[];
  awayBatterSplits: BatterSplitRow[];
  homeBatterSplits: BatterSplitRow[];
  /** Away lineup batters vs home SP hand (all relevant pitch types) */
  awayBatterVsPitch: BatterVsPitchTypeRow[];
  /** Home lineup batters vs away SP hand */
  homeBatterVsPitch: BatterVsPitchTypeRow[];
}

export interface PitcherContext {
  pitcherId: number;
  pitcherName: string;
  pitchHand: PitchHand;
  arsenal: PitcherArsenalRow[];
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
  opposingArsenal: PitcherArsenalRow[];
  opposingBattedBall: PitcherBattedBallProfile;
  batterVsPitchType: BatterVsPitchTypeRow[];
  game: MatchupGame;
}

function windOut(dir: string | null): boolean {
  return /out/i.test(dir ?? '');
}

function windIn(dir: string | null): boolean {
  return /in/i.test(dir ?? '');
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
  const oppSplits = side === 'away' ? ctx.homeBatterSplits : ctx.awayBatterSplits;
  const oppVsPitch = side === 'away' ? ctx.homeBatterVsPitch : ctx.awayBatterVsPitch;
  const handLabel = pitcher.hand === 'R' ? 'right' : 'left';

  const overall = pitcher.bb.overall;
  const wind = ctx.game.wind_speed_mph ?? 0;

  // HR risk
  if (
    overall &&
    (overall.fb_pct ?? 0) >= T.FB_HEAVY_PITCHER &&
    wind >= T.WIND_OUT_THRESHOLD_MPH &&
    windOut(ctx.game.wind_direction)
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
        priority: 95,
        headline: `🌪️ ${pitcher.name} (fly-ball) vs ${pullAir.length} pull-air hitters, ${Math.round(wind)} mph out`,
        detail: `Pitcher fly-ball rate ${formatPct(overall.fb_pct)}. Wind blowing out. Threats: ${names}.`,
      });
    }
  }

  // K-prop over
  const wipeout = wipeoutPitch(pitcher.arsenal);
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
      priority: 90,
      headline: `🎯 Strikeout upside — ${wipeout.pitch_type_label} (${formatPct(wipeout.whiff_pct)} whiff), lineup ${Math.round(lineupK)}% K vs ${handLabel}HP`,
      detail: `${wipeout.pitch_type_label} used ${Math.round(wipeout.usage_pct ?? 0)}% with ${formatPct(wipeout.whiff_pct)} whiff. Pitcher K% ${formatPct(pitcherK)}. ${highKHitters.length} lineup hitters whiff ≥30% on this pitch.`,
    });
  }

  // Pitch mismatch — lineup crushes heavily-used pitch
  for (const pitch of pitcher.arsenal) {
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

  return finalize([...gameLevel, ...pitcherInsights], 5);
}

export function generatePitcherInsights(ctx: PitcherContext): Insight[] {
  const insights: Insight[] = [];
  const { arsenal, battedBall, pitcherId, pitcherName } = ctx;

  const wipeout = arsenal.find(
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

  const top = topUsagePitch(arsenal, 20);
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

  const diverse = arsenal.filter(
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
  const { batter, opposingArsenal, opposingBattedBall, batterVsPitchType, game } = ctx;

  if (!splitPaOk(batter.pa)) return [];

  const handLabel = ctx.opposingPitcherHand === 'R' ? 'right' : 'left';
  const pitcherFb = opposingBattedBall.overall?.fb_pct ?? 0;
  const wind = game.wind_speed_mph ?? 0;

  // Crushes #1 pitch
  const top = topUsagePitch(opposingArsenal, 25);
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
  const wipeout = wipeoutPitch(opposingArsenal);
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
    (wind >= 10 && windOut(game.wind_direction))
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

  // Hot vs hand
  const delta =
    batter.xwoba != null && batter.season_avg_xwoba != null
      ? batter.xwoba - batter.season_avg_xwoba
      : null;
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
      detail: `${batter.pa} PA in split. ${formatPct(batter.barrel_pct)} barrel rate confirms quality contact.`,
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
      detail: `${batter.pa} PA in split vs season baseline ${formatRate(batter.season_avg_xwoba)}.`,
    });
  }

  // Power profile
  if (
    (batter.iso ?? 0) >= T.POWER_ISO &&
    (batter.barrel_pct ?? 0) >= T.POWER_BARREL &&
    (opposingBattedBall.overall?.hr_per_fb_pct ?? 0) >= 12 &&
    (wind >= 10 && windOut(game.wind_direction))
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

  return finalize(insights, 2);
}

export function buildGameContext(
  game: MatchupGame,
  data: {
    awayArsenal: PitcherArsenalRow[];
    homeArsenal: PitcherArsenalRow[];
    awayBattedBall: PitcherBattedBallProfile;
    homeBattedBall: PitcherBattedBallProfile;
    awayLineup: LineupRow[];
    homeLineup: LineupRow[];
    awayBatterSplits: BatterSplitRow[];
    homeBatterSplits: BatterSplitRow[];
    awayBatterVsPitch: BatterVsPitchTypeRow[];
    homeBatterVsPitch: BatterVsPitchTypeRow[];
  },
): GameContext {
  return { game, ...data };
}
