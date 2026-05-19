import type {
  BatterSplitRow,
  BatterVsPitchTypeRow,
  BatterTopPitchMatchMap,
  LineupRow,
  MatchupGame,
  MatchupInsight,
  PitcherArsenalRow,
  PitcherBattedBallProfile,
  PitcherBattedBallRow,
  PitchHand,
} from '@/types/mlb-matchups';

export function seasonFromDate(dateStr: string): number {
  const y = Number(dateStr?.slice(0, 4));
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

export function normalizeHand(raw: string | null | undefined): PitchHand | null {
  if (!raw) return null;
  const h = raw.trim().toUpperCase();
  if (h === 'R' || h.startsWith('R')) return 'R';
  if (h === 'L' || h.startsWith('L')) return 'L';
  return null;
}

export function formatPct(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function hasPitcherBattedBallRow(row: PitcherBattedBallRow | null | undefined): boolean {
  if (!row) return false;
  if ((row.batters_faced ?? 0) > 0) return true;
  return (
    row.k_pct != null ||
    row.gb_pct != null ||
    row.fb_pct != null ||
    row.xwoba_allowed != null ||
    row.woba_allowed != null
  );
}

/** xwOBA allowed with wOBA fallback when xwOBA column is empty in the feed. */
export function pitcherXwobaAllowed(row: PitcherBattedBallRow | null | undefined): number | null {
  if (!row) return null;
  if (row.xwoba_allowed != null && Number.isFinite(row.xwoba_allowed)) return row.xwoba_allowed;
  if (row.woba_allowed != null && Number.isFinite(row.woba_allowed)) return row.woba_allowed;
  return null;
}

export function formatRate(value: number | null | undefined, digits = 3): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export function formatSlash(avg: number | null, obp: number | null, slg: number | null): string {
  if (avg == null && obp == null && slg == null) return '—';
  return `${formatRate(avg)} / ${formatRate(obp)} / ${formatRate(slg)}`;
}

function cleanPitchLabel(text: string): string {
  return text.replace(/\.+$/g, '').trim();
}

/** Short display label for pitch-type chips (fixed-width tables). */
export function abbrevPitchLabel(pitchType: string, fullLabel?: string): string {
  const t = pitchType.toUpperCase();
  const byCode: Record<string, string> = {
    FF: '4-Seam',
    FA: '4-Seam',
    FT: '2-Seam',
    SI: 'Sinker',
    FC: 'Cutter',
    SL: 'Slider',
    ST: 'Sweeper',
    SV: 'Slurve',
    CU: 'Curve',
    KC: 'Kn-Curve',
    CS: 'Slow Curve',
    SC: 'Screwball',
    CH: 'Change',
    FS: 'Splitter',
    FO: 'Fork',
    EP: 'Eephus',
  };
  if (byCode[t]) return byCode[t];
  const label = cleanPitchLabel(fullLabel ?? t);
  if (label.length <= 10) return label;
  return cleanPitchLabel(
    label
      .replace(/^4-Seam Fastball$/i, '4-Seam')
      .replace(/^2-Seam Fastball$/i, '2-Seam')
      .replace(/^Four-Seam Fastball$/i, '4-Seam')
      .replace(/ Fastball$/i, '')
      .replace(/^Split-Finger$/i, 'Splitter')
      .replace(/^Knuckle Curve$/i, 'Kn-Curve')
      .replace(/^Changeup$/i, 'Change')
      .replace(/^Curveball$/i, 'Curve')
      .replace(/^Slider$/i, 'Slider')
      .replace(/^Sinker$/i, 'Sinker')
      .replace(/^Cutter$/i, 'Cutter')
      .replace(/^Sweeper$/i, 'Sweeper'),
  );
}

export function formatMoneyline(ml: number | null): string {
  if (ml == null || Number.isNaN(Number(ml))) return '—';
  return ml > 0 ? `+${ml}` : String(ml);
}

export function formatGameTimeEt(timeString: string | null): string {
  if (!timeString) return 'Time TBD';
  const date = new Date(timeString);
  if (Number.isNaN(date.getTime())) return 'Time TBD';
  const time = date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${time} ET`;
}

export function formatGameDateLabel(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export type PitchFamily = 'fastball' | 'breaking' | 'offspeed' | 'other';

export function pitchFamily(pitchType: string): PitchFamily {
  const t = pitchType.toUpperCase();
  if (['FF', 'SI', 'FC', 'FA', 'FT'].includes(t)) return 'fastball';
  if (['SL', 'ST', 'SV', 'CU', 'KC', 'CS', 'SC'].includes(t)) return 'breaking';
  if (['CH', 'FS', 'FO', 'EP'].includes(t)) return 'offspeed';
  return 'other';
}

export function pitchFamilyClass(family: PitchFamily): string {
  switch (family) {
    case 'fastball':
      return 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30';
    case 'breaking':
      return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30';
    case 'offspeed':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

/**
 * Which batter hand dominates the opposing lineup (for highlighting pitcher splits).
 * Returns null when balanced (within one batter of a tie). Switch hitters use platoon side vs `pitcherHand`.
 */
export function dominantLineupHand(
  lineup: LineupRow[],
  pitcherHand?: PitchHand | null,
): 'R' | 'L' | null {
  if (!lineup.length) return null;
  let r = 0;
  let l = 0;
  for (const b of lineup) {
    let eff: 'R' | 'L' | null = null;
    if (b.bat_side === 'S' && pitcherHand) {
      eff = pitcherHand === 'R' ? 'L' : 'R';
    } else if (b.bat_side === 'R') {
      eff = 'R';
    } else if (b.bat_side === 'L') {
      eff = 'L';
    }
    if (eff === 'R') r += 1;
    else if (eff === 'L') l += 1;
  }
  if (Math.abs(r - l) <= 1) return null;
  return r > l ? 'R' : 'L';
}

/** xwOBA-style rate without leading zero: 0.318 → ".318" */
export function toMilliRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatRate(value).replace(/^0/, '');
}

export function hasEnoughPa(pa: number | null | undefined): boolean {
  return (pa ?? 0) >= 5;
}

export function hasEnoughPitchesSeen(n: number | null | undefined): boolean {
  return (n ?? 0) >= 10;
}

/** Top 3 pitches by usage (min 25 pitches thrown). */
export function getTopThreePitches(arsenal: PitcherArsenalRow[]): PitcherArsenalRow[] {
  return [...arsenal]
    .filter(p => (p.pitches_thrown ?? 0) >= 25)
    .sort((a, b) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0))
    .slice(0, 3);
}

/** Min pitches seen before tagging "strong vs" a top pitch type. */
const MIN_PITCHES_TOP_PITCH_TAG = 20;
const MIN_XWOBA_STRONG = 0.34;
const MIN_AVG_STRONG = 0.24;
const MIN_SLG_POWER = 0.45;
const MIN_AVG_FLOOR = 0.2;

/**
 * Batter hits a top pitch well — requires real production, not xwOBA alone on a bad average
 * (e.g. 0.111 AVG with inflated xwOBA from small-sample power).
 */
export function hitsWellVsPitchType(
  batter: BatterVsPitchTypeRow,
  pitcherPitch: PitcherArsenalRow | undefined,
): boolean {
  const seen = batter.pitches_seen ?? 0;
  if (seen < MIN_PITCHES_TOP_PITCH_TAG) return false;

  const avg = batter.avg;
  const slg = batter.slg;
  const bx = batter.xwoba;

  if (bx == null || !Number.isFinite(bx)) return false;

  // Hard floor: very low average is never "strong" regardless of xwOBA
  if (avg != null && avg < MIN_AVG_FLOOR) return false;

  const avgStrong = avg != null && avg >= MIN_AVG_STRONG;
  const powerProfile =
    avg != null && avg >= MIN_AVG_FLOOR && slg != null && slg >= MIN_SLG_POWER;
  if (!avgStrong && !powerProfile) return false;

  const allowed = pitcherPitch?.xwoba_allowed;
  const xwobaThreshold = Math.max(
    MIN_XWOBA_STRONG,
    allowed != null && Number.isFinite(allowed) ? allowed + 0.04 : MIN_XWOBA_STRONG,
  );

  if (bx < xwobaThreshold) return false;

  // Strong average + solid expected production
  if (avgStrong) return true;

  // Power outlier: acceptable average with big slugging and high xwOBA
  return powerProfile && bx >= xwobaThreshold + 0.02;
}

export function buildBatterTopPitchMatchMap(
  batterIds: number[],
  rows: BatterVsPitchTypeRow[],
  topPitches: PitcherArsenalRow[],
): BatterTopPitchMatchMap {
  const topTypes = new Set(topPitches.map(p => p.pitch_type));
  const byType = new Map(topPitches.map(p => [p.pitch_type, p]));
  const matched = new Map<number, string[]>();

  for (const row of rows) {
    if (!topTypes.has(row.pitch_type)) continue;
    const pitcherPitch = byType.get(row.pitch_type);
    if (!hitsWellVsPitchType(row, pitcherPitch)) continue;
    const id = Number(row.batter_id);
    const label = row.pitch_type_label || row.pitch_type;
    const list = matched.get(id) ?? [];
    if (!list.includes(label)) list.push(label);
    matched.set(id, list);
  }

  const out: BatterTopPitchMatchMap = {};
  for (const id of batterIds) {
    out[id] = matched.get(id) ?? [];
  }
  return out;
}

export function formatTopPitchMatchBadge(pitchLabels: string[]): { icon: string; label: string } | null {
  if (pitchLabels.length === 0) return null;
  if (pitchLabels.length === 1) {
    return { icon: '🎯', label: `Strong vs ${pitchLabels[0]}` };
  }
  return {
    icon: '🎯',
    label: `Hits ${pitchLabels.length} of starter's top pitches`,
  };
}

export function generateInsights(
  game: MatchupGame,
  awayArsenal: PitcherArsenalRow[],
  homeArsenal: PitcherArsenalRow[],
  awayBB: PitcherBattedBallProfile,
  homeBB: PitcherBattedBallProfile,
  awayLineupSplits: BatterSplitRow[],
  homeLineupSplits: BatterSplitRow[],
): MatchupInsight[] {
  const insights: MatchupInsight[] = [];
  const windOut = /out/i.test(game.wind_direction ?? '');
  const windIn = /in/i.test(game.wind_direction ?? '');

  const hrRisk = (
    pitcherName: string,
    bb: PitcherBattedBallProfile,
    lineupSplits: BatterSplitRow[],
  ) => {
    const overall = bb.overall;
    if (
      (overall?.fb_pct ?? 0) > 38 &&
      (game.wind_speed_mph ?? 0) >= 12 &&
      windOut
    ) {
      const pullAirHitters = lineupSplits.filter(b => (b.pull_air_pct ?? 0) > 35);
      if (pullAirHitters.length >= 2) {
        insights.push({
          icon: '🌪️',
          tone: 'warn',
          text: `${pitcherName} allows ${Math.round(overall!.fb_pct!)}% fly balls — wind blowing out and ${pullAirHitters.length} opposing hitters with pull-air rate above 35% increase home run risk`,
        });
      }
    }
  };

  hrRisk(game.away_sp_name, awayBB, homeLineupSplits);
  hrRisk(game.home_sp_name, homeBB, awayLineupSplits);

  const vulnerablePitch = (arsenal: PitcherArsenalRow[], name: string) => {
    const vulnerable = arsenal
      .filter(p => (p.pitches_thrown ?? 0) >= 25)
      .filter(p => (p.xwoba_allowed ?? 0) > 0.38 && (p.usage_pct ?? 0) > 15)
      .sort((a, b) => (b.xwoba_allowed ?? 0) - (a.xwoba_allowed ?? 0));
    const p = vulnerable[0];
    if (p) {
      insights.push({
        icon: '⚠️',
        tone: 'warn',
        text: `${name}'s ${p.pitch_type_label} has been hit hard (${formatRate(p.xwoba_allowed)} expected weighted on-base average, ${Math.round(p.usage_pct ?? 0)}% usage)`,
      });
    }
  };

  vulnerablePitch(awayArsenal, game.away_sp_name);
  vulnerablePitch(homeArsenal, game.home_sp_name);

  for (const splits of [awayLineupSplits, homeLineupSplits]) {
    const hottest = splits
      .filter(b => b.xwoba != null && b.season_avg_xwoba != null && hasEnoughPa(b.pa))
      .map(b => ({ ...b, delta: (b.xwoba ?? 0) - (b.season_avg_xwoba ?? 0) }))
      .sort((a, b) => b.delta - a.delta)
      .find(b => b.delta > 0.05);
    if (hottest) {
      insights.push({
        icon: '🔥',
        tone: 'positive',
        text: `${hottest.batter_name} is hot vs ${hottest.vs_pitcher_hand === 'R' ? 'right' : 'left'}-handed pitching — ${formatRate(hottest.xwoba)} expected weighted on-base average`,
      });
    }
  }

  if (windIn && (game.wind_speed_mph ?? 0) >= 10) {
    insights.push({
      icon: '🌬️',
      tone: 'neutral',
      text: `Wind blowing in at ${Math.round(game.wind_speed_mph!)} mph — tends to suppress fly balls and home runs`,
    });
  }

  return insights.slice(0, 5);
}

/** MLB Static CDN (content.mlb.com headshots return 403 in browsers). */
export function mlbHeadshotUrl(playerId: number, size: 60 | 213 = 60): string {
  const id = Math.trunc(playerId);
  const generic = 'd_people:generic:headshot:67:current.png';
  return `https://img.mlbstatic.com/mlb-photos/image/upload/${generic}/w_${size},q_auto:best/v1/people/${id}/headshot/67/current`;
}

export function windBannerTone(direction: string | null): 'warn' | 'info' | 'neutral' {
  if (/out/i.test(direction ?? '')) return 'warn';
  if (/in/i.test(direction ?? '')) return 'info';
  return 'neutral';
}
