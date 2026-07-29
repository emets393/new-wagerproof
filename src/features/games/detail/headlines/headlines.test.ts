import { describe, expect, it } from 'vitest';
import {
  mlbMoneylineHeadline,
  mlbPitchersHeadline,
  mlbTotalHeadline,
} from './mlb';
import { nbaSpreadHeadline } from './nba';
import {
  NO_LINE_MOVEMENT_ERROR,
  nflH2HHeadline,
  nflLineMovementHeadline,
  nflSpreadHeadline,
  nflTotalHeadline,
} from './nfl';
import { cfbDryRunPickHeadline, cfbDryRunSummaryHeadline } from './cfb';
import { collegeSpreadHeadline, marketOddsHeadline } from './shared';

/** The real NFL shape: a cover/OU classifier with no model fair line to difference. */
const NFL_H2H_BASE = {
  loading: false,
  error: null,
  matchupVerified: true,
  homeName: 'Cleveland',
  awayName: 'Pittsburgh',
  homeCovers: 0,
  awayCovers: 0,
  overs: 0,
  unders: 0,
};

const LINE_MOVE_BASE = {
  loading: false,
  error: null,
  hasTrainingKey: true,
  pointCount: 4,
};

const DRY_RUN_SUMMARY_BASE = {
  hasScore: true,
  predAway: 24,
  predHome: 31,
  awayAbbrev: 'PITT',
  homeAbbrev: 'CLEM',
  homeWins: true,
  totalGap: null,
  spreadCapped: false,
  isMammothCard: false,
  mammothMarkets: [],
  playMarketCount: 1,
};

describe('deterministic game-detail headlines', () => {
  it('treats the more-negative American price as the favorite', () => {
    expect(mlbPitchersHeadline({
      awayAbbrev: 'ARI',
      homeAbbrev: 'WSH',
      awaySpName: 'Away Starter',
      homeSpName: 'Home Starter',
      awaySpConfirmed: true,
      homeSpConfirmed: true,
      awayMl: 116,
      homeMl: -136,
    })).toContain('favors WSH at -136');
  });

  it('keeps favorite and value-side concepts separate', () => {
    expect(mlbMoneylineHeadline({
      pickTeam: 'ARI',
      pickEdge: 3.3,
      otherEdge: -3.3,
      pickProbPct: 47.8,
      vegasPct: 44.5,
      line: 116,
      favDog: 'underdog',
      acc: null,
    })).toBe(
      "Full game: the model doesn't favor ARI outright, but its 47.8% beats Vegas's 44.5%, a +3.3% edge — underdog value.",
    );
  });

  it('names the already-derived home and away spread picks correctly', () => {
    expect(collegeSpreadHeadline({
      awayName: 'Pittsburgh',
      homeName: 'Cleveland',
      pickIsHome: true,
      absEdge: 4,
    })).toContain('Cleveland');
    expect(collegeSpreadHeadline({
      awayName: 'Pittsburgh',
      homeName: 'Cleveland',
      pickIsHome: false,
      absEdge: 4,
    })).toContain('Pittsburgh');
  });

  it('uses picked-team-perspective NBA lines without flipping them again', () => {
    expect(nbaSpreadHeadline({
      pickAbbrev: 'BOS',
      modelLine: -6,
      marketLine: -3.5,
      edgePts: 2.5,
    })).toContain('BOS -3.5');
  });

  it('names the chart-resolved team and explains its movement', () => {
    expect(marketOddsHeadline({
      marketKey: 'moneyline',
      leaderLabel: 'CIN',
      trailLabel: 'CLE',
      leaderPct: 62,
      trailPct: 38,
      leaderOpenPct: 55,
    })).toBe(
      'Public markets give CIN a 62% chance to win outright, compared with CLE at 38%. CIN is up 7 percentage points from the first tracked price.',
    );
  });

  it('explains what the selected spread and total probabilities mean', () => {
    expect(marketOddsHeadline({
      marketKey: 'spread',
      leaderLabel: 'CIN',
      trailLabel: 'CLE',
      leaderPct: 58,
      trailPct: 42,
      leaderOpenPct: 57,
    })).toContain('chance to cover the selected spread');
    expect(marketOddsHeadline({
      marketKey: 'total',
      leaderLabel: 'Over',
      trailLabel: 'Under',
      leaderPct: 54,
      trailPct: 46,
      leaderOpenPct: 51,
    })).toContain('for the selected game total');
  });

  it('states contradictory total rows without manufacturing an edge', () => {
    expect(mlbTotalHeadline({
      direction: 'UNDER',
      edge: 0.4,
      fairTotal: 8.4,
      marketTotal: 8,
      acc: null,
      strength: 'Weak',
    })).toBe('Full game: the model leans UNDER, projecting 8.40 runs against the Vegas 8.0 total.');
  });

  it('uses the NFL component-resolved pick rather than inferring a side', () => {
    expect(nflSpreadHeadline({
      teamAbbrev: 'PIT',
      vegasLine: 3.5,
      confidencePct: 61,
      pickEdge: 2,
    })).toContain('PIT +3.5');
  });

  // --- NFL with a null edge: the shape every live NFL row actually has -------
  // nfl_predictions_epa is a classifier (cover / OU probabilities only) and
  // publishes no fair line, so pickEdge is permanently null on this sport.

  it('still states the NFL spread pick when the model has no fair line', () => {
    expect(nflSpreadHeadline({
      teamAbbrev: 'PIT',
      vegasLine: -3.5,
      confidencePct: 63,
      pickEdge: null,
    })).toBe('Model expects PIT -3.5 to cover at 63%.');
  });

  it('never claims a line comparison the NFL model cannot make', () => {
    const sentence = nflSpreadHeadline({
      teamAbbrev: 'PIT',
      vegasLine: -3.5,
      confidencePct: 63,
      pickEdge: null,
    });
    expect(sentence).not.toMatch(/Vegas|value/i);
  });

  it('drops the line token when NFL has no posted spread', () => {
    expect(nflSpreadHeadline({
      teamAbbrev: 'PIT',
      vegasLine: null,
      confidencePct: 71,
      pickEdge: null,
    })).toBe('Model expects PIT to cover at 71%.');
  });

  it('names the NFL total side from the resolved isOver, not from a diff', () => {
    expect(nflTotalHeadline({
      isOver: false,
      confidencePct: 64,
      vegasTotal: 44.5,
      pickEdge: null,
      modelTotal: null,
    })).toBe('Model leans UNDER on the 44.5 total at 64% confidence.');
    expect(nflTotalHeadline({
      isOver: true,
      confidencePct: 64,
      vegasTotal: 44.5,
      pickEdge: null,
      modelTotal: null,
    })).toBe('Model leans OVER on the 44.5 total at 64% confidence.');
  });

  it('says so when NFL has neither a fair total nor a posted one', () => {
    expect(nflTotalHeadline({
      isOver: true,
      confidencePct: 55,
      vegasTotal: null,
      pickEdge: null,
      modelTotal: null,
    })).toContain('no posted total to compare against');
  });

  // --- H2H ------------------------------------------------------------------

  it('credits the H2H series lead to the side that actually leads', () => {
    expect(nflH2HHeadline({ ...NFL_H2H_BASE, meetings: 5, homeWins: 4, awayWins: 1 }))
      .toContain('Cleveland leads 4-1');
    expect(nflH2HHeadline({ ...NFL_H2H_BASE, meetings: 5, homeWins: 1, awayWins: 4 }))
      .toContain('Pittsburgh leads 4-1');
  });

  it('withholds H2H entirely when the fetched rows may be a stale matchup', () => {
    expect(nflH2HHeadline({
      ...NFL_H2H_BASE,
      matchupVerified: false,
      meetings: 5,
      homeWins: 4,
      awayWins: 1,
    })).toBeNull();
  });

  it('only claims an H2H over/under trend when one side actually leads', () => {
    expect(nflH2HHeadline({
      ...NFL_H2H_BASE, meetings: 4, homeWins: 3, awayWins: 1, overs: 2, unders: 2,
    })).not.toMatch(/Over|Under/);
    expect(nflH2HHeadline({
      ...NFL_H2H_BASE, meetings: 4, homeWins: 3, awayWins: 1, overs: 3, unders: 1,
    })).toContain('the Over has hit 3 of 4');
  });

  // --- Line movement --------------------------------------------------------

  it('prints a signed spread but an unsigned total in line movement', () => {
    expect(nflLineMovementHeadline({
      ...LINE_MOVE_BASE,
      seriesLabel: 'PHI spread',
      isTotal: false,
      openValue: -3.5,
      currentValue: -6,
    })).toBe('PHI spread has moved 2.5 points, from -3.5 at open to -6 now.');

    expect(nflLineMovementHeadline({
      ...LINE_MOVE_BASE,
      seriesLabel: 'Game total',
      isTotal: true,
      openValue: 44,
      currentValue: 47.5,
    })).toBe('Total has moved up 3.5 points, from 44.0 at open to 47.5 now.');
  });

  it('reports a down move as down, not as a magnitude alone', () => {
    expect(nflLineMovementHeadline({
      ...LINE_MOVE_BASE,
      seriesLabel: 'Game total',
      isTotal: true,
      openValue: 47.5,
      currentValue: 44,
    })).toContain('moved down 3.5 points');
  });

  it('reports no movement across multiple identical snapshots', () => {
    expect(nflLineMovementHeadline({
      ...LINE_MOVE_BASE,
      seriesLabel: 'PHI spread',
      isTotal: false,
      openValue: -3.5,
      currentValue: -3.5,
      snapshotCount: 2,
    })).toBe('PHI spread has not moved off -3.5 across 2 snapshots.');
  });

  it('formats American odds without calling them points', () => {
    expect(nflLineMovementHeadline({
      ...LINE_MOVE_BASE,
      seriesLabel: 'PHI ML',
      isTotal: false,
      valueFormat: 'american',
      openValue: -135,
      currentValue: -150,
    })).toBe('PHI ML has moved from -135 at open to -150 now.');
  });

  it('separates a failed line-history fetch from a genuinely empty one', () => {
    expect(nflLineMovementHeadline({
      ...LINE_MOVE_BASE,
      error: 'Failed to fetch line movement data',
      pointCount: 0,
      seriesLabel: 'PHI spread',
      isTotal: false,
      openValue: null,
      currentValue: null,
    })).toBeNull();

    expect(nflLineMovementHeadline({
      ...LINE_MOVE_BASE,
      error: NO_LINE_MOVEMENT_ERROR,
      pointCount: 0,
      seriesLabel: 'PHI spread',
      isTotal: false,
      openValue: null,
      currentValue: null,
    })).toBe('No line history has been recorded for this game.');
  });

  // --- CFB dry run ----------------------------------------------------------

  it('puts CFB dry-run spread value on the side the gap points to', () => {
    // spreadGap < 0 => model has HOME favoured by more than the book => value HOME.
    expect(cfbDryRunSummaryHeadline({ ...DRY_RUN_SUMMARY_BASE, spreadGap: -3 }))
      .toContain('3 points of spread value toward CLEM');
    expect(cfbDryRunSummaryHeadline({ ...DRY_RUN_SUMMARY_BASE, spreadGap: 3 }))
      .toContain('3 points of spread value toward PITT');
  });

  it('suppresses any CFB spread direction when the model capped the edge', () => {
    const sentence = cfbDryRunSummaryHeadline({
      ...DRY_RUN_SUMMARY_BASE,
      spreadGap: -20,
      spreadCapped: true,
    });
    expect(sentence).toContain('too far off-market to play');
    expect(sentence).not.toContain('spread value toward');
  });

  it('takes the CFB pick side from pick_label verbatim, never from a sign', () => {
    expect(cfbDryRunPickHeadline({
      marketLabel: 'Spread',
      rowCount: 2,
      playCount: 1,
      allDisplayOnly: false,
      leadPickLabel: 'PITT +7.5',
      leadConvictionLabel: 'Strong',
      leadGap: -2.4,
    })).toBe(
      'Spread: model backs PITT +7.5 at strong conviction, with its fair line 2.4 points clear of the market close.',
    );
  });

  it('does not word a projection-only CFB card as a play', () => {
    expect(cfbDryRunPickHeadline({
      marketLabel: '1H Total',
      rowCount: 1,
      playCount: 0,
      allDisplayOnly: true,
      leadPickLabel: 'OVER 27.5',
      leadConvictionLabel: null,
      leadGap: null,
    })).toBe('1H Total: projection only — OVER 27.5 on the board, with no play priced here.');
  });
});
