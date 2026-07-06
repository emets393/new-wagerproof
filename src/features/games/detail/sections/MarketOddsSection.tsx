import { TrendingUp } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import PolymarketWidget from '@/components/PolymarketWidget';
import type { GameFeedItem } from '../../types';

/** Polymarket prediction-market odds (full widget), all five sports. */
export function MarketOddsSection({ game }: { game: GameFeedItem }) {
  return (
    <WidgetCard icon={<TrendingUp />} title="Market Odds">
      <PolymarketWidget
        awayTeam={game.awayTeam.name}
        homeTeam={game.homeTeam.name}
        gameDate={game.gameDate}
        awayTeamColors={game.awayTeam.colors}
        homeTeamColors={game.homeTeam.colors}
        league={game.sport}
        awayMoneyline={game.lines.awayML}
        homeMoneyline={game.lines.homeML}
      />
    </WidgetCard>
  );
}
