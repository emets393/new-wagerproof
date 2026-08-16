import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NflPropPlayerPage, NflPropPlayerTrends } from '@/features/propBreakdown/types';
import type { NflPropGameFeedItem } from '@/features/nflTools/propMatchups/model';
import { compactMarketLabel, getPlayerBestMarket } from '@/features/nflTools/propMatchups/NflPropPlayerCard';

function TeamGroup({
  team,
  players,
  selectedPlayerId,
  trendsByPlayer,
  onSelectPlayer,
}: {
  team: NflPropGameFeedItem['home'];
  players: NflPropPlayerPage[];
  selectedPlayerId: string;
  trendsByPlayer: Record<string, NflPropPlayerTrends>;
  onSelectPlayer: (playerId: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-black/5 bg-white/45 dark:border-white/10 dark:bg-white/[0.035]">
      <div
        className="flex items-center gap-2.5 border-b border-black/5 px-3 py-2.5 dark:border-white/10"
        style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${team.colors.primary} 20%, transparent), transparent)` }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 p-1 dark:bg-black/25">
          {team.logoUrl ? <img src={team.logoUrl} alt="" className="h-full w-full object-contain" /> : <span className="text-[11px] font-black">{team.abbrev}</span>}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-black">{team.name}</div>
          <div className="text-[10px] text-muted-foreground">{players.length} players</div>
        </div>
      </div>
      <div className="p-1.5">
        {players.map((player) => {
          const selected = player.player_id === selectedPlayerId;
          const best = getPlayerBestMarket(player, trendsByPlayer[player.player_id]);
          const hitPercent = best && best.games.length > 0 ? Math.round(best.rate * 100) : null;
          return (
            <button
              key={player.player_id}
              type="button"
              onClick={() => onSelectPlayer(player.player_id)}
              className={cn(
                'flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left transition-colors',
                selected ? 'bg-white shadow-sm dark:bg-white/10' : 'hover:bg-black/[0.035] dark:hover:bg-white/[0.05]',
              )}
            >
              <div className="mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                {player.headshot_url ? <img src={player.headshot_url} alt="" className="h-full w-full object-cover object-top" /> : <div className="flex h-full items-center justify-center text-[9px] font-bold text-muted-foreground">{player.position}</div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-bold">{player.player_name}</div>
                <div className="flex min-w-0 items-center justify-between gap-2 whitespace-nowrap text-[9px] font-semibold text-muted-foreground">
                  <div className="flex min-w-0 items-center gap-1">
                    <span>{player.position}</span>
                    {best && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="min-w-0 truncate text-primary">{compactMarketLabel(best.market.label)}</span>
                        <span aria-hidden="true">·</span>
                        <span>L10 {best.games.length ? `${best.hits}/${best.games.length}` : '—'}</span>
                        <span aria-hidden="true">·</span>
                        <span className={cn('font-bold', hitPercent != null && hitPercent >= 70 ? 'text-emerald-500' : hitPercent != null && hitPercent >= 55 ? 'text-amber-500' : '')}>{hitPercent == null ? '—' : `${hitPercent}%`}</span>
                      </>
                    )}
                  </div>
                  <span className="shrink-0 font-bold">{player.markets.length} markets</span>
                </div>
              </div>
              {selected && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: team.colors.primary }} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function NflPlayerNavigator({
  game,
  selectedPlayerId,
  trendsByPlayer,
  onSelectPlayer,
  onBack,
}: {
  game: NflPropGameFeedItem;
  selectedPlayerId: string;
  trendsByPlayer: Record<string, NflPropPlayerTrends>;
  onSelectPlayer: (playerId: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto px-3 pb-10 pt-3">
      <button type="button" onClick={onBack} className="mb-3 inline-flex h-8 items-center gap-1 rounded-full px-2 text-[12px] font-bold text-primary hover:bg-primary/10">
        <ArrowLeft className="h-3.5 w-3.5" />
        All matchups
      </button>
      <div className="mb-3 px-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Player props</div>
        <h2 className="text-base font-black">{game.away.abbrev} <span className="text-muted-foreground">@</span> {game.home.abbrev}</h2>
        <p className="text-[11px] text-muted-foreground">Choose another player without leaving this matchup.</p>
      </div>
      <div className="space-y-3">
        <TeamGroup team={game.away} players={game.awayPlayers} selectedPlayerId={selectedPlayerId} trendsByPlayer={trendsByPlayer} onSelectPlayer={onSelectPlayer} />
        <TeamGroup team={game.home} players={game.homePlayers} selectedPlayerId={selectedPlayerId} trendsByPlayer={trendsByPlayer} onSelectPlayer={onSelectPlayer} />
      </div>
    </div>
  );
}
