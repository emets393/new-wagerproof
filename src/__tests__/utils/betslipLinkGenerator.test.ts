import { describe, it, expect } from 'vitest';
import {
  constructDraftKingsLink,
  constructFanDuelLink,
  constructBetMGMLink,
  constructCaesarsLink,
  constructBet365Link,
  constructBetslipLink,
} from '@/utils/betslipLinkGenerator';

describe('betslipLinkGenerator', () => {
  const eventId = 'test-event-123';

  describe('constructDraftKingsLink', () => {
    it('generates correct DraftKings URL', () => {
      const link = constructDraftKingsLink(eventId);
      expect(link).toBe(`https://sportsbook.draftkings.com/event/${eventId}`);
    });

    it('includes event ID in URL', () => {
      const link = constructDraftKingsLink('abc-def');
      expect(link).toContain('abc-def');
    });
  });

  describe('constructFanDuelLink', () => {
    it('generates correct FanDuel URL', () => {
      const link = constructFanDuelLink(eventId);
      expect(link).toBe(`https://www.fanduel.com/sportsbook/${eventId}`);
    });
  });

  describe('constructBetMGMLink', () => {
    it('generates correct BetMGM URL', () => {
      const link = constructBetMGMLink(eventId);
      expect(link).toBe(`https://sports.betmgm.com/en/sports/events/${eventId}`);
    });
  });

  describe('constructCaesarsLink', () => {
    it('generates correct Caesars URL', () => {
      const link = constructCaesarsLink(eventId);
      expect(link).toBe(`https://www.caesars.com/sportsbook/events/${eventId}`);
    });
  });

  describe('constructBet365Link', () => {
    it('generates correct Bet365 URL with event ID', () => {
      const link = constructBet365Link(eventId);
      expect(link).toContain(eventId);
      expect(link).toContain('bet365.com');
    });
  });

  describe('constructBetslipLink', () => {
    it('generates link for known sportsbook', () => {
      const link = constructBetslipLink('draftkings', eventId);
      expect(link).toBe(`https://sportsbook.draftkings.com/event/${eventId}`);
    });

    it('is case-insensitive for sportsbook key', () => {
      const link = constructBetslipLink('DraftKings', eventId);
      expect(link).toBe(`https://sportsbook.draftkings.com/event/${eventId}`);
    });

    it('returns null for unknown sportsbook', () => {
      const link = constructBetslipLink('unknown-book', eventId);
      expect(link).toBeNull();
    });

    it('generates links for all supported sportsbooks', () => {
      const sportsbooks = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'bet365'];
      for (const book of sportsbooks) {
        const link = constructBetslipLink(book, eventId);
        expect(link).not.toBeNull();
        expect(link).toContain('http');
      }
    });
  });
});
