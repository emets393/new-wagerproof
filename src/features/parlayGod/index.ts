// Public surface of the Parlay God module. Import from `@/features/parlayGod`.
export type {
  ParlayGodCategory,
  ParlayLegKind,
  ParlayLeg,
  ParlayTicket,
  ParlayGodPropMatchup,
} from './types';
export {
  PARLAY_CATEGORY_ORDER,
  PARLAY_CATEGORY_TITLE,
  PARLAY_CATEGORY_ICON,
  legOddsText,
  legFractionText,
  ticketIsSameGame,
} from './types';

export {
  MIN_SAMPLE,
  ODDS_FLOOR,
  ALT_LINE_MIN_STREAK,
  MAX_LEGS,
  MIN_LEGS,
  SAME_GAME_MAX_LEGS,
  MARKET_CAP,
  decimalOdds,
  americanText,
  combinedOddsText,
  teamLegs,
  propLegs,
  assemble,
  slateTickets,
  propsTickets,
  gameTickets,
  buildParlayTickets,
  type AssembleOptions,
} from './engine';

export { buildPropMatchups, type LineupTeamRow } from './propMatchupAdapter';
export { useParlayGod, type UseParlayGodResult } from './useParlayGod';
export { ProGate } from './ProGate';
