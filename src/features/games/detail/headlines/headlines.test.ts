import { describe, expect, it } from 'vitest';
import {
  mlbMoneylineHeadline,
  mlbPitchersHeadline,
  mlbTotalHeadline,
} from './mlb';
import { nbaSpreadHeadline } from './nba';
import { nflSpreadHeadline } from './nfl';
import { collegeSpreadHeadline, marketOddsHeadline } from './shared';

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

  it('does not invent a team identity from ambiguous Polymarket series', () => {
    expect(marketOddsHeadline({
      marketKey: 'moneyline',
      leaderPct: 62,
      trailPct: 38,
      leaderOpenPct: 55,
    })).toBe(
      'Polymarket prices this moneyline 62% / 38% — the favored side is highlighted below, up 7 pts over the tracked history.',
    );
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
});
