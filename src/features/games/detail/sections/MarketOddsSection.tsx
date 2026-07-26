import * as React from 'react';
import { TrendingUp } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { MarketOddsChart } from './MarketOddsChart';
import type { GameFeedItem } from '../../types';

/**
 * Polymarket prediction-market odds, all five sports. Uses MarketOddsChart
 * rather than the legacy `@/components/PolymarketWidget`, which packed a market
 * switcher, alert banners and its own layout into one ~800-line component.
 */
export function MarketOddsSection({ game }: { game: GameFeedItem }) {
  // The headline is a function of the chart's own fetched series and its
  // user-switchable market tab, so it can't be a pre-generated daily string —
  // switching Moneyline/Spread/Total has to re-render it. The chart hands the
  // finished sentence up rather than the section re-deriving from `game.raw`.
  const [headline, setHeadline] = React.useState<string | null>(null);

  return (
    <WidgetCard icon={<TrendingUp />} title="Market Odds" headline={headline ?? undefined}>
      <MarketOddsChart game={game} onHeadlineChange={setHeadline} />
    </WidgetCard>
  );
}
