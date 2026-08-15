import { describe, expect, it } from 'vitest';
import {
  formatMargin,
  pushMarginLabel,
  spreadCoverOutcome,
  spreadCoverSummary,
} from './spreadCover';
import { breakEvenPercent, moneylineOutcome } from './moneyline';
import { MLB_EDGE_SCALE, NFL_EDGE_SCALE } from './edgeScale';

/**
 * The cases the spread bar exists to get right. Half vs whole lines is the one
 * that ships silently wrong: "covers unless they lose by 4+" on a +3 dog reads
 * as if a 3-point loss cashed, when it pushes.
 */
describe('spread cover math', () => {
  describe('half-point lines have no push', () => {
    it('a +4.5 dog covers on any loss of 4 or less', () => {
      const o = spreadCoverOutcome(4.5, 2.1);
      expect(o.threshold).toBe(-4.5);
      expect(o.pushMargin).toBeNull();
      expect(o.hasPush).toBe(false);
      expect(o.pushCondition).toBeNull();
      expect(o.coverMin).toBe(-4);
      expect(o.loseMax).toBe(-5);
      expect(o.coverCondition).toBe('Lose by 4 or less, tie, or win');
      expect(o.loseCondition).toBe('Lose by 5+');
    });

    it('a -3.5 favourite has to win by 4', () => {
      const o = spreadCoverOutcome(-3.5, 4.4);
      expect(o.pushMargin).toBeNull();
      expect(o.coverCondition).toBe('Win by 4+');
      expect(o.loseCondition).toBe('Win by 3 or less, tie, or lose');
      // 4.4 projected margin against a 3.5 break-even.
      expect(o.cushion).toBeCloseTo(0.9);
      expect(o.covers).toBe(true);
    });

    it('a +0.5 dog covers on a win or a tie', () => {
      const o = spreadCoverOutcome(0.5, 1);
      expect(o.coverMin).toBe(0);
      expect(o.coverCondition).toBe('Win or tie');
      expect(o.loseCondition).toBe('Lose by 1+');
    });
  });

  describe('whole-point lines push on the number', () => {
    it('names the push on a +3 dog rather than implying a 3-point loss wins', () => {
      const o = spreadCoverOutcome(3, -0.3);
      expect(o.pushMargin).toBe(-3);
      expect(o.hasPush).toBe(true);
      expect(o.pushCondition).toBe('Lose by exactly 3');
      expect(o.coverCondition).toBe('Lose by 2 or less, tie, or win');
      expect(o.loseCondition).toBe('Lose by 4+');
    });

    it('names the push on a -10 favourite', () => {
      const o = spreadCoverOutcome(-10, 11);
      expect(o.pushMargin).toBe(10);
      expect(o.pushCondition).toBe('Win by exactly 10');
      expect(o.coverCondition).toBe('Win by 11+');
      expect(o.loseCondition).toBe('Win by 9 or less, tie, or lose');
      expect(o.cushion).toBe(1);
    });

    it('a pick-em pushes on a tie and never prints -0', () => {
      const o = spreadCoverOutcome(0, 2);
      expect(o.pushMargin).toBe(0);
      expect(Object.is(o.pushMargin, -0)).toBe(false);
      expect(o.pushCondition).toBe('Tie');
      expect(o.coverCondition).toBe('Win by 1+');
      expect(o.loseCondition).toBe('Lose by 1+');
    });
  });

  describe('the model can disagree with the pick', () => {
    it('reports a shortfall when the model lands the wrong side of the number', () => {
      // Laying 7 with a model that only has them winning by 3.
      const o = spreadCoverOutcome(-7, 3);
      expect(o.covers).toBe(false);
      expect(o.cushion).toBe(-4);
      expect(o.modelCondition).toBe('Win by 3');
      expect(spreadCoverSummary(o)).toContain('4 points short');
    });

    it('covers while LOSING on a dog — the case the bar exists to show', () => {
      const o = spreadCoverOutcome(7, -3);
      expect(o.modelMargin).toBe(-3);
      expect(o.modelCondition).toBe('Lose by 3');
      expect(o.covers).toBe(true);
      expect(o.cushion).toBe(4);
    });

    it('calls a dead-even projection what it is', () => {
      expect(spreadCoverOutcome(1.5, 0).modelCondition).toBe('Dead even');
    });

    it('an exactly-on-the-number model does not cover', () => {
      const o = spreadCoverOutcome(-3, 3);
      expect(o.cushion).toBe(0);
      expect(o.covers).toBe(false);
    });
  });

  it('drops "exactly" only in the tick caption, which is already labelled PUSH', () => {
    expect(pushMarginLabel(spreadCoverOutcome(3, 0))).toBe('Lose by 3');
    expect(pushMarginLabel(spreadCoverOutcome(-10, 0))).toBe('Win by 10');
    expect(pushMarginLabel(spreadCoverOutcome(0, 0))).toBe('Tie');
    // Half-point line: nothing pushes, so the tick names no outcome at all.
    expect(pushMarginLabel(spreadCoverOutcome(4.5, 0))).toBeNull();
  });

  it('keeps the signed LINE separate from the margin axis', () => {
    // Half values are legitimate on a line and impossible as a final margin, so
    // the two are formatted by different code paths.
    expect(spreadCoverOutcome(4.5, 0).signedLine).toBe('+4.5');
    expect(spreadCoverOutcome(-10, 0).signedLine).toBe('−10');
  });

  it('drops a trailing .0 but keeps a real decimal', () => {
    expect(formatMargin(7)).toBe('7');
    expect(formatMargin(6.6)).toBe('6.6');
    expect(formatMargin(0)).toBe('0');
  });
});

describe('moneyline break-even', () => {
  it('turns a price into the win rate it has to clear', () => {
    expect(breakEvenPercent(180)).toBeCloseTo(35.71, 2);
    expect(breakEvenPercent(-198)).toBeCloseTo(66.44, 2);
    expect(breakEvenPercent(-110)).toBeCloseTo(52.38, 2);
    expect(breakEvenPercent(100)).toBe(50);
  });

  it('does NOT de-vig — both sides of a -110/-110 market can be losers', () => {
    const home = moneylineOutcome(-110, 0.5, NFL_EDGE_SCALE);
    const away = moneylineOutcome(-110, 0.5, NFL_EDGE_SCALE);
    expect(home.edge).toBeLessThan(0);
    expect(away.edge).toBeLessThan(0);
  });

  it('scores a big dog price as value when the model likes the side', () => {
    const o = moneylineOutcome(180, 0.559, NFL_EDGE_SCALE);
    expect(o.edge).toBeCloseTo(20.19, 2);
    expect(o.isPositiveValue).toBe(true);
    expect(o.zoneTitle).toBe('Strong Value');
  });

  it('scores a short favourite the model fades as a fade', () => {
    const o = moneylineOutcome(-198, 0.441, NFL_EDGE_SCALE);
    expect(o.edge).toBeCloseTo(-22.34, 2);
    expect(o.zoneTitle).toBe('Strong Fade');
  });

  it('uses the sport scale, so MLB and NFL band the same edge differently', () => {
    // 2.5 points of edge: noise on the NFL scale (lean 3), a Value lean on MLB (lean 2).
    const price = -110;
    const prob = (breakEvenPercent(price) + 2.5) / 100;
    expect(moneylineOutcome(price, prob, NFL_EDGE_SCALE).zoneTitle).toBe('No Edge');
    expect(moneylineOutcome(price, prob, MLB_EDGE_SCALE).zoneTitle).toBe('Value');
  });
});
