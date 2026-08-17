/**
 * Per-book shopping for game-detail cards. Preference lives on
 * `profiles.preferred_sportsbooks` and is cached locally so the chip leads
 * with the user's best book and never hides a better number elsewhere.
 *
 * Cross-platform siblings — keep the maths in step:
 *   iOS     `WagerproofKit/Sources/WagerproofModels/SportsbookQuote.swift`
 *   Android `core/models/SportsbookQuote.kt`
 */
export {
  BestBookChip,
} from './BestBookChip';
export { useSportsbookPreference } from './preference';
export {
  fetchCfbSportsbookOdds,
  fetchMlbSportsbookOdds,
  fetchNflPropSportsbookOdds,
  fetchNflSportsbookOdds,
} from './oddsService';
export {
  SPORTSBOOK_PREF_KEY,
  SPORTSBOOK_SELECTABLE,
  cfbAliasMatches,
  decodePreferredBooks,
  encodePreferredBooks,
  formatAmerican,
  formatSignedLine,
  isQuoteFromSelection,
  marketFromFootballPick,
  preferredBooksSummary,
  preferredQuote,
  quotesForMarket,
  sportsbookName,
  type SportsbookGameOdds,
  type SportsbookMarket,
  type SportsbookMarketQuotes,
  type SportsbookQuote,
} from './quotes';
