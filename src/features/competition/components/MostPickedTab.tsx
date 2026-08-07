import { Lock, Star } from 'lucide-react';
import { GlassCard } from '@/components/ios';
import { cn } from '@/lib/utils';
import type { CompGame, CompMarket, CompSide, CompSport, CompWeek, CompWeekStatRow } from '../types';
import { formatCountdown, formatDeadlinePair, formatSignedLine } from '../format';
import { compTeamShortName, resolveMatchupBarColors } from '../teamLogos';
import { TeamMark } from './TeamMark';

interface MarketSplit {
  gameId: number;
  sport: CompSport;
  home: string;
  away: string;
  kickoff: string;
  market: CompMarket;
  left: { side: CompSide; n: number; potw: number; label: string; team?: string };
  right: { side: CompSide; n: number; potw: number; label: string; team?: string };
  total: number;
}

interface GameRank {
  gameId: number;
  sport: CompSport;
  home: string;
  away: string;
  kickoff: string;
  /** Picks on this game across all markets/sides. */
  engagement: number;
  /** Dominant market (most picks) for the dual bar. */
  primary: MarketSplit;
  potwTotal: number;
}

export function MostPickedTab({
  week,
  now,
  pastDeadline,
  stats,
  gamesById,
  isLoading,
  error,
  entrantEstimate,
}: {
  week: CompWeek | null;
  now: number;
  pastDeadline: boolean;
  stats: CompWeekStatRow[] | undefined;
  gamesById: Map<number, CompGame>;
  isLoading: boolean;
  error: string | null;
  entrantEstimate: number;
}) {
  if (!pastDeadline) {
    const ms = week ? Math.max(0, new Date(week.deadline).getTime() - now) : 0;
    const pair = week ? formatDeadlinePair(week.deadline) : null;
    return (
      <GlassCard radius={18} className="p-6 text-center">
        <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-[15px] font-bold">Picks are hidden until Friday 12:00 PM ET</p>
        {pair && (
          <p className="mt-1 text-[13px] text-muted-foreground">
            {pair.et} · {pair.local}
          </p>
        )}
        <p className="mt-4 font-mono text-[28px] font-black">{formatCountdown(ms)}</p>
      </GlassCard>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/40" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-2xl bg-muted/40" />
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard radius={18} className="p-6 text-center text-[13px] text-muted-foreground">
        {error}
      </GlassCard>
    );
  }

  const rows = stats ?? [];
  if (rows.length === 0) {
    return (
      <GlassCard radius={18} className="p-6 text-center text-[13px] text-muted-foreground">
        No submitted picks to rank yet.
      </GlassCard>
    );
  }

  const players = Math.max(entrantEstimate, 1);
  const ranked = rankGames(rows, gamesById);
  const mostGame = ranked[0] ?? null;
  const mostSide = [...rows].sort((a, b) => Number(b.n_picks) - Number(a.n_picks))[0]!;
  const mostPotw = [...rows].sort(
    (a, b) => Number(b.n_potw) - Number(a.n_potw) || Number(b.n_picks) - Number(a.n_picks)
  )[0]!;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Week at a glance
          </h2>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {players} players
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {mostGame && (
            <SummaryCard
              eyebrow="Most bet on game"
              sport={mostGame.sport}
              away={mostGame.away}
              home={mostGame.home}
              title={`${compTeamShortName(mostGame.sport, mostGame.away)} @ ${compTeamShortName(mostGame.sport, mostGame.home)}`}
              stat={`${mostGame.engagement}`}
              statLabel="picks on this game"
              sub={`${Math.round((mostGame.engagement / (players * 6)) * 100)}% of all picks`}
            />
          )}
          <SummaryCard
            eyebrow="Most picked side"
            sport={mostSide.sport as CompSport}
            away={mostSide.away_team}
            home={mostSide.home_team}
            highlightSide={mostSide.market === 'spread' ? mostSide.side : undefined}
            title={sideLabel(mostSide, gamesById.get(mostSide.game_id))}
            stat={`${Math.round((Number(mostSide.n_picks) / players) * 100)}%`}
            statLabel="of players"
            sub={`${mostSide.n_picks} of ${players} · ${matchupShort(mostSide)}`}
          />
          <SummaryCard
            eyebrow="Most Play of the Week"
            sport={mostPotw.sport as CompSport}
            away={mostPotw.away_team}
            home={mostPotw.home_team}
            highlightSide={mostPotw.market === 'spread' ? mostPotw.side : undefined}
            title={sideLabel(mostPotw, gamesById.get(mostPotw.game_id))}
            stat={`${mostPotw.n_potw}`}
            statLabel="POTW stars"
            sub={
              Number(mostPotw.n_potw) > 0
                ? `${Math.round((Number(mostPotw.n_potw) / players) * 100)}% of players starred this`
                : 'No POTW concentration'
            }
            potw
          />
        </div>
      </section>

      {/* Ranked games */}
      <section>
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Top 10 most picked games
        </h2>
        <div className="space-y-2">
          {ranked.slice(0, 10).map((g, i) => (
            <GameConsensusRow
              key={g.gameId}
              rank={i + 1}
              game={g}
              players={players}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  eyebrow,
  sport,
  away,
  home,
  highlightSide,
  title,
  stat,
  statLabel,
  sub,
  potw,
}: {
  eyebrow: string;
  sport: CompSport;
  away: string;
  home: string;
  highlightSide?: CompSide;
  title: string;
  stat: string;
  statLabel: string;
  sub: string;
  potw?: boolean;
}) {
  return (
    <GlassCard
      radius={18}
      className={cn('flex flex-col p-3.5', potw && 'border-amber-500/30 bg-amber-500/[0.07]')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {eyebrow}
        </span>
        {potw && <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'rounded-full bg-background p-0.5 ring-1 ring-black/5 dark:ring-white/10',
              highlightSide === 'away' && 'ring-2 ring-amber-500/60'
            )}
          >
            <TeamMark sport={sport} name={away} size="md" />
          </span>
          <span className="text-[10px] font-bold text-muted-foreground">@</span>
          <span
            className={cn(
              'rounded-full bg-background p-0.5 ring-1 ring-black/5 dark:ring-white/10',
              highlightSide === 'home' && 'ring-2 ring-amber-500/60'
            )}
          >
            <TeamMark sport={sport} name={home} size="md" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-black leading-tight">{title}</div>
        </div>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="font-mono text-[22px] font-black leading-none tabular-nums">{stat}</span>
        <span className="pb-0.5 text-[11px] font-semibold text-muted-foreground">{statLabel}</span>
      </div>
      <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{sub}</p>
    </GlassCard>
  );
}

function GameConsensusRow({
  rank,
  game,
  players,
}: {
  rank: number;
  game: GameRank;
  players: number;
}) {
  const { primary } = game;
  const leftPct = primary.total > 0 ? Math.round((primary.left.n / primary.total) * 100) : 50;
  const rightPct = 100 - leftPct;
  const leftPlayerPct = Math.round((primary.left.n / players) * 100);
  const rightPlayerPct = Math.round((primary.right.n / players) * 100);
  const leanLeft = primary.left.n >= primary.right.n;
  const awayShort = compTeamShortName(game.sport, game.away);
  const homeShort = compTeamShortName(game.sport, game.home);
  const barColors =
    primary.market === 'total'
      ? { left: '#16A34A', right: '#DC2626' } // Over green · Under red
      : resolveMatchupBarColors(game.sport, game.away, game.home);

  return (
    <GlassCard radius={16} className="p-3 sm:p-3.5">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <span className="mt-1.5 w-6 shrink-0 text-center font-mono text-[13px] font-black text-muted-foreground">
          {rank}
        </span>

        <div className="min-w-0 flex-1">
          {/* logo name @ logo name — never stacked/overlapping */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <TeamMark sport={game.sport} name={game.away} size="md" />
              <span className="truncate text-[13px] font-black sm:text-[14px]">{awayShort}</span>
            </span>
            <span className="text-[12px] font-bold text-muted-foreground">@</span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <TeamMark sport={game.sport} name={game.home} size="md" />
              <span className="truncate text-[13px] font-black sm:text-[14px]">{homeShort}</span>
            </span>
          </div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {game.sport} · {primary.market === 'spread' ? 'Spread' : 'Total'} · {game.engagement}{' '}
            picks
          </div>

          {/* Two-sided consensus — labels stay on one row; POTW inline */}
          <div className="mt-3 space-y-1.5">
            <div className="grid grid-cols-2 gap-3 text-[12px] font-bold">
              <div className="min-w-0">
                <div className="flex h-5 items-center gap-1.5 truncate">
                  {primary.market === 'spread' && primary.left.team ? (
                    <TeamMark sport={game.sport} name={primary.left.team} size="sm" />
                  ) : null}
                  <span className="truncate">{primary.left.label}</span>
                  {primary.left.potw > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-100">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      {primary.left.potw}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-[15px] font-black tabular-nums leading-none">
                  {leftPct}%
                  <span className="ml-1.5 text-[10px] font-semibold text-muted-foreground">
                    {primary.left.n} · {leftPlayerPct}% of field
                  </span>
                </div>
              </div>
              <div className="min-w-0 text-right">
                <div className="flex h-5 items-center justify-end gap-1.5 truncate">
                  {primary.right.potw > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-100">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      {primary.right.potw}
                    </span>
                  )}
                  <span className="truncate">{primary.right.label}</span>
                  {primary.market === 'spread' && primary.right.team ? (
                    <TeamMark sport={game.sport} name={primary.right.team} size="sm" />
                  ) : null}
                </div>
                <div className="mt-0.5 font-mono text-[15px] font-black tabular-nums leading-none">
                  {rightPct}%
                  <span className="ml-1.5 text-[10px] font-semibold text-muted-foreground">
                    {primary.right.n} · {rightPlayerPct}% of field
                  </span>
                </div>
              </div>
            </div>

            <div className="relative flex h-3.5 overflow-hidden rounded-full bg-muted/50 ring-1 ring-black/5 dark:ring-white/10">
              <div
                className="h-full transition-[width]"
                style={{
                  width: `${leftPct}%`,
                  backgroundColor: barColors.left,
                  opacity: leanLeft ? 1 : 0.75,
                }}
              />
              <div
                className="h-full transition-[width]"
                style={{
                  width: `${rightPct}%`,
                  backgroundColor: barColors.right,
                  opacity: leanLeft ? 0.75 : 1,
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              <span>Public lean</span>
              <span>
                {primary.left.n + primary.right.n} on {primary.market}
                {game.potwTotal > 0 ? ` · ${game.potwTotal} POTW total` : ''}
              </span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function rankGames(
  rows: CompWeekStatRow[],
  gamesById: Map<number, CompGame>
): GameRank[] {
  const byGame = new Map<number, CompWeekStatRow[]>();
  for (const r of rows) {
    const list = byGame.get(r.game_id) ?? [];
    list.push(r);
    byGame.set(r.game_id, list);
  }

  const ranks: GameRank[] = [];
  for (const [gameId, gameRows] of byGame) {
    const sample = gameRows[0]!;
    const engagement = gameRows.reduce((s, r) => s + Number(r.n_picks), 0);
    const potwTotal = gameRows.reduce((s, r) => s + Number(r.n_potw), 0);

    const markets: CompMarket[] = ['spread', 'total'];
    let best: MarketSplit | null = null;
    for (const market of markets) {
      const split = buildSplit(gameRows, market, gamesById.get(gameId));
      if (!split) continue;
      if (!best || split.total > best.total) best = split;
    }
    if (!best) continue;

    ranks.push({
      gameId,
      sport: sample.sport as CompSport,
      home: sample.home_team,
      away: sample.away_team,
      kickoff: sample.kickoff,
      engagement,
      primary: best,
      potwTotal,
    });
  }

  return ranks.sort((a, b) => b.engagement - a.engagement || b.primary.total - a.primary.total);
}

function buildSplit(
  gameRows: CompWeekStatRow[],
  market: CompMarket,
  game: CompGame | undefined
): MarketSplit | null {
  const sample = gameRows.find((r) => r.market === market);
  if (!sample) return null;

  const leftSide: CompSide = market === 'spread' ? 'away' : 'over';
  const rightSide: CompSide = market === 'spread' ? 'home' : 'under';
  const leftRow = gameRows.find((r) => r.market === market && r.side === leftSide);
  const rightRow = gameRows.find((r) => r.market === market && r.side === rightSide);
  const leftN = Number(leftRow?.n_picks ?? 0);
  const rightN = Number(rightRow?.n_picks ?? 0);
  if (leftN + rightN === 0) return null;

  return {
    gameId: sample.game_id,
    sport: sample.sport as CompSport,
    home: sample.home_team,
    away: sample.away_team,
    kickoff: sample.kickoff,
    market,
    left: {
      side: leftSide,
      n: leftN,
      potw: Number(leftRow?.n_potw ?? 0),
      label: sideLabelFromParts(market, leftSide, sample, game),
      team: market === 'spread' ? sample.away_team : undefined,
    },
    right: {
      side: rightSide,
      n: rightN,
      potw: Number(rightRow?.n_potw ?? 0),
      label: sideLabelFromParts(market, rightSide, sample, game),
      team: market === 'spread' ? sample.home_team : undefined,
    },
    total: leftN + rightN,
  };
}

function sideLabelFromParts(
  market: CompMarket,
  side: CompSide,
  sample: CompWeekStatRow,
  game: CompGame | undefined
): string {
  const sport = sample.sport as CompSport;
  if (market === 'spread') {
    const team = side === 'home' ? sample.home_team : sample.away_team;
    const line =
      game?.spread_home == null
        ? null
        : side === 'home'
          ? Number(game.spread_home)
          : -Number(game.spread_home);
    const name = compTeamShortName(sport, team);
    return line == null ? name : `${name} ${formatSignedLine(line)}`;
  }
  const tot =
    game?.total != null ? formatSignedLine(Number(game.total)).replace(/^[+−]/, '') : null;
  return tot ? `${side === 'over' ? 'Over' : 'Under'} ${tot}` : side === 'over' ? 'Over' : 'Under';
}

function sideLabel(r: CompWeekStatRow, game: CompGame | undefined): string {
  return sideLabelFromParts(r.market, r.side, r, game);
}

function matchupShort(r: CompWeekStatRow): string {
  const sport = r.sport as CompSport;
  return `${compTeamShortName(sport, r.away_team)} @ ${compTeamShortName(sport, r.home_team)}`;
}
