import React, { useMemo, useState } from 'react';
import {
  useMLBPitcherMatchupsReport,
  type PropPick,
  type UseDailyPropsReportResult,
} from '@/hooks/useMLBPitcherMatchupsReport';
import { useSnapshotPlayerPropPicks, pickIsLocked } from '@/hooks/useSnapshotPlayerPropPicks';
import { PerformanceSummary } from '@/components/mlb/player-props/PerformanceSummary';
import { Lock } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Headshot } from '@/components/mlb/pitcher-matchups/Headshot';
import { PlayerPropDetail } from '@/components/mlb/player-props/PlayerPropDetail';
import { formatPropLine, formatPropOdds } from '@/utils/mlbPlayerProps';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { PitchHand } from '@/types/mlb-matchups';

function tierStyles(tier: PropPick['tier']) {
  if (tier === 'elite') {
    return {
      border: 'border-primary/70',
      bg: 'bg-primary/10',
      pill: 'bg-primary text-primary-foreground',
      label: 'ELITE',
    };
  }
  if (tier === 'strong') {
    return {
      border: 'border-primary/40',
      bg: 'bg-primary/5',
      pill: 'bg-primary/80 text-primary-foreground',
      label: 'STRONG',
    };
  }
  return {
    border: 'border-border/60',
    bg: 'bg-card/40',
    pill: 'bg-muted text-foreground',
    label: 'LEAN',
  };
}

interface PickCardProps {
  pick: PropPick;
  context: UseDailyPropsReportResult;
  locked: boolean;
}

function PickCard({ pick, context, locked }: PickCardProps) {
  const [open, setOpen] = useState(false);
  const styles = tierStyles(pick.tier);

  // Pull the data this player needs from the already-loaded matchup maps so the
  // inline detail panel renders exactly like the matchups page.
  const game = context.gameByPk.get(pick.game_pk) ?? null;
  const allProps = context.propsByGamePk.get(pick.game_pk) ?? [];
  const playerProps = allProps.filter(p => p.player_id === pick.player_id);
  const md = context.matchupByGamePk.get(pick.game_pk);

  const isAwayPitcher = pick.kind === 'pitcher' && game && pick.player_id === game.away_sp_id;
  const isHomePitcher = pick.kind === 'pitcher' && game && pick.player_id === game.home_sp_id;
  const opposingStarterName =
    pick.kind === 'batter'
      ? // Pick whichever pitcher the batter is NOT teammates with — easiest signal
        // is the team_name embedded in the pick vs the game's home/away names.
        game && pick.team_name === game.home_team_name
          ? game.away_sp_name
          : game?.away_sp_name === pick.team_name
            ? game?.home_sp_name
            : game?.home_sp_name
      : isAwayPitcher
        ? game?.home_sp_name
        : game?.away_sp_name;

  const opposingStarterHand: PitchHand =
    pick.kind === 'batter'
      ? game && pick.team_name === game.home_team_name
        ? game.away_sp_hand
        : (game?.home_sp_hand ?? 'R')
      : isAwayPitcher
        ? (game?.home_sp_hand ?? 'R')
        : (game?.away_sp_hand ?? 'R');

  // Batter-side: figure out which lineup the batter is on and grab their split row.
  const lineupSplits = [
    ...(md?.awayLineupSplits ?? []),
    ...(md?.homeLineupSplits ?? []),
  ];
  const split = lineupSplits.find(s => s.batter_id === pick.player_id);

  // Batter benchmarks should match the batter's vs-pitcher-hand (i.e. opposing
  // SP hand). Pitcher cards use their own hand's benchmarks for opp-lineup K%.
  const benchmarks =
    pick.kind === 'batter'
      ? opposingStarterHand === 'L'
        ? context.benchmarksL
        : context.benchmarksR
      : isAwayPitcher
        ? game?.away_sp_hand === 'L'
          ? context.benchmarksL
          : context.benchmarksR
        : game?.home_sp_hand === 'L'
          ? context.benchmarksL
          : context.benchmarksR;

  // Pitcher-side detail context: arsenal, batted-ball, archetype, game date.
  const pitcherSeason = pick.kind === 'pitcher' ? context.season : undefined;
  const pitcherGameDate = pick.kind === 'pitcher' ? game?.official_date : undefined;
  const pitcherArsenal =
    pick.kind === 'pitcher'
      ? isAwayPitcher
        ? md?.awayArsenal ?? null
        : isHomePitcher
          ? md?.homeArsenal ?? null
          : null
      : null;
  const pitcherBattedBall =
    pick.kind === 'pitcher'
      ? isAwayPitcher
        ? md?.awayBattedBall ?? null
        : isHomePitcher
          ? md?.homeBattedBall ?? null
          : null
      : null;
  const pitcherArchetype =
    pick.kind === 'pitcher'
      ? isAwayPitcher
        ? md?.awayArchetype ?? null
        : isHomePitcher
          ? md?.homeArchetype ?? null
          : null
      : null;

  const canShowDetail = playerProps.length > 0 && !!game;

  return (
    <div className={cn('rounded-lg border', styles.border, styles.bg, 'overflow-hidden')}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <Headshot playerId={pick.player_id} size={56} alt={pick.player_name} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full tabular-nums',
                styles.pill,
              )}
            >
              {pick.emoji} {styles.label} · {pick.score}
            </span>
            {locked ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-muted/60 text-foreground px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                title="Game has started — this pick is locked at the values shown and won't change on future report refreshes."
              >
                <Lock className="h-2.5 w-2.5" /> Locked
              </span>
            ) : null}
            <p className="font-semibold truncate">{pick.player_name}</p>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {pick.team_name ? `${pick.team_name} · ` : ''}
            {pick.game_label} · {pick.is_day ? '☀️ Day' : '🌙 Night'}
          </p>
          <div className="flex flex-wrap items-baseline gap-2 text-xs tabular-nums">
            <span className="font-semibold text-foreground">{pick.market_label}</span>
            <span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5">
              {pick.side === 'over' ? 'Over' : 'Under'} {formatPropLine(pick.line)}{' '}
              {pick.market_label.toLowerCase()}{' '}
              <span className="font-bold text-primary ml-1">
                {formatPropOdds(pick.side === 'over' ? pick.over_odds : pick.under_odds)}
              </span>
            </span>
            <span className="text-primary font-semibold">
              {pick.l10_pct ?? '—'}% L10 · {pick.l10_over}/{pick.l10_games}
            </span>
          </div>
        </div>
        <span className="shrink-0 text-muted-foreground self-center">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open ? (
        <div className="border-t border-border/40 px-3 py-3 space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Why this pick scores {pick.score}
            </p>
            <ul className="space-y-1">
              {pick.rationale.map((r, i) => (
                <li
                  key={i}
                  className={cn(
                    'text-xs tabular-nums flex items-center justify-between gap-3',
                    r.points > 0 && 'text-foreground',
                    r.points < 0 && 'text-red-500',
                    r.points === 0 && 'text-muted-foreground',
                  )}
                >
                  <span>{r.label}</span>
                  <span className="font-semibold">
                    {r.points > 0 ? '+' : ''}
                    {r.points.toFixed(0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {canShowDetail ? (
            <PlayerPropDetail
              playerProps={playerProps}
              playerId={pick.player_id}
              playerName={pick.player_name}
              position={null}
              batSide={split?.bat_side ?? null}
              opposingStarterName={opposingStarterName ?? 'opposing starter'}
              opposingStarterHand={opposingStarterHand}
              opposingArchetype={null}
              split={split}
              benchmarks={benchmarks}
              isPitcher={pick.kind === 'pitcher'}
              pitcherSeason={pitcherSeason}
              pitcherGameDate={pitcherGameDate}
              pitcherArsenal={pitcherArsenal}
              pitcherBattedBall={pitcherBattedBall}
              pitcherArchetype={pitcherArchetype}
            />
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Full breakdown not available — try{' '}
              <Link to={`/mlb/pitcher-matchups#game-${pick.game_pk}`} className="underline">
                the matchups page
              </Link>.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({
  emoji,
  title,
  count,
}: {
  emoji: string;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-lg sm:text-xl font-bold">
        {emoji} {title}
      </h2>
      <span className="text-xs text-muted-foreground tabular-nums">
        {count} {count === 1 ? 'pick' : 'picks'}
      </span>
    </div>
  );
}

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export default function PlayerPropsReport() {
  const context = useMLBPitcherMatchupsReport();
  const { report, isLoading, isError } = context;

  const allPicks = useMemo(
    () => [...(report?.batter_picks ?? []), ...(report?.pitcher_picks ?? [])],
    [report],
  );
  const lockedKeys = useSnapshotPlayerPropPicks(
    report ? todayET() : null,
    allPicks,
    !isLoading && !!report && allPicks.length > 0,
  );

  const eliteBatters = useMemo(
    () => (report?.batter_picks ?? []).filter(p => p.tier === 'elite'),
    [report],
  );
  const strongBatters = useMemo(
    () => (report?.batter_picks ?? []).filter(p => p.tier === 'strong'),
    [report],
  );
  const leanBatters = useMemo(
    () => (report?.batter_picks ?? []).filter(p => p.tier === 'lean'),
    [report],
  );
  const elitePitchers = useMemo(
    () => (report?.pitcher_picks ?? []).filter(p => p.tier === 'elite'),
    [report],
  );
  const strongPitchers = useMemo(
    () => (report?.pitcher_picks ?? []).filter(p => p.tier === 'strong'),
    [report],
  );
  const leanPitchers = useMemo(
    () => (report?.pitcher_picks ?? []).filter(p => p.tier === 'lean'),
    [report],
  );

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl space-y-5 sm:space-y-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold leading-tight">
            🎯 Today&apos;s Best MLB Player Props
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Ranked picks combining last-10 hit rate, day/night splits, opposing
            archetype, recent underlying form, and lineup vulnerability.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/mlb/pitcher-matchups">Open full matchups →</Link>
        </Button>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load today&apos;s data.</AlertDescription>
        </Alert>
      ) : null}

      <PerformanceSummary />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !report ||
        (report.batter_picks.length === 0 && report.pitcher_picks.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-1">
            <p className="text-lg">No qualified picks right now.</p>
            <p className="text-xs">
              Props score by L10 hit rate + day/night + archetype + recent form. Check back closer
              to first pitch — the slate may not have enough sample yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                How picks are ranked
              </p>
            </CardHeader>
            <CardContent className="text-xs sm:text-sm text-muted-foreground space-y-1 leading-relaxed">
              <p>
                Every posted prop is scored out of 100.{' '}
                <span className="text-foreground font-semibold">L10 hit rate</span> is the spine
                (40 pts). We add credit for matching{' '}
                <span className="text-foreground font-semibold">day/night fit</span>,{' '}
                <span className="text-foreground font-semibold">opposing-pitcher archetype</span>{' '}
                history (batters),{' '}
                <span className="text-foreground font-semibold">
                  opposing-lineup K% vulnerability
                </span>{' '}
                (pitchers), and{' '}
                <span className="text-foreground font-semibold">underlying form trend</span> from
                L10 splits. Plus-money Overs get a small boost; juiced Overs get a small haircut.
              </p>
              <p>
                Tap a card to see the score breakdown AND the player&apos;s full matchup card —
                same chart, lines, and stats accordion as the matchups page.
              </p>
              <p>
                Tiers: <span className="text-foreground font-semibold">🔥 ELITE 75+</span> ·{' '}
                <span className="text-foreground font-semibold">⭐ STRONG 62–74</span> ·{' '}
                <span className="text-foreground font-semibold">👍 LEAN 50–61</span>.
              </p>
            </CardContent>
          </Card>

          {report.batter_picks.length > 0 ? (
            <section className="space-y-3">
              <SectionHeader emoji="🥎" title="Batter picks" count={report.batter_picks.length} />
              {eliteBatters.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-primary font-semibold">
                    🔥 Elite
                  </p>
                  {eliteBatters.map(p => (
                    <PickCard
                      key={`b-${p.player_id}-${p.market}`}
                      pick={p}
                      context={context}
                      locked={pickIsLocked(p, lockedKeys)}
                    />
                  ))}
                </div>
              ) : null}
              {strongBatters.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-foreground font-semibold">
                    ⭐ Strong
                  </p>
                  {strongBatters.map(p => (
                    <PickCard
                      key={`b-${p.player_id}-${p.market}`}
                      pick={p}
                      context={context}
                      locked={pickIsLocked(p, lockedKeys)}
                    />
                  ))}
                </div>
              ) : null}
              {leanBatters.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    👍 Lean
                  </p>
                  {leanBatters.map(p => (
                    <PickCard
                      key={`b-${p.player_id}-${p.market}`}
                      pick={p}
                      context={context}
                      locked={pickIsLocked(p, lockedKeys)}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {report.pitcher_picks.length > 0 ? (
            <section className="space-y-3">
              <SectionHeader emoji="⚾" title="Pitcher picks" count={report.pitcher_picks.length} />
              {elitePitchers.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-primary font-semibold">
                    🔥 Elite
                  </p>
                  {elitePitchers.map(p => (
                    <PickCard
                      key={`p-${p.player_id}-${p.market}`}
                      pick={p}
                      context={context}
                      locked={pickIsLocked(p, lockedKeys)}
                    />
                  ))}
                </div>
              ) : null}
              {strongPitchers.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-foreground font-semibold">
                    ⭐ Strong
                  </p>
                  {strongPitchers.map(p => (
                    <PickCard
                      key={`p-${p.player_id}-${p.market}`}
                      pick={p}
                      context={context}
                      locked={pickIsLocked(p, lockedKeys)}
                    />
                  ))}
                </div>
              ) : null}
              {leanPitchers.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    👍 Lean
                  </p>
                  {leanPitchers.map(p => (
                    <PickCard
                      key={`p-${p.player_id}-${p.market}`}
                      pick={p}
                      context={context}
                      locked={pickIsLocked(p, lockedKeys)}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
