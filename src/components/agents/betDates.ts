import { AgentParlay, AgentPick } from '@/types/agent';

/**
 * When a bet actually PLAYS, as opposed to when the agent made it.
 *
 * These drifted apart in football preseason: a run on Aug 2 can produce legs
 * that play Sep 13. Picks used to be grouped by game_date while parlays were
 * grouped AND labeled by target_date (the run date), so September tickets read
 * "Tomorrow" and September straight picks vanished from the rail entirely.
 * Everything date-related on an agent surface should come through here.
 */

/** Local YYYY-MM-DD. Pick/leg game_date is a bare date string, so compare as text. */
export function localDateString(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Earliest → latest leg date. Empty-legged tickets fall back to target_date. */
export function parlayPlayRange(parlay: AgentParlay): { first: string; last: string } | null {
  const dates = (parlay.legs ?? []).map((leg) => leg.game_date).filter(Boolean).sort();
  if (dates.length) return { first: dates[0], last: dates[dates.length - 1] };
  const fallback = parlay.target_date ?? parlay.created_at?.slice(0, 10);
  return fallback ? { first: fallback, last: fallback } : null;
}

/** The single date a bet is grouped by — a parlay sorts by its FIRST leg. */
export function parlayPlaysOn(parlay: AgentParlay): string {
  return parlayPlayRange(parlay)?.first ?? parlay.target_date ?? parlay.created_at.slice(0, 10);
}

export function pickPlaysOn(pick: AgentPick): string {
  return pick.game_date;
}

/** "Today" / "Tomorrow" / "Sep 13". */
export function formatPlayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Pending';
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Multi-day tickets read as a range ("Sep 5 – Sep 13"); same-day collapses. */
export function formatPlayRange(range: { first: string; last: string } | null): string {
  if (!range) return 'Pending';
  if (range.first === range.last) return formatPlayDate(range.first);
  return `${formatPlayDate(range.first)} – ${formatPlayDate(range.last)}`;
}

/** True when the bet plays after today — i.e. belongs in the "Coming Up" rail. */
export function isUpcoming(playsOn: string, today = localDateString()): boolean {
  return playsOn > today;
}
