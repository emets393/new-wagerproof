import {
  CATEGORY_EMPHASIS,
  CATEGORY_RANK,
  MARKET_NOUN,
  THRESHOLDS,
  type MarketRead,
  type PublicCategory,
  type PublicMarket,
  type PublicSide,
} from './types';

export interface MarketInput {
  market: PublicMarket;
  betsAway: number | null;
  betsHome: number | null;
  moneyAway: number | null;
  moneyHome: number | null;
  awayOpen: number | null;
  homeOpen: number | null;
  /** ⛔ The current line — consensus book. See lineDirection; never midpoint the closes. */
  awayCons: number | null;
  homeCons: number | null;
  /** Best price each side can get right now. Displayed beside the line, never used for movement. */
  awayClose: number | null;
  homeClose: number | null;
  tickets: number | null;
  hasSplit: boolean;
  awayName: string;
  homeName: string;
}

const other = (side: PublicSide): PublicSide => (side === 'away' ? 'home' : 'away');

/** American odds to a 0–1 implied probability. Never subtract the prices themselves. */
export function impliedProbability(american: number): number {
  if (american < 0) return -american / (-american + 100);
  return 100 / (american + 100);
}

export function formatLine(market: PublicMarket, value: number): string {
  if (market === 'ml') {
    const rounded = Math.round(value);
    return rounded > 0 ? `+${rounded}` : String(rounded);
  }
  const rounded = Math.round(value * 100) / 100;
  if (market === 'spread' && rounded === 0) return 'PK';
  const text = String(rounded);
  if (market === 'spread' && rounded > 0) return `+${text}`;
  return text;
}

function finite(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

export interface LineQuote {
  movedToward: PublicSide | null;
  moveSize: number | null;
  open: number | null;
  current: number | null;
  homeOpen: number | null;
  homeCurrent: number | null;
}

function emptyQuote(open: number | null, homeOpen: number | null): LineQuote {
  return { movedToward: null, moveSize: null, open, current: null, homeOpen, homeCurrent: null };
}

/** No-vig away share. American prices are never subtracted. */
function deviggedAway(awayPrice: number, homePrice: number): number {
  const away = impliedProbability(awayPrice);
  const home = impliedProbability(homePrice);
  return away / (away + home);
}

/**
 * ⛔ THE CURRENT LINE IS `awayCons`, NEVER A MIDPOINT OF THE CLOSE COLUMNS.
 *
 * `away_close` / `home_close` are each side's BEST price across the books, so the two sides
 * hold different numbers and neither is a line. An earlier version of this file averaged
 * them, which recovers half the cross-book spread and put `3.25` and `17.25` spreads on
 * screen — numbers no sportsbook posts. `away_cons` / `home_cons` are Action Network's
 * consensus book (15), the real posted half-point number, and the same book the ticket and
 * money percentages come from, so the line and the splits finally describe one market.
 *
 * Movement is consensus minus opener, both real lines. A negative spread move is toward the
 * away team; a negative total move is toward the under. Moneyline compares no-vig implied
 * probabilities, because American prices cannot be subtracted.
 */
export function lineDirection(input: {
  market: PublicMarket;
  awayOpen: number | null;
  homeOpen: number | null;
  awayCons: number | null;
  homeCons: number | null;
}): LineQuote {
  const { market, awayOpen, homeOpen, awayCons, homeCons } = input;
  const awayClose = awayCons;
  const homeClose = homeCons;

  if (market === 'total') {
    if (!finite(awayOpen) || !finite(awayClose)) {
      return emptyQuote(finite(awayOpen) ? awayOpen : null, null);
    }
    const current = awayClose;
    const move = current - awayOpen;
    return {
      movedToward: move === 0 ? null : move > 0 ? 'away' : 'home',
      moveSize: Math.abs(move),
      open: awayOpen,
      current,
      homeOpen: null,
      homeCurrent: null,
    };
  }

  if (market === 'spread') {
    if (!finite(awayOpen) || !finite(awayClose)) {
      return emptyQuote(finite(awayOpen) ? awayOpen : null, finite(homeOpen) ? homeOpen : null);
    }
    const current = awayClose;
    const move = current - awayOpen;
    return {
      movedToward: move === 0 ? null : move < 0 ? 'away' : 'home',
      moveSize: Math.abs(move),
      open: awayOpen,
      current,
      homeOpen: finite(homeOpen) ? homeOpen : null,
      homeCurrent: finite(homeClose) ? homeClose : null,
    };
  }

  const priced =
    finite(awayOpen) && finite(homeOpen) && finite(awayClose) && finite(homeClose);
  if (!priced) {
    return {
      ...emptyQuote(finite(awayOpen) ? awayOpen : null, finite(homeOpen) ? homeOpen : null),
      current: finite(awayClose) ? awayClose : null,
      homeCurrent: finite(homeClose) ? homeClose : null,
    };
  }
  const move = deviggedAway(awayClose, homeClose) - deviggedAway(awayOpen, homeOpen);
  return {
    movedToward: move === 0 ? null : move > 0 ? 'away' : 'home',
    moveSize: Math.abs(move),
    open: awayOpen,
    current: awayClose,
    homeOpen,
    homeCurrent: homeClose,
  };
}

/** Spread and moneyline quotes name the team. A bare plus number is never "the" line. */
export function quoteLine(
  market: PublicMarket,
  awayName: string,
  homeName: string,
  quote: Pick<LineQuote, 'open' | 'current' | 'homeOpen' | 'homeCurrent'>,
): string {
  if (market === 'total') {
    if (quote.open === null && quote.current === null) return 'Line unavailable';
    if (quote.open === null || quote.current === null) {
      const only = quote.current ?? quote.open;
      return only === null ? 'Line unavailable' : formatLine('total', only);
    }
    return `${formatLine('total', quote.open)} → ${formatLine('total', quote.current)}`;
  }

  const away =
    quote.open !== null && quote.current !== null
      ? `${awayName} ${formatLine(market, quote.open)} → ${formatLine(market, quote.current)}`
      : quote.current !== null
        ? `${awayName} ${formatLine(market, quote.current)}`
        : quote.open !== null
          ? `${awayName} ${formatLine(market, quote.open)}`
          : '';
  const home =
    quote.homeOpen !== null && quote.homeCurrent !== null
      ? `${homeName} ${formatLine(market, quote.homeOpen)} → ${formatLine(market, quote.homeCurrent)}`
      : quote.homeCurrent !== null
        ? `${homeName} ${formatLine(market, quote.homeCurrent)}`
        : quote.homeOpen !== null
          ? `${homeName} ${formatLine(market, quote.homeOpen)}`
          : '';
  return [away, home].filter(Boolean).join(' · ') || 'Line unavailable';
}

function sideName(market: PublicMarket, side: PublicSide, awayName: string, homeName: string): string {
  if (market === 'total') return side === 'away' ? 'the Over' : 'the Under';
  return side === 'away' ? awayName : homeName;
}

function pct(value: number): string {
  return String(Math.round(value));
}

function confirmSize(market: PublicMarket): number {
  return THRESHOLDS.CONFIRM_MOVE[market];
}

function strongSize(market: PublicMarket): number {
  return THRESHOLDS.STRONG_MOVE[market];
}

/**
 * Tickets, money, and line movement for one game-market.
 * First matching category wins. 0/100 and thin ticket counts are excluded, not greyed.
 */
export function readMarket(input: MarketInput): MarketRead {
  const names: Record<PublicSide, string> = {
    away: sideName(input.market, 'away', input.awayName, input.homeName),
    home: sideName(input.market, 'home', input.awayName, input.homeName),
  };
  const betsAway = input.betsAway;
  const betsHome = input.betsHome;
  const moneyKnown = input.moneyAway !== null && input.moneyHome !== null;
  const moneyAway = input.moneyAway ?? 0;
  const moneyHome = input.moneyHome ?? 0;
  const direction = lineDirection(input);

  const blank = (excluded: boolean): MarketRead => ({
    market: input.market,
    ticketSide: null,
    ticketLead: 0,
    moneyTiltSide: null,
    tiltPp: 0,
    movedToward: direction.movedToward,
    moveSize: direction.moveSize,
    open: direction.open,
    current: direction.current,
    homeOpen: direction.homeOpen,
    homeCurrent: direction.homeCurrent,
    betsAway: betsAway ?? 0,
    betsHome: betsHome ?? 0,
    moneyAway,
    moneyHome,
    category: null,
    emphasis: 'none',
    strong: false,
    chip: '',
    chipNote: '',
    sentence: '',
    excluded,
    sideName: names,
  });

  const noSplit =
    !input.hasSplit ||
    betsAway === null ||
    betsHome === null ||
    betsAway === 0 ||
    betsHome === 0 ||
    betsAway === 100 ||
    betsHome === 100;
  if (noSplit) return blank(true);
  if (input.tickets === null || input.tickets < THRESHOLDS.MIN_TICKETS) return blank(true);
  // ⛔ ml ONLY — see THRESHOLDS.ML_MIN_MINORITY. On spreads and totals a 12/88 split is a
  // real lopsided football game, not noise, and this floor used to throw 25 of them away.
  if (input.market === 'ml' && Math.min(betsAway, betsHome) < THRESHOLDS.ML_MIN_MINORITY) {
    return blank(true);
  }

  // Ties go to the away slot, matching the spec. `ticketSide` stays null on a tie so
  // the UI can still say the tickets are even.
  const popular: PublicSide = betsAway >= betsHome ? 'away' : 'home';
  const quiet = other(popular);
  const ticketSide: PublicSide | null = betsAway === betsHome ? null : popular;
  const ticketLead = Math.max(betsAway, betsHome);

  const moneyTiltSide: PublicSide | null = !moneyKnown || moneyAway === betsAway
    ? null
    : moneyAway > betsAway
      ? 'away'
      : 'home';
  const tiltPp = moneyKnown ? Math.abs(moneyAway - betsAway) : 0;

  const base = {
    market: input.market,
    ticketSide,
    ticketLead,
    moneyTiltSide,
    tiltPp,
    movedToward: direction.movedToward,
    moveSize: direction.moveSize,
    open: direction.open,
    current: direction.current,
    homeOpen: direction.homeOpen,
    homeCurrent: direction.homeCurrent,
    betsAway,
    betsHome,
    moneyAway,
    moneyHome,
    sideName: names,
    excluded: false,
  };

  const moved = direction.movedToward;
  const moveSize = direction.moveSize;
  const confirmed =
    moved !== null && moveSize !== null && moveSize >= confirmSize(input.market);
  const name = (side: PublicSide) => names[side];
  const moveText =
    direction.open !== null && direction.current !== null
      ? input.market === 'spread'
        ? `${input.awayName} ${formatLine('spread', direction.open)} → ${formatLine('spread', direction.current)}`
        : `${formatLine(input.market, direction.open)} → ${formatLine(input.market, direction.current)}`
      : '';
  const onSide = (side: PublicSide, away: number, home: number) => (side === 'away' ? away : home);

  const finish = (
    category: PublicCategory | null,
    chip: string,
    sentence: string,
    chipNote = '',
    strong = false,
  ): MarketRead => ({
    ...base,
    category,
    emphasis: category === null ? 'none' : CATEGORY_EMPHASIS[category],
    chip,
    sentence,
    chipNote,
    strong,
  });

  // ⛔ Collapse a sub-threshold move to "no move" ONCE, here, so no branch below re-checks
  // the size. A 0.25-point drift is not the line following anything.
  const effectiveMove = confirmed ? moved : null;

  // Two different events, and they must not share a branch. Both can exceed the threshold.
  //   diverging = the money is on the side the crowd is NOT on
  //   piling    = the money is piling further onto the side the crowd IS on
  const diverging = moneyTiltSide === quiet && tiltPp >= THRESHOLDS.DIVERGE_TILT;
  const piling = moneyTiltSide === popular && tiltPp >= THRESHOLDS.DIVERGE_TILT;

  const betsOnQuiet = onSide(quiet, betsAway, betsHome);
  const moneyOnQuiet = onSide(quiet, moneyAway, moneyHome);
  const moneyOnPopular = onSide(popular, moneyAway, moneyHome);
  const crowdText = `${pct(ticketLead)}% of bets are on ${name(popular)}`;

  // ⛔ Categories 1–5 are spread and total only. A moneyline row skips to consensus.
  if (input.market !== 'ml' && diverging) {
    if (effectiveMove === quiet) {
      const strong =
        tiltPp >= THRESHOLDS.STRONG_TILT &&
        moveSize !== null &&
        moveSize >= strongSize(input.market);
      return finish(
        'sharp_money',
        `Sharp Money on ${name(quiet)}`,
        `${crowdText}, but ${name(quiet)} is taking ${pct(moneyOnQuiet)}% of the money on ${pct(betsOnQuiet)}% of the tickets — and the ${MARKET_NOUN[input.market]} has moved ${moveText}. The line is following the money, not the tickets.`,
        '',
        strong,
      );
    }

    if (effectiveMove === null) {
      return finish(
        'money_no_move',
        `Money on ${name(quiet)}`,
        `${name(quiet)} has ${pct(moneyOnQuiet)}% of the money on ${pct(betsOnQuiet)}% of the tickets. The line hasn't moved for it yet.`,
      );
    }

    return finish(
      'line_fights_money',
      'Line fighting the money',
      `The money leans ${name(quiet)}, but the ${MARKET_NOUN[input.market]} has moved toward ${name(popular)}, ${moveText}.`,
    );
  }

  if (input.market !== 'ml' && piling && effectiveMove === popular) {
    // ⛔ The public with volume, not sharp action. This is the read most easily
    // mistaken for sharp_money, so the sentence has to say so.
    return finish(
      'hammered',
      `Hammered on ${name(popular)}`,
      `${name(popular)} is taking ${pct(ticketLead)}% of the bets and an even bigger ${pct(moneyOnPopular)}% of the money, and the line has moved with it. That is the public with real volume behind it, not sharp action.`,
    );
  }

  // ⛔ line_pushes_back outranks this. A line moving against piled money is the book
  // fading the public, not "the line hasn't followed yet".
  if (input.market !== 'ml' && piling && effectiveMove !== quiet) {
    return finish(
      'public_loading',
      `Public loading up on ${name(popular)}`,
      `${name(popular)} has ${pct(ticketLead)}% of the bets and ${pct(moneyOnPopular)}% of the money. The line hasn't followed.`,
    );
  }

  if (
    !diverging &&
    effectiveMove === quiet &&
    (ticketLead >= THRESHOLDS.HEAVY_TICKETS || piling)
  ) {
    return finish(
      'line_pushes_back',
      'Line pushing back',
      `${pct(ticketLead)}% of bets and ${pct(moneyOnPopular)}% of the money are on ${name(popular)}, but the line moved toward ${name(quiet)}.`,
    );
  }

  if (ticketLead >= THRESHOLDS.HEAVY_TICKETS && effectiveMove === popular) {
    return finish(
      'consensus',
      `Everyone on ${name(popular)}`,
      `Bets and money are both on ${name(popular)} (${pct(ticketLead)}% / ${pct(moneyOnPopular)}%), and the line moved with them, ${moveText}.`,
    );
  }

  if (ticketLead >= THRESHOLDS.HEAVY_TICKETS) {
    return finish(
      'public',
      `Public on ${name(popular)}`,
      `${pct(ticketLead)}% of bets are on ${name(popular)}.`,
    );
  }

  if (ticketLead > THRESHOLDS.LEAN_TICKETS) {
    return finish(
      'split',
      `Leaning ${name(popular)}`,
      `Bets lean ${name(popular)} (${pct(ticketLead)}%) and the money agrees. Nothing unusual.`,
    );
  }

  return finish('split', 'Split', 'The money and the tickets are split.');
}

/** Lower sorts first. Category rank, then tilt, then move size. */
export function compareReads(a: MarketRead, b: MarketRead): number {
  const rank = (read: MarketRead) => (read.category === null ? 99 : CATEGORY_RANK[read.category]);
  const byCategory = rank(a) - rank(b);
  if (byCategory !== 0) return byCategory;
  if (b.tiltPp !== a.tiltPp) return b.tiltPp - a.tiltPp;
  return (b.moveSize ?? -1) - (a.moveSize ?? -1);
}
