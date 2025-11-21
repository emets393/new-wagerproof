/**
 * Betslip link generator for various sportsbooks
 * 
 * Note: Actual betslip prefill links vary by sportsbook and may require
 * specific URL parameters. These are basic deep links that direct users
 * to the sportsbook page for the event.
 */

import { OddsApiEvent } from '@/services/theOddsApi';
import { findBetOdds } from '@/services/theOddsApi';

/**
 * Construct betslip link for DraftKings
 */
export function constructDraftKingsLink(eventId: string, betType?: string, teamName?: string): string {
  // DraftKings uses event IDs in their URLs
  // Format: https://sportsbook.draftkings.com/event/{event_id}
  // Note: Actual deep link format may vary - this directs to the event page
  return `https://sportsbook.draftkings.com/event/${eventId}`;
}

/**
 * Construct betslip link for FanDuel
 */
export function constructFanDuelLink(eventId: string, betType?: string, teamName?: string): string {
  // FanDuel event page format
  return `https://www.fanduel.com/sportsbook/${eventId}`;
}

/**
 * Construct betslip link for BetMGM
 */
export function constructBetMGMLink(eventId: string, betType?: string, teamName?: string): string {
  // BetMGM event page format
  return `https://sports.betmgm.com/en/sports/events/${eventId}`;
}

/**
 * Construct betslip link for Caesars
 */
export function constructCaesarsLink(eventId: string, betType?: string, teamName?: string): string {
  // Caesars event page format
  return `https://www.caesars.com/sportsbook/events/${eventId}`;
}

/**
 * Construct betslip link for Bet365
 */
export function constructBet365Link(eventId: string, betType?: string, teamName?: string): string {
  // Bet365 uses a specific URL format with event ID
  return `https://www.bet365.com/#/AC/B18/C20604387/D48/E${eventId}/F`;
}

/**
 * Construct betslip link based on sportsbook key
 */
export function constructBetslipLink(
  sportsbookKey: string,
  eventId: string,
  betType?: string,
  teamName?: string
): string | null {
  const constructors: Record<string, (id: string, betType?: string, teamName?: string) => string> = {
    'draftkings': constructDraftKingsLink,
    'fanduel': constructFanDuelLink,
    'betmgm': constructBetMGMLink,
    'caesars': constructCaesarsLink,
    'bet365': constructBet365Link,
  };

  const constructor = constructors[sportsbookKey.toLowerCase()];
  if (!constructor) {
    return null;
  }

  return constructor(eventId, betType, teamName);
}

/**
 * Generate betslip links for all top sportsbooks from an event
 * Uses actual betslip links from The Odds API when available
 */
export function generateBetslipLinks(
  event: OddsApiEvent,
  betType?: string,
  teamName?: string,
  line?: number
): Record<string, string> {
  const links: Record<string, string> = {};

  if (!event.bookmakers) {
    return links;
  }


  for (const bookmaker of event.bookmakers) {
    // Try to find specific bet odds with betslip link
    if (betType && (teamName || betType.includes('over') || betType.includes('under'))) {
      const betData = findBetOdds(event, bookmaker.key, betType, teamName, line);
      if (betData?.betslipLink) {
        links[bookmaker.key] = betData.betslipLink;
        continue;
      }
    }

    // Fallback to event page link if betslip link not available
    if (bookmaker.link) {
      links[bookmaker.key] = bookmaker.link;
    } else {
      // Last resort: construct generic link
      const link = constructBetslipLink(bookmaker.key, event.id, betType, teamName);
      if (link) {
        links[bookmaker.key] = link;
      }
    }
  }

  return links;
}

