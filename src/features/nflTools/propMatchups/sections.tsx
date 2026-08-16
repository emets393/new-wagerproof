import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NflPropPlayerPage, NflPropPlayerTrends, TrendMatchupMarket } from '@/features/propBreakdown/types';
import { formatPerGame } from '@/features/propBreakdown/format';
import { LOOK_BUCKET_LABELS } from '@/features/propBreakdown/marketMap';
import { resolveSchemeCompare } from '@/features/propBreakdown/schemeCompare';
import { type NflPropGameFeedItem } from './model';
import { NflPropPlayerCard } from './NflPropPlayerCard';

function isMatchup(v: unknown): v is TrendMatchupMarket {
  return Boolean(v) && typeof v === 'object' && 'h' in (v as object) && 'n' in (v as object);
}

function PlayerPropRow({
  player,
  trends,
  onSelectPlayer,
}: {
  player: NflPropPlayerPage;
  trends?: NflPropPlayerTrends | null;
  onSelectPlayer?: (playerId: string) => void;
}) {
  const opp = player.opponent;
  const matchup = trends?.matchups?.[opp];
  const primaryMarket =
    player.markets.find((m) => m.key === 'player_pass_yds') ??
    player.markets.find((m) => m.key === 'player_receptions') ??
    player.markets.find((m) => m.key === 'player_reception_yds') ??
    player.markets.find((m) => m.key === 'player_rush_yds') ??
    player.markets[0];
  const compare = resolveSchemeCompare(player, primaryMarket?.key ?? '');
  const vsTeamRaw = primaryMarket && matchup ? matchup[primaryMarket.key] : null;
  const vsTeam = isMatchup(vsTeamRaw) && vsTeamRaw.n >= 2 ? vsTeamRaw : null;

  const hitRates = player.scheme?.look_hit_rates;
  const hitEntry = hitRates
    ? Object.entries(hitRates).flatMap(([bucket, byMkt]) => {
        const rec = primaryMarket ? byMkt?.[primaryMarket.key] : null;
        if (!rec || rec.n < 3) return [];
        return [{ bucket, ...rec }];
      })[0]
    : null;

  const edge = (player.highlights ?? []).find((h) => h.direction === 'up' || h.direction === 'down');

  const baselineBits = [
    player.baseline?.receptions != null
      ? `${formatPerGame(player.baseline.receptions)} rec`
      : null,
    player.baseline?.rec_yds != null ? `${formatPerGame(player.baseline.rec_yds)} yds` : null,
    player.baseline?.rush_yds != null && (player.baseline.rush_yds ?? 0) >= 1
      ? `${formatPerGame(player.baseline.rush_yds)} rush`
      : null,
    player.baseline?.total_td != null ? `${player.baseline.total_td} TD` : null,
  ].filter(Boolean);

  const content = (
    <>
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
          {player.headshot_url ? (
            <img
              src={player.headshot_url}
              alt=""
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-muted-foreground">
              {player.position}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-bold leading-tight">{player.player_name}</div>
              <div className="text-[11px] text-muted-foreground">
                {player.position} · {player.team}
                {baselineBits.length > 0 ? ` · ${baselineBits.slice(0, 3).join(' · ')}` : ''}
              </div>
            </div>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/40 px-2.5 py-2">
              <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                {compare?.overallLabel ?? 'Overall'}
                {compare?.sample === 'thin' && <span className="ml-1 text-amber-700 dark:text-amber-300">· thin</span>}
              </div>
              {compare?.overallValue != null ? (
                <div className="font-mono text-[13px] font-bold">{formatPerGame(compare.overallValue, compare.mode === 'receiving' ? 1 : 2)} {compare.overallUnit}</div>
              ) : <div className="text-[12px] text-muted-foreground">No career split yet</div>}
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-2">
              <div className="text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">Vs this look</div>
              {!compare || compare.lookRows.length === 0 ? <div className="text-[12px] text-muted-foreground">Thin sample</div> : (
                <div className="space-y-0.5">{compare.lookRows.slice(0, 2).map((row) => (
                  <div key={row.key} className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-mono font-bold">{formatPerGame(row.value, compare.mode === 'receiving' ? 1 : 2)}{row.delta != null && Math.abs(row.delta) >= row.deltaThreshold && <span className={cn('ml-1 text-[10px]', row.delta > 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300')}>{row.delta > 0 ? '+' : ''}{formatPerGame(row.delta, Math.abs(row.delta) < 1 ? 2 : 1)}</span>}</span>
                  </div>
                ))}</div>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {vsTeam && primaryMarket && <span className="rounded-full border border-black/5 bg-muted/50 px-2 py-0.5 font-semibold dark:border-white/10">vs {opp}: {vsTeam.h}/{vsTeam.n} {primaryMarket.label.toLowerCase()}</span>}
            {hitEntry && <span className={cn('rounded-full border px-2 py-0.5 font-semibold', hitEntry.pct != null && hitEntry.pct >= 0.6 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : hitEntry.pct != null && hitEntry.pct <= 0.4 ? 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200' : 'border-black/5 bg-muted/50 dark:border-white/10')}>{LOOK_BUCKET_LABELS[hitEntry.bucket] ?? hitEntry.bucket}: {hitEntry.h}/{hitEntry.n}</span>}
          </div>

          {edge && <p className={cn('mt-2 line-clamp-2 text-[12px] leading-snug', edge.direction === 'up' ? 'text-emerald-800 dark:text-emerald-200' : 'text-rose-800 dark:text-rose-200')}><span className="mr-1 text-[9px] font-bold uppercase tracking-wide opacity-80">{edge.direction === 'up' ? 'Up' : 'Down'}</span>{edge.text}</p>}
        </div>
      </div>
    </>
  );

  const className = "block w-full rounded-2xl border border-black/5 bg-white/50 p-3 text-left transition-colors hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]";
  return onSelectPlayer ? (
    <button type="button" onClick={() => onSelectPlayer(player.player_id)} className={className}>{content}</button>
  ) : (
    <Link to={`/nfl/player/${encodeURIComponent(player.player_id)}`} className={className}>{content}</Link>
  );
}

function TeamPlayersColumn({
  team,
  sideLabel,
  players,
  trendsByPlayer,
  onSelectPlayer,
}: {
  team: NflPropGameFeedItem['home'];
  sideLabel: 'Home' | 'Away';
  players: NflPropPlayerPage[];
  trendsByPlayer: Record<string, NflPropPlayerTrends>;
  onSelectPlayer?: (playerId: string) => void;
}) {
  const primary = team.colors.primary;
  const secondary = team.colors.secondary;
  const colorStyle = {
    borderColor: `color-mix(in srgb, ${primary} 38%, transparent)`,
    background: `linear-gradient(180deg, color-mix(in srgb, ${primary} 18%, transparent) 0%, color-mix(in srgb, ${secondary} 9%, transparent) 22%, transparent 58%)`,
    boxShadow: `inset 0 1px 0 color-mix(in srgb, ${primary} 35%, transparent)`,
  } satisfies CSSProperties;

  return (
    <section className="min-w-0 overflow-hidden rounded-[24px] border p-3 sm:p-4" style={colorStyle}>
      <div className="mb-4 flex items-center gap-3 border-b border-black/5 pb-3 dark:border-white/10">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border bg-white/75 p-1.5 shadow-sm dark:bg-black/30"
          style={{ borderColor: `color-mix(in srgb, ${primary} 38%, transparent)` }}
        >
          {team.logoUrl ? (
            <img src={team.logoUrl} alt={`${team.name} logo`} className="h-full w-full object-contain" />
          ) : (
            <span className="text-sm font-black" style={{ color: primary }}>{team.abbrev}</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {sideLabel} team
          </div>
          <h2 className="truncate text-lg font-black text-foreground">{team.name}</h2>
          <p className="text-[11px] font-semibold text-muted-foreground">
            {players.length} {players.length === 1 ? 'player' : 'players'}
          </p>
        </div>
      </div>

      {players.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 px-3 py-8 text-center text-[13px] text-muted-foreground dark:border-white/10">
          No players listed for {team.abbrev}.
        </p>
      ) : (
        <div className="space-y-2">
          {players.map((player) => (
            <NflPropPlayerCard
              key={player.player_id}
              player={player}
              trends={trendsByPlayer[player.player_id]}
              onSelect={() => onSelectPlayer?.(player.player_id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function NflPropMatchupsSections({
  item,
  trendsByPlayer,
  onSelectPlayer,
}: {
  item: NflPropGameFeedItem;
  trendsByPlayer: Record<string, NflPropPlayerTrends>;
  onSelectPlayer?: (playerId: string) => void;
}) {
  return (
    <div className="grid items-start gap-4 @xl:col-span-2 md:grid-cols-2">
      <TeamPlayersColumn
        team={item.away}
        sideLabel="Away"
        players={item.awayPlayers}
        trendsByPlayer={trendsByPlayer}
        onSelectPlayer={onSelectPlayer}
      />
      <TeamPlayersColumn
        team={item.home}
        sideLabel="Home"
        players={item.homePlayers}
        trendsByPlayer={trendsByPlayer}
        onSelectPlayer={onSelectPlayer}
      />
    </div>
  );
}
