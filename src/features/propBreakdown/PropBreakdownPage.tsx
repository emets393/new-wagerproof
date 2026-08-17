import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { TeamAura } from '@/components/ios';
import { getNFLTeamColors } from '@/features/games/api/nflGames';
import { useNflPropPlayerPage, useNflPropPlayerTrends } from './hooks';
import { MarketToggle } from './components/MarketToggle';
import { OrbitHero } from './components/OrbitHero';
import { ModelStrip } from './components/ModelStrip';
import { ComparisonBlock } from './components/ComparisonBlock';
import { VsTeamCluster } from './components/VsTeamCluster';
import { Last10Strip } from './components/Last10Strip';
import { SituationsDrawer } from './components/SituationsDrawer';
import { PropBreakdownSkeleton } from './components/PropBreakdownSkeleton';
import {
  fetchNflPropSportsbookOdds,
  useSportsbookPreference,
  type SportsbookMarketQuotes,
} from '@/features/games/detail/sportsbooks';

/**
 * /nfl/player/:playerId — Player Prop Breakdown.
 * Edge-first: highlights → overall vs this look → defense → H2H / last-10.
 */
export function PropBreakdownContent({
  playerId,
  onBack,
  backLabel = 'Props',
}: {
  playerId: string | undefined;
  onBack?: () => void;
  backLabel?: string;
}) {
  const pageQ = useNflPropPlayerPage(playerId);
  const trendsQ = useNflPropPlayerTrends(playerId);

  const page = pageQ.data;
  const markets = Array.isArray(page?.markets) ? page.markets : [];
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSelectedKey(null);
  }, [playerId]);

  React.useEffect(() => {
    if (!markets.length) return;
    if (!selectedKey || !markets.some((m) => m.key === selectedKey)) {
      setSelectedKey(markets[0].key);
    }
  }, [markets, selectedKey]);

  const marketKey = selectedKey ?? markets[0]?.key ?? '';
  const selectedMarket = markets.find((m) => m.key === marketKey);
  const colors = getNFLTeamColors(page?.team ?? '');
  const { selectedKeys } = useSportsbookPreference();
  const [boardsByMarket, setBoardsByMarket] = React.useState<Record<string, {
    over: SportsbookMarketQuotes;
    under: SportsbookMarketQuotes;
  } | null>>({});
  const chartLine = selectedMarket?.line
    ?? boardsByMarket[marketKey]?.over.quotes.find((quote) => quote.line != null)?.line
    ?? (marketKey === 'player_anytime_td' ? 0.5 : null);
  const bestOverOdds = boardsByMarket[marketKey]?.over.quotes[0]?.price ?? null;

  React.useEffect(() => {
    if (!playerId || markets.length === 0) {
      setBoardsByMarket({});
      return;
    }
    let cancelled = false;
    Promise.all(markets.map(async (market) => {
      try {
        return [market.key, await fetchNflPropSportsbookOdds(playerId, market.key, page?.season, page?.week)] as const;
      } catch {
        return [market.key, null] as const;
      }
    })).then((entries) => {
      if (!cancelled) setBoardsByMarket(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [playerId, markets, page?.season, page?.week]);

  if (pageQ.isLoading || (pageQ.isFetching && !page)) {
    return <PropBreakdownSkeleton />;
  }

  if (pageQ.error || !page) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-bold">Player prop page not found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {pageQ.error instanceof Error ? pageQ.error.message : 'No row for this slate.'}
        </p>
        {onBack ? (
          <button type="button" onClick={onBack} className="mt-6 text-sm font-bold text-primary hover:underline">
            Back to prop matchups
          </button>
        ) : (
          <Link to="/nfl/props" className="mt-6 inline-block text-sm font-bold text-primary hover:underline">
            Back to prop matchups
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <TeamAura awayColor={colors.primary} homeColor={colors.secondary} />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 pb-12 pt-4">
        <div className="mb-3 flex items-center gap-2.5">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/5 bg-white/60 px-3 text-[12px] font-bold backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLabel}
            </button>
          ) : (
            <Link
              to="/nfl/props"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/5 bg-white/60 px-3 text-[12px] font-bold backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLabel}
            </Link>
          )}
          <span className="text-[12px] text-muted-foreground">
            Week {page.week} · {page.season}
          </span>
        </div>

        <div key={marketKey} className="space-y-3 animate-in fade-in duration-150">
          {/* Player title card is the root of the detail waterfall. */}
          <OrbitHero page={page} teamPrimary={colors.primary} teamSecondary={colors.secondary} />

          {/* 1. Markets and live book lines. */}
          <div className="sticky top-2 z-20 rounded-2xl border border-black/5 bg-white/55 px-3 py-2.5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
            <MarketToggle markets={markets} selectedKey={marketKey} onSelect={setSelectedKey} boardsByMarket={boardsByMarket} selectedBookKeys={selectedKeys} />
          </div>

          {/* 2. WagerProof projection. */}
          <ModelStrip page={page} marketKey={marketKey} market={selectedMarket} marketLine={chartLine} vegasOdds={bestOverOdds} />

          {/* 3. Recent market results. */}
          <Last10Strip log={trendsQ.data?.recent_game_log} marketKey={marketKey} line={chartLine} />

          {/* 4. Dynamic opponent-performance comparison. */}
          <ComparisonBlock page={page} marketKey={marketKey} />

          {/* 5. Historical results against this team. */}
          <VsTeamCluster trends={trendsQ.data} opponent={page.opponent} marketKey={marketKey} marketLabel={selectedMarket?.label ?? 'market'} />

          {/* 6. Situational splits. */}
          <SituationsDrawer splits={trendsQ.data?.splits} marketKey={marketKey} />
        </div>
      </div>
    </div>
  );
}

export default function PropBreakdownPage() {
  const { playerId } = useParams<{ playerId: string }>();
  return <PropBreakdownContent playerId={playerId} />;
}
