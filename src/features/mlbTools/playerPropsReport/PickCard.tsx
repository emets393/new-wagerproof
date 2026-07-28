import * as React from 'react';
import { ChevronDown, ChevronUp, Lock, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassCard } from '@/components/ios';
import { Headshot } from '@/components/mlb/pitcher-matchups/Headshot';
import { PlayerPropDetail } from '@/components/mlb/player-props/PlayerPropDetail';
import type { PropPick, UseDailyPropsReportResult } from '@/hooks/useMLBPitcherMatchupsReport';
import { cn } from '@/lib/utils';
import type { PitchHand } from '@/types/mlb-matchups';
import { formatPropLine, formatPropOdds } from '@/utils/mlbPlayerProps';
import { TIER_LABEL, tierBorderClass, tierPillClass } from './format';

const OVER_TEXT = 'text-emerald-600 dark:text-emerald-300';
const UNDER_TEXT = 'text-blue-600 dark:text-blue-300';

interface PickCardProps {
  pick: PropPick;
  context: UseDailyPropsReportResult;
  locked: boolean;
}

export function PickCard({ pick, context, locked }: PickCardProps) {
  const [open, setOpen] = React.useState(false);

  const game = context.gameByPk.get(pick.game_pk) ?? null;
  const allProps = context.propsByGamePk.get(pick.game_pk) ?? [];
  const playerProps = allProps.filter((p) => p.player_id === pick.player_id);
  const md = context.matchupByGamePk.get(pick.game_pk);

  const isAwayPitcher = pick.kind === 'pitcher' && game && pick.player_id === game.away_sp_id;
  const isHomePitcher = pick.kind === 'pitcher' && game && pick.player_id === game.home_sp_id;

  const opposingStarterName =
    pick.kind === 'batter'
      ? game && pick.team_name === game.home_team_name
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

  const lineupSplits = [...(md?.awayLineupSplits ?? []), ...(md?.homeLineupSplits ?? [])];
  const split = lineupSplits.find((s) => s.batter_id === pick.player_id);

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

  const pitcherSeason = pick.kind === 'pitcher' ? context.season : undefined;
  const pitcherGameDate = pick.kind === 'pitcher' ? game?.official_date : undefined;
  const pitcherArsenal =
    pick.kind === 'pitcher'
      ? isAwayPitcher
        ? (md?.awayArsenal ?? null)
        : isHomePitcher
          ? (md?.homeArsenal ?? null)
          : null
      : null;
  const pitcherBattedBall =
    pick.kind === 'pitcher'
      ? isAwayPitcher
        ? (md?.awayBattedBall ?? null)
        : isHomePitcher
          ? (md?.homeBattedBall ?? null)
          : null
      : null;
  const pitcherArchetype =
    pick.kind === 'pitcher'
      ? isAwayPitcher
        ? (md?.awayArchetype ?? null)
        : isHomePitcher
          ? (md?.homeArchetype ?? null)
          : null
      : null;

  const canShowDetail = playerProps.length > 0 && !!game;
  const sideOdds = pick.side === 'over' ? pick.over_odds : pick.under_odds;

  return (
    <GlassCard radius={16} className={cn('overflow-hidden border', tierBorderClass(pick.tier))}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <Headshot playerId={pick.player_id} size={52} alt={pick.player_name} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider tabular-nums',
                tierPillClass(pick.tier),
              )}
            >
              {TIER_LABEL[pick.tier]} · {pick.score}
            </span>
            {locked ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground"
                title="Game has started — this pick is locked at the values shown."
              >
                <Lock className="h-2.5 w-2.5" /> Locked
              </span>
            ) : null}
            <p className="truncate font-semibold text-foreground">{pick.player_name}</p>
          </div>

          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">
              {pick.team_name ? `${pick.team_name} · ` : ''}
              {pick.game_label}
            </span>
            <span className="inline-flex items-center gap-0.5">
              {pick.is_day ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
              {pick.is_day ? 'Day' : 'Night'}
            </span>
          </p>

          <div className="flex flex-wrap items-baseline gap-2 text-xs tabular-nums">
            <span className="font-semibold text-foreground">{pick.market_label}</span>
            <span className="rounded-md border border-black/5 bg-muted/40 px-2 py-0.5 dark:border-white/10">
              <span className={cn('font-bold', pick.side === 'over' ? OVER_TEXT : UNDER_TEXT)}>
                {pick.side === 'over' ? 'Over' : 'Under'}
              </span>{' '}
              {formatPropLine(pick.line)}{' '}
              <span className="ml-1 font-bold text-primary">{formatPropOdds(sideOdds)}</span>
            </span>
            <span className="font-semibold text-primary">
              {pick.l10_pct ?? '—'}% L10 · {pick.l10_over}/{pick.l10_games}
            </span>
          </div>
        </div>
        <span className="shrink-0 self-center text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-black/5 px-3 py-3 dark:border-white/10">
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Why this pick scores {pick.score}
            </p>
            <ul className="space-y-1">
              {pick.rationale.map((r, i) => (
                <li
                  key={i}
                  className={cn(
                    'flex items-center justify-between gap-3 text-xs tabular-nums',
                    r.points > 0 && 'text-foreground',
                    r.points < 0 && 'text-red-600 dark:text-red-300',
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
            <p className="text-xs italic text-muted-foreground">
              Full breakdown not available — try{' '}
              <Link to={`/mlb/pitcher-matchups?game=${pick.game_pk}`} className="underline">
                Prop Matchups
              </Link>
              .
            </p>
          )}
        </div>
      ) : null}
    </GlassCard>
  );
}
