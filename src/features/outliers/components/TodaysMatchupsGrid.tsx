// Today's Matchups: a logo-tile grid of the slate, deep-linking into /games.
// Spans every active sport — MLB pulls its own today's-games list (React Query
// dedupes with the Parlay God hook); NFL/NCAAF reuse the slates already fetched
// by useOutliersTrendsMulti. See specs/outliers_spec.md §4d.
import { useMemo, useState } from 'react';
import { SkeletonBlock } from '@/components/ios';
import { useTodaysMatchupGames } from '@/hooks/useTodaysMatchupGames';
import { SectionHeader } from './SectionHeader';
import { MatchupTile, type MatchupTileData } from './MatchupTile';
import { teamVisuals } from '../teamVisuals';
import { OUTLIERS_SPORT_LABELS } from '../types';
import type { OutliersTrendsGame, OutliersTrendsSport } from '../types';

/** Collapsed height ≈ 2 rows of 3 tiles; "Show more" reveals the rest. */
const COLLAPSED_COUNT = 6;

/** `/games` uses `cfb` for college football; Outliers calls it `ncaaf`. */
function gamesSportParam(sport: OutliersTrendsSport): string {
  return sport === 'ncaaf' ? 'cfb' : sport;
}

function etDateKey(date: Date): string {
  // en-CA → "YYYY-MM-DD", stable for equality checks in ET.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function etTime(iso: string | null): string {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

function etWeekday(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(d);
}

/** "Today" when the game's ET date is today, else the ET weekday. */
function dayLabelFor(iso: string | null, todayKey: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return etDateKey(d) === todayKey ? 'Today' : etWeekday(iso);
}

function weekdayFromDateOnly(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return 'Today';
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
}

function todayEtSuffix(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
}

function epochMs(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function mlbTile(
  game: {
    game_pk: number;
    away_abbr: string;
    home_abbr: string;
    game_time: string | null;
    official_date: string;
  },
  todayKey: string,
  sportLabel?: string,
): MatchupTileData {
  const away = teamVisuals('mlb', game.away_abbr);
  const home = teamVisuals('mlb', game.home_abbr);
  return {
    key: `mlb:${game.game_pk}`,
    href: `/games?sport=mlb&game=${game.game_pk}`,
    awayAbbr: game.away_abbr,
    homeAbbr: game.home_abbr,
    awayLogoUrl: away.logoUrl,
    homeLogoUrl: home.logoUrl,
    awayColors: away.colors,
    homeColors: home.colors,
    awayInitials: away.initials,
    homeInitials: home.initials,
    dayLabel: weekdayFromDateOnly(game.official_date, todayKey),
    timeLabel: etTime(game.game_time),
    sportLabel,
    // Fall back to the date at noon so a time-less game still sorts on its day.
    startMs: epochMs(game.game_time) ?? epochMs(`${game.official_date}T12:00:00`),
  };
}

function slateTile(
  game: OutliersTrendsGame,
  sport: OutliersTrendsSport,
  todayKey: string,
  sportLabel?: string,
): MatchupTileData {
  // NCAAF slate keys are full team names (no abbr logos); NFL keys are abbrs.
  const awayKey = sport === 'ncaaf' ? game.awayTeam : game.awayAb;
  const homeKey = sport === 'ncaaf' ? game.homeTeam : game.homeAb;
  const away = teamVisuals(sport, awayKey);
  const home = teamVisuals(sport, homeKey);
  return {
    key: `${sport}:${game.id}`,
    href: `/games?sport=${gamesSportParam(sport)}&game=${game.id}`,
    awayAbbr: game.awayAb || away.initials,
    homeAbbr: game.homeAb || home.initials,
    awayLogoUrl: away.logoUrl,
    homeLogoUrl: home.logoUrl,
    awayColors: away.colors,
    homeColors: home.colors,
    awayInitials: away.initials,
    homeInitials: home.initials,
    dayLabel: dayLabelFor(game.kickoff, todayKey),
    timeLabel: etTime(game.kickoff),
    sportLabel,
    startMs: epochMs(game.kickoff),
  };
}

interface TodaysMatchupsGridProps {
  /** Sports currently in scope — one, or all three under the "All Sports" pill. */
  sports: OutliersTrendsSport[];
  /** NFL/NCAAF slate games by sport (from useOutliersTrendsMulti). MLB self-fetches. */
  gamesBySport: Partial<Record<OutliersTrendsSport, OutliersTrendsGame[]>>;
  /** NFL/NCAAF slates still fetching — MLB manages its own loading state. */
  slateLoading?: boolean;
}

export function TodaysMatchupsGrid({ sports, gamesBySport, slateLoading }: TodaysMatchupsGridProps) {
  const [expanded, setExpanded] = useState(false);
  const includesMlb = sports.includes('mlb');
  // Always subscribed (hooks can't be conditional); the cache entry is shared
  // with Parlay God, so this is free when MLB is already on screen.
  const mlbQuery = useTodaysMatchupGames();
  // Only tag tiles with a league once the grid actually mixes sports.
  const multiSport = sports.length > 1;

  const todayKey = etDateKey(new Date());
  const tiles = useMemo<MatchupTileData[]>(() => {
    const out: MatchupTileData[] = [];
    for (const s of sports) {
      const label = multiSport ? OUTLIERS_SPORT_LABELS[s] : undefined;
      if (s === 'mlb') {
        out.push(...(mlbQuery.data ?? []).map((g) => mlbTile(g, todayKey, label)));
      } else {
        out.push(...(gamesBySport[s] ?? []).map((g) => slateTile(g, s, todayKey, label)));
      }
    }
    // Soonest first across the merged slate; unscheduled games sink to the end.
    return out.sort((a, b) => (a.startMs ?? Infinity) - (b.startMs ?? Infinity));
    // todayKey is derived fresh each render but only its string identity matters.
  }, [sports, multiSport, mlbQuery.data, gamesBySport, todayKey]);

  const isLoading = (includesMlb && mlbQuery.isLoading) || Boolean(slateLoading);
  // MLB failing alone shouldn't blank a grid that still has football tiles.
  const isError = includesMlb && mlbQuery.isError && tiles.length === 0;

  const visible = expanded ? tiles : tiles.slice(0, COLLAPSED_COUNT);
  const canExpand = tiles.length > COLLAPSED_COUNT;

  return (
    <section className="flex min-w-0 flex-col gap-2.5">
      <SectionHeader
        title="Today's Matchups"
        suffix={todayEtSuffix()}
        action={
          canExpand
            ? {
                kind: 'link',
                label: expanded ? 'Show less' : `Show all ${tiles.length}`,
                onClick: () => setExpanded((v) => !v),
              }
            : undefined
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonBlock key={i} height={92} radius={16} className="w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-[13px] text-muted-foreground">Couldn't load today's games.</p>
      ) : tiles.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No games on the board today.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {visible.map((tile) => (
            <MatchupTile key={tile.key} data={tile} />
          ))}
        </div>
      )}
    </section>
  );
}
