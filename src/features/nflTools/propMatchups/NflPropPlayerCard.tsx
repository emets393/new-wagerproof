import { useEffect, useState } from 'react';
import type { NflPropPlayerPage, NflPropPlayerTrends, PropMarket, TrendGameLogEntry } from '@/features/propBreakdown/types';
import { getNFLTeamLogo } from '@/features/games/api/nflGames';
import { fetchNflPropSportsbookOdds, type SportsbookMarketQuotes } from '@/features/games/detail/sportsbooks';

function didHit(result: string | undefined): boolean | null {
  if (!result) return null;
  const value = result.toUpperCase();
  if (value === 'O' || value === 'Y') return true;
  if (value === 'U' || value === 'N') return false;
  return null;
}

function summarizeMarket(market: PropMarket, log: TrendGameLogEntry[]) {
  const games = log.filter((game) => didHit(game.markets?.[market.key]) != null).slice(0, 10);
  const hits = games.filter((game) => didHit(game.markets?.[market.key]) === true).length;
  return { market, games, hits, rate: games.length > 0 ? hits / games.length : -1 };
}

export function getPlayerBestMarket(player: NflPropPlayerPage, trends?: NflPropPlayerTrends | null) {
  const log = trends?.recent_game_log ?? [];
  return player.markets
    .map((market) => summarizeMarket(market, log))
    .sort((a, b) => b.rate - a.rate || b.games.length - a.games.length)[0] ?? null;
}

function formatOdds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${Math.round(value)}`;
}

function formatLine(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function compactMarketLabel(label: string): string {
  return label
    .replace('Receiving ', 'Rec ')
    .replace('Rushing ', 'Rush ')
    .replace('Passing ', 'Pass ')
    .replace('Completions', 'Pass Comp')
    .replace('Attempts', 'Att');
}

function RecentFormStrip({ games, market }: { games: TrendGameLogEntry[]; market: PropMarket }) {
  const chronological = [...games].reverse();
  const values = chronological.map((game) => game.actuals?.[market.key] ?? 0);
  const threshold = market.line ?? (market.key === 'player_anytime_td' ? 0.5 : 1);
  const maxValue = Math.max(threshold * 1.5, ...values, 1);

  return (
    <div className="flex h-[42px] w-[66px] items-end gap-0.5" aria-label={`Last ${games.length} trend`}>
      {chronological.map((game, index) => {
        const hit = didHit(game.markets?.[market.key]);
        const actual = game.actuals?.[market.key];
        const height = Number.isFinite(actual)
          ? Math.max(3, (Number(actual) / maxValue) * 42)
          : hit ? 31 : 14;
        return (
          <span
            key={`${game.season}-${game.week}-${index}`}
            className={hit ? 'min-w-0 flex-1 rounded-t-[2px] bg-emerald-500' : 'min-w-0 flex-1 rounded-t-[2px] bg-rose-500/70'}
            style={{ height }}
            title={`${game.opp}: ${actual ?? game.markets?.[market.key] ?? '—'}`}
          />
        );
      })}
    </div>
  );
}

function InfoItem({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'primary' | 'hot' | 'warm' }) {
  const valueClass = tone === 'primary'
    ? 'text-primary'
    : tone === 'hot'
      ? 'text-emerald-500'
      : tone === 'warm'
        ? 'text-amber-500'
        : 'text-foreground';
  return (
    <div className="min-w-0">
      <div className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className={`text-[12px] font-semibold leading-tight ${valueClass}`}>{value}</div>
    </div>
  );
}

export function NflPropPlayerCard({
  player,
  trends,
  onSelect,
}: {
  player: NflPropPlayerPage;
  trends?: NflPropPlayerTrends | null;
  onSelect: () => void;
}) {
  const summary = getPlayerBestMarket(player, trends);
  const market = summary?.market ?? player.markets[0] ?? null;
  const hitPct = summary && summary.games.length > 0 ? Math.round(summary.rate * 100) : null;
  const hitTone = hitPct != null && hitPct >= 70 ? 'hot' : hitPct != null && hitPct >= 55 ? 'warm' : 'default';
  const logoUrl = getNFLTeamLogo(player.team);
  const isTouchdown = market?.key === 'player_anytime_td';
  const [liveOdds, setLiveOdds] = useState<{
    over: SportsbookMarketQuotes;
    under: SportsbookMarketQuotes;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLiveOdds(null);
    if (!market) return () => { cancelled = true; };
    fetchNflPropSportsbookOdds(player.player_id, market.key)
      .then((result) => {
        if (!cancelled) setLiveOdds(result);
      })
      .catch(() => {
        if (!cancelled) setLiveOdds(null);
      });
    return () => {
      cancelled = true;
    };
  }, [player.player_id, market?.key]);

  if (!market) return null;

  const bestOver = liveOdds?.over.quotes[0];
  const bestUnder = liveOdds?.under.quotes[0];
  const overLine = bestOver?.line ?? market.line;
  const underLine = bestUnder?.line ?? market.line;
  const overPrice = bestOver?.price ?? market.over_price;
  const underPrice = bestUnder?.price ?? market.under_price;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="block w-full rounded-[26px] border border-black/[0.06] bg-white/65 px-2.5 py-2.5 text-left shadow-[0_2px_8px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-colors hover:bg-white/85 dark:border-white/10 dark:bg-[#202024]/70 dark:hover:bg-[#26262b]/80"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative h-10 w-10 shrink-0">
            <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-muted shadow-sm">
              {player.headshot_url ? (
                <img src={player.headshot_url} alt="" className="h-full w-full object-cover object-top" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-muted-foreground">{player.position}</div>
              )}
            </div>
            {logoUrl && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-black/10 bg-background/90 p-0.5 shadow-sm dark:border-white/10">
                <img src={logoUrl} alt="" className="h-full w-full object-contain" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold leading-tight text-foreground">{player.player_name}</div>
            <div className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{player.position} · vs {player.opponent}</div>
            <div className="mt-1 flex min-w-0 gap-1">
              {isTouchdown ? (
                <div className="rounded-full border border-black/[0.06] bg-muted/55 px-1.5 py-0.5 font-mono text-[9px] font-bold dark:border-white/10">
                  TD <span className="text-primary">{formatOdds(overPrice)}</span>
                </div>
              ) : (
                <>
                  <div className="rounded-full border border-black/[0.06] bg-muted/55 px-1.5 py-0.5 font-mono text-[8px] font-bold dark:border-white/10">
                    O {formatLine(overLine)} <span className="text-primary">{formatOdds(overPrice)}</span>
                  </div>
                  <div className="rounded-full border border-black/[0.06] bg-muted/55 px-1.5 py-0.5 font-mono text-[8px] font-bold text-muted-foreground dark:border-white/10">
                    U {formatLine(underLine)} {formatOdds(underPrice)}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="shrink-0">
            <div className="mb-1 text-right text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">L10 trend</div>
            <RecentFormStrip games={summary?.games ?? []} market={market} />
          </div>
        </div>

        <div className="h-px bg-black/[0.06] dark:bg-white/10" />
        <div className="grid grid-cols-[minmax(0,1.5fr)_0.65fr_0.55fr] items-center gap-2">
          <InfoItem label="Best market" value={compactMarketLabel(market.label)} tone="primary" />
          <InfoItem label="Last 10" value={summary && summary.games.length > 0 ? `${summary.hits}/${summary.games.length}` : '—'} />
          <InfoItem label="Hit" value={hitPct == null ? '—' : `${hitPct}%`} tone={hitTone} />
        </div>
      </div>
    </button>
  );
}
