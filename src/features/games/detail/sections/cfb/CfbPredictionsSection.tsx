import {
  CollegeSpreadSection,
  CollegeTotalSection,
  hasCollegeModelOutput,
  type CollegeModelInput,
} from './CollegeModelCards';
import type { CFBPrediction } from '../../../api/cfbGames';
import type { GameFeedItem } from '../../../types';

interface CfbPredictionsSectionProps {
  game: GameFeedItem<CFBPrediction>;
  /** AI completion texts for this game, keyed by widget type. */
  completions: Record<string, string>;
}

/**
 * Regular-mode CFB model output, split into one card per market.
 *
 * The feed adapter already resolved logos/colors/abbrevs onto
 * `game.awayTeam` / `game.homeTeam` (cfb_team_mapping in regular mode, the
 * cfb_teams row in dry-run), so these cards read team visuals from there rather
 * than taking a second pass at the mapping table.
 */
export function CfbPredictionsSection({ game, completions }: CfbPredictionsSectionProps) {
  const prediction = game.raw;

  // Normalize undefined → null so the `!== null` gates below stay correct off-season.
  const input: CollegeModelInput = {
    away: game.awayTeam,
    home: game.homeTeam,
    predSpread: prediction.pred_spread ?? null,
    homeSpreadDiff: prediction.home_spread_diff ?? null,
    vegasHomeSpread: prediction.home_spread ?? game.lines.homeSpread ?? null,
    predOverLine: prediction.pred_over_line ?? null,
    overLineDiff: prediction.over_line_diff ?? null,
    vegasTotal: prediction.api_over_line ?? prediction.over_line ?? game.lines.total ?? null,
    completions,
  };

  if (!hasCollegeModelOutput(input)) return null;

  return (
    <>
      <CollegeSpreadSection input={input} />
      <CollegeTotalSection input={input} />
    </>
  );
}
