import {
  CollegeSpreadSection,
  CollegeTotalSection,
  hasCollegeModelOutput,
  type CollegeModelInput,
} from '../cfb/CollegeModelCards';
import { toNum } from '../cfb/shared';
import type { NCAABPrediction } from '../../../api/ncaabGames';
import type { GameFeedItem } from '../../../types';

interface NcaabPredictionsSectionProps {
  game: GameFeedItem;
  /** AI completion texts for this game, keyed by widget type. */
  completions: Record<string, string>;
}

/**
 * NCAAB model output, split into one card per market.
 *
 * NCAAB and CFB emit the same model shape (`pred_spread`/`home_spread_diff`,
 * `pred_over_line`/`over_line_diff`), so both render the same widgets from
 * `sections/cfb/CollegeModelCards` instead of keeping two copies that drift.
 * `pred_spread` / `pred_over_line` sit behind the row's index signature here,
 * hence the `toNum` coercion.
 */
export function NcaabPredictionsSection({ game, completions }: NcaabPredictionsSectionProps) {
  const raw = game.raw as unknown as NCAABPrediction;

  const input: CollegeModelInput = {
    away: game.awayTeam,
    home: game.homeTeam,
    predSpread: toNum(raw.pred_spread),
    homeSpreadDiff: raw.home_spread_diff ?? null,
    vegasHomeSpread: raw.home_spread ?? game.lines.homeSpread ?? null,
    predOverLine: toNum(raw.pred_over_line),
    overLineDiff: raw.over_line_diff ?? null,
    vegasTotal: toNum(raw.api_over_line) ?? raw.over_line ?? game.lines.total ?? null,
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
