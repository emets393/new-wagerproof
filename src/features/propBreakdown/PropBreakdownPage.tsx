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
import { HighlightRibbons } from './components/HighlightRibbons';
import { SituationsDrawer } from './components/SituationsDrawer';
import { PropBreakdownSkeleton } from './components/PropBreakdownSkeleton';

/**
 * /nfl/player/:playerId — Player Prop Breakdown.
 * Edge-first: highlights → overall vs this look → defense → H2H / last-10.
 */
export default function PropBreakdownPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const pageQ = useNflPropPlayerPage(playerId);
  const trendsQ = useNflPropPlayerTrends(playerId);

  const page = pageQ.data;
  const markets = Array.isArray(page?.markets) ? page.markets : [];
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [highlightsExpanded, setHighlightsExpanded] = React.useState(false);

  React.useEffect(() => {
    setSelectedKey(null);
    setHighlightsExpanded(false);
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

  const marketHighlights = React.useMemo(() => {
    const all = Array.isArray(page?.highlights) ? page.highlights : [];
    if (!marketKey) return [];
    return all.filter((h) => Array.isArray(h.markets) && h.markets.includes(marketKey));
  }, [page?.highlights, marketKey]);

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
        <Link to="/nfl/props" className="mt-6 inline-block text-sm font-bold text-primary hover:underline">
          Back to prop matchups
        </Link>
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
          <Link
            to="/nfl/props"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/5 bg-white/60 px-3 text-[12px] font-bold backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Props
          </Link>
          <span className="text-[12px] text-muted-foreground">
            Week {page.week} · {page.season}
          </span>
        </div>

        <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-black/5 bg-background/85 px-4 py-2.5 backdrop-blur-xl dark:border-white/10">
          <MarketToggle
            markets={markets}
            selectedKey={marketKey}
            onSelect={(key) => {
              setSelectedKey(key);
              setHighlightsExpanded(false);
            }}
          />
        </div>

        <div key={marketKey} className="space-y-3 animate-in fade-in duration-150">
          <ModelStrip page={page} marketKey={marketKey} market={selectedMarket} />

          <OrbitHero page={page} teamPrimary={colors.primary} teamSecondary={colors.secondary} />

          <HighlightRibbons
            highlights={marketHighlights}
            expanded={highlightsExpanded}
            onExpand={() => setHighlightsExpanded(true)}
          />

          <ComparisonBlock page={page} marketKey={marketKey} />

          <div className="grid gap-3 lg:grid-cols-2">
            <VsTeamCluster
              trends={trendsQ.data}
              opponent={page.opponent}
              marketKey={marketKey}
              marketLabel={selectedMarket?.label ?? 'market'}
            />
            <Last10Strip log={trendsQ.data?.recent_game_log} marketKey={marketKey} />
          </div>

          <SituationsDrawer splits={trendsQ.data?.splits} marketKey={marketKey} />
        </div>
      </div>
    </div>
  );
}
