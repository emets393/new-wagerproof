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
  return (
    <WidgetCard icon={<TrendingUp />} title="Market Odds">
      <MarketOddsChart game={game} />
    </WidgetCard>
  );
}
