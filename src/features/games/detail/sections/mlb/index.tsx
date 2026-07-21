import { AlertCircle } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import type { MLBGameSignalsRow, MLBPredictionRow } from '../../../api/mlbGames';
import type { SportSectionsProps } from '../index';
import { MarketOddsSection } from '../MarketOddsSection';
import { MlbMoneylineSection, MlbTotalSection } from './MlbMarketSection';
import { MlbPitchersSection } from './MlbPitchersSection';
import { MlbProjectedScoreSection } from './MlbProjectedScoreSection';
import { MlbRegressionSection } from './MlbRegressionSection';
import { MlbSignalsSection } from './MlbSignalsSection';
import { MlbWeatherSection } from './MlbWeatherSection';
import { MlbBettingTrendsSection } from './MlbBettingTrendsSection';
import { MlbPropsCheatsSection } from './MlbPropsCheatsSection';

/**
 * MLB detail stack for the /games split view — the legacy inline card body
 * from src/pages/MLB.tsx (~lines 920-1330) ported into glass widget sections,
 * plus Polymarket market odds (new — polymarketService already speaks mlb).
 * MLB has no AI completions, so those props are intentionally unused here.
 */
export function MlbSections(props: SportSectionsProps) {
  const { game, extras } = props;
  const raw = game.raw as MLBPredictionRow;

  const signalsByGamePk =
    (extras.signalsByGamePk as Map<string, MLBGameSignalsRow> | undefined) ??
    new Map<string, MLBGameSignalsRow>();

  const awayAbbrev = game.awayTeam.abbrev;
  const homeAbbrev = game.homeTeam.abbrev;

  const marketProps = {
    raw,
    awayAbbrev,
    homeAbbrev,
    away: { logoUrl: game.awayTeam.logoUrl, colors: game.awayTeam.colors },
    home: { logoUrl: game.homeTeam.logoUrl, colors: game.homeTeam.colors },
  };

  // Legacy renders a bare "Postponed" card in place of all game content.
  // The pane hero already labels the game postponed; skip the model sections.
  if (raw.is_postponed === true) {
    return (
      <WidgetCard icon={<AlertCircle />} title="Postponed">
        <p className="text-center text-sm text-muted-foreground">
          This game has been postponed. Model projections are unavailable.
        </p>
      </WidgetCard>
    );
  }

  return (
    <>
      <MlbPitchersSection raw={raw} awayAbbrev={awayAbbrev} homeAbbrev={homeAbbrev} />
      {/* key resets each Full/1st 5 toggle to 'full' per game, matching the
          legacy per-game default. One market per card — see MlbMarketSection. */}
      <MlbProjectedScoreSection
        key={`score-${game.id}`}
        raw={raw}
        awayAbbrev={awayAbbrev}
        homeAbbrev={homeAbbrev}
        awayLogoUrl={game.awayTeam.logoUrl}
        homeLogoUrl={game.homeTeam.logoUrl}
        awayTeamName={game.awayTeam.name}
        homeTeamName={game.homeTeam.name}
      />
      <MlbMoneylineSection key={`ml-${game.id}`} {...marketProps} />
      <MlbTotalSection key={`total-${game.id}`} {...marketProps} />
      <MarketOddsSection game={game} />
      <MlbSignalsSection raw={raw} signalsByGamePk={signalsByGamePk} />
      <MlbRegressionSection
        raw={raw}
        awayAbbrev={awayAbbrev}
        homeAbbrev={homeAbbrev}
        awayTeamName={game.awayTeam.name}
        homeTeamName={game.homeTeam.name}
      />
      <MlbWeatherSection raw={raw} />
      <MlbBettingTrendsSection
        gamePk={raw.game_pk}
        awayAbbrev={awayAbbrev}
        homeAbbrev={homeAbbrev}
        awayLogoUrl={game.awayTeam.logoUrl}
        homeLogoUrl={game.homeTeam.logoUrl}
        awayColor={game.awayTeam.colors.primary}
        homeColor={game.homeTeam.colors.primary}
      />
      <MlbPropsCheatsSection
        gamePk={raw.game_pk}
        awayAbbrev={awayAbbrev}
        homeAbbrev={homeAbbrev}
        gameTimeEt={raw.game_time_et}
      />
    </>
  );
}
