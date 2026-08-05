/** Display helpers only — no analytics. */

import type { CompDraftPick, CompGame, CompMarket, CompSide } from './types';

export function formatSignedLine(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  if (v === 0) return 'PK';
  const abs = Math.abs(v);
  const body = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return v > 0 ? `+${body}` : `−${body}`;
}

export function currentLineForSide(game: CompGame, market: CompMarket, side: CompSide): number | null {
  if (market === 'spread') {
    if (game.spread_home == null) return null;
    return side === 'home' ? Number(game.spread_home) : -Number(game.spread_home);
  }
  return game.total == null ? null : Number(game.total);
}

export function pickButtonLabel(
  game: CompGame,
  market: CompMarket,
  side: CompSide
): { title: string; line: string; pending: boolean } {
  if (market === 'spread') {
    const pending = game.spread_home == null;
    const line = currentLineForSide(game, market, side);
    const team = side === 'home' ? game.home_team : game.away_team;
    return {
      title: team,
      line: pending ? 'line pending' : formatSignedLine(line),
      pending,
    };
  }
  const pending = game.total == null;
  const n = game.total == null ? null : formatSignedLine(game.total).replace(/^[+−]/, '');
  return {
    title: side === 'over' ? 'Over' : 'Under',
    line: pending ? 'line pending' : (n ?? '—'),
    pending,
  };
}

/** True when this competition week is the unscored practice / test round. */
export function isPracticeWeek(
  week: { week_no: number; label: string; season?: number } | null | undefined,
  allWeeks?: Array<{ week_no: number }>
): boolean {
  if (!week) return false;
  if (week.week_no === 0) return true;
  if (/practice|test\s*round/i.test(week.label)) return true;
  // Bridge: before warehouse renumbers the test slate to week_no=0, the earliest
  // week (≤1) is treated as the practice round.
  if (allWeeks && allWeeks.length > 0) {
    const min = Math.min(...allWeeks.map((w) => w.week_no));
    if (week.week_no === min && min <= 1) return true;
  }
  return false;
}

/** Display title — practice weeks always read Week 0 (Practice Round). */
export function displayWeekTitle(
  week: { week_no: number; label: string; season?: number } | null | undefined,
  allWeeks?: Array<{ week_no: number }>
): string {
  if (!week) return 'Competition';
  if (isPracticeWeek(week, allWeeks)) return 'Week 0 (Practice Round)';
  return week.label;
}

export function pickSummaryLabel(
  game: CompGame | undefined,
  pick: Pick<CompDraftPick, 'market' | 'side'> & { line?: number | null },
  opts?: { stamped?: boolean }
): string {
  if (!game) return 'Unknown game';
  if (pick.market === 'spread') {
    const team = pick.side === 'home' ? game.home_team : game.away_team;
    const line =
      pick.line != null
        ? formatSignedLine(pick.line)
        : formatSignedLine(currentLineForSide(game, 'spread', pick.side));
    return `${team} ${line}${opts?.stamped ? '' : ''}`;
  }
  const line =
    pick.line != null
      ? String(pick.line)
      : game.total != null
        ? String(game.total)
        : '—';
  return `${pick.side === 'over' ? 'Over' : 'Under'} ${line}`;
}

export function matchupLabel(game: CompGame): string {
  return `${game.away_team} @ ${game.home_team}`;
}

/** Local kickoff display. */
export function formatKickoffLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Deadline with ET + local note. */
export function formatDeadlinePair(iso: string): { et: string; local: string } {
  const d = new Date(iso);
  const et = d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const local = d.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  return { et, local: `${local} your time` };
}

export function dayGroupLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Upcoming';
  const wd = d.toLocaleDateString(undefined, { weekday: 'long' });
  if (wd === 'Friday') return 'Friday Night';
  if (wd === 'Saturday') return 'Saturday';
  if (wd === 'Sunday') return 'Sunday';
  if (wd === 'Monday') return 'Monday';
  return wd;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${String(mins).padStart(2, '0')}m`;
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatCoverPoints(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const body = Number.isInteger(v) ? String(v) : v.toFixed(1);
  if (v > 0) return `+${body}`;
  return body;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return 'just now';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function pickKey(p: { game_id: number; market: CompMarket }): string {
  return `${p.game_id}:${p.market}`;
}
