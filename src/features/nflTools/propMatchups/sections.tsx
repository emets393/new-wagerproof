import * as React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Shield, Target, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SegmentedControl, WidgetCard } from '@/components/ios';
import type { NflPropPlayerPage, NflPropPlayerTrends, TrendMatchupMarket } from '@/features/propBreakdown/types';
import { formatPerGame } from '@/features/propBreakdown/format';
import { LOOK_BUCKET_LABELS } from '@/features/propBreakdown/marketMap';
import { resolveSchemeCompare } from '@/features/propBreakdown/schemeCompare';
import { type NflPropGameFeedItem } from './model';

function isMatchup(v: unknown): v is TrendMatchupMarket {
  return Boolean(v) && typeof v === 'object' && 'h' in (v as object) && 'n' in (v as object);
}

/** Opponent defense identity for the side currently selected. */
export function DefenseIdentityCard({
  players,
  opponentAbbr,
}: {
  players: NflPropPlayerPage[];
  opponentAbbr: string;
}) {
  const defense = players.find((p) => p.scheme?.defense)?.scheme?.defense ?? null;
  if (!defense) {
    return (
      <WidgetCard icon={<Shield />} title="Defense they face" subtitle={`vs ${opponentAbbr}`}>
        <p className="text-[13px] text-muted-foreground">No defensive identity for this opponent yet.</p>
      </WidgetCard>
    );
  }

  const dims = (['man', 'two_high', 'pressure', 'blitz', 'heavy_box', 'light_box'] as const)
    .map((key) => {
      const d = defense[key];
      if (!d || typeof d === 'string' || !('rate' in d)) return null;
      return { key, rate: d.rate, pctile: d.pctile };
    })
    .filter(Boolean) as { key: string; rate: number; pctile: number }[];

  const labels: Record<string, string> = {
    man: 'Man',
    two_high: 'Two-high',
    pressure: 'Pressure',
    blitz: 'Blitz',
    heavy_box: 'Heavy box',
    light_box: 'Light box',
  };

  return (
    <WidgetCard
      icon={<Shield />}
      title="Defense they face"
      subtitle={`${opponentAbbr} scheme profile — rates are share of snaps.`}
    >
      {defense.identity && (
        <div className="mb-3 inline-flex rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-800 dark:text-amber-200">
          {defense.identity}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {dims.map((d) => (
          <div
            key={d.key}
            className="rounded-xl border border-black/5 bg-muted/40 px-2.5 py-2 dark:border-white/10"
          >
            <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              {labels[d.key] ?? d.key}
            </div>
            <div className="font-mono text-[15px] font-bold">{Math.round(d.rate * 100)}%</div>
            <div className="text-[10px] text-muted-foreground">{Math.round(d.pctile)}th %ile</div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

function PlayerPropRow({
  player,
  trends,
}: {
  player: NflPropPlayerPage;
  trends?: NflPropPlayerTrends | null;
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

  return (
    <Link
      to={`/nfl/player/${encodeURIComponent(player.player_id)}`}
      className="block rounded-2xl border border-black/5 bg-white/50 p-3 transition-colors hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
    >
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

          {/* Overall vs look — receiving YPT / QB EPA / RB box */}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/40 px-2.5 py-2">
              <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                {compare?.overallLabel ?? 'Overall'}
                {compare?.sample === 'thin' && (
                  <span className="ml-1 text-amber-700 dark:text-amber-300">· thin</span>
                )}
              </div>
              {compare?.overallValue != null ? (
                <div className="font-mono text-[13px] font-bold">
                  {formatPerGame(compare.overallValue, compare.mode === 'receiving' ? 1 : 2)}{' '}
                  {compare.overallUnit}
                </div>
              ) : (
                <div className="text-[12px] text-muted-foreground">No career split yet</div>
              )}
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-2">
              <div className="text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                Vs this look
              </div>
              {!compare || compare.lookRows.length === 0 ? (
                <div className="text-[12px] text-muted-foreground">Thin sample</div>
              ) : (
                <div className="space-y-0.5">
                  {compare.lookRows.slice(0, 2).map((row) => (
                    <div key={row.key} className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-mono font-bold">
                        {formatPerGame(row.value, compare.mode === 'receiving' ? 1 : 2)}
                        {row.delta != null && Math.abs(row.delta) >= row.deltaThreshold && (
                          <span
                            className={cn(
                              'ml-1 text-[10px]',
                              row.delta > 0
                                ? 'text-emerald-600 dark:text-emerald-300'
                                : 'text-rose-600 dark:text-rose-300'
                            )}
                          >
                            {row.delta > 0 ? '+' : ''}
                            {formatPerGame(row.delta, Math.abs(row.delta) < 1 ? 2 : 1)}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Vs team + look hit rate */}
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {vsTeam && primaryMarket && (
              <span className="rounded-full border border-black/5 bg-muted/50 px-2 py-0.5 font-semibold dark:border-white/10">
                vs {opp}: {vsTeam.h}/{vsTeam.n} {primaryMarket.label.toLowerCase()}
              </span>
            )}
            {hitEntry && (
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 font-semibold',
                  hitEntry.pct != null && hitEntry.pct >= 0.6
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                    : hitEntry.pct != null && hitEntry.pct <= 0.4
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200'
                      : 'border-black/5 bg-muted/50 dark:border-white/10'
                )}
              >
                {LOOK_BUCKET_LABELS[hitEntry.bucket] ?? hitEntry.bucket}: {hitEntry.h}/{hitEntry.n}
              </span>
            )}
          </div>

          {edge && (
            <p
              className={cn(
                'mt-2 line-clamp-2 text-[12px] leading-snug',
                edge.direction === 'up'
                  ? 'text-emerald-800 dark:text-emerald-200'
                  : 'text-rose-800 dark:text-rose-200'
              )}
            >
              <span className="mr-1 text-[9px] font-bold uppercase tracking-wide opacity-80">
                {edge.direction === 'up' ? 'Up' : 'Down'}
              </span>
              {edge.text}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export function NflPropMatchupsSections({
  item,
  trendsByPlayer,
}: {
  item: NflPropGameFeedItem;
  trendsByPlayer: Record<string, NflPropPlayerTrends>;
}) {
  // Default HOME team per product request.
  const [side, setSide] = React.useState<'home' | 'away'>('home');

  React.useEffect(() => {
    setSide('home');
  }, [item.id]);

  const players = side === 'home' ? item.homePlayers : item.awayPlayers;
  const opponentAbbr = side === 'home' ? item.away.abbrev : item.home.abbrev;
  const sideTeam = side === 'home' ? item.home : item.away;

  return (
    <>
      <DefenseIdentityCard players={players} opponentAbbr={opponentAbbr} />

      <WidgetCard
        icon={<Users />}
        title={`${sideTeam.abbrev} players`}
        subtitle="Overall · vs this look · vs this team. Tap a player for the full breakdown."
        accessory={
          <SegmentedControl
            layoutId={`nfl-prop-side-${item.id}`}
            size="sm"
            options={[
              { value: 'home' as const, label: item.home.abbrev },
              { value: 'away' as const, label: item.away.abbrev },
            ]}
            value={side}
            onChange={setSide}
          />
        }
      >
        {players.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No players listed for this side.</p>
        ) : (
          <div className="space-y-2">
            {players.map((p) => (
              <PlayerPropRow key={p.player_id} player={p} trends={trendsByPlayer[p.player_id]} />
            ))}
          </div>
        )}
      </WidgetCard>

      {item.topHighlight && (
        <WidgetCard icon={<Target />} title="Featured edge">
          <Link
            to={`/nfl/player/${encodeURIComponent(item.topHighlight.player.player_id)}`}
            className="flex items-start gap-3 rounded-2xl border border-black/5 bg-muted/30 p-3 transition-colors hover:bg-muted/50 dark:border-white/10"
          >
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-black/5 dark:ring-white/10">
              {item.topHighlight.player.headshot_url ? (
                <img
                  src={item.topHighlight.player.headshot_url}
                  alt=""
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[12px] font-bold text-muted-foreground">
                  {item.topHighlight.player.position}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold leading-tight text-foreground">
                    {item.topHighlight.player.player_name}
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">
                    {item.topHighlight.player.position} · {item.topHighlight.player.team}
                  </div>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    item.topHighlight.highlight.direction === 'up'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                  )}
                >
                  {item.topHighlight.highlight.direction === 'up' ? 'Edge up' : 'Edge down'}
                </span>
              </div>
              <p
                className={cn(
                  'mt-2 text-[13px] leading-snug',
                  item.topHighlight.highlight.direction === 'up'
                    ? 'text-emerald-800 dark:text-emerald-200'
                    : 'text-rose-800 dark:text-rose-200'
                )}
              >
                {item.topHighlight.highlight.text}
              </p>
              <span className="mt-2 inline-flex text-[12px] font-bold text-primary">
                Open full breakdown →
              </span>
            </div>
          </Link>
        </WidgetCard>
      )}
    </>
  );
}
