import { describe, expect, it } from 'vitest';
import { ncaabBoardRange } from '../../../api/ncaabGames';
import { rowWinner } from '../nba/TrendsTable';
import {
  awayResultLetter,
  disagreementSentence,
  headToHeadSummary,
  headerContextPills,
  hideRatingsProvider,
  modelIsPlay,
  ncaabPredictedScore,
  ncaabSeasonEnd,
  parseHeadToHead,
  ratingTableRows,
  showEarlySeasonNote,
  signalIsPlay,
} from './ncaabDetail';

describe('college game detail', () => {
  it('keeps the opening slate on the board before Sunday tip and through the first week', () => {
    expect(ncaabBoardRange(new Date('2026-10-30T16:00:00Z'))).toEqual({
      start: '2026-10-30',
      end: '2026-11-08',
    });
    expect(ncaabBoardRange(new Date('2026-11-02T16:00:00Z'))).toEqual({
      start: '2026-11-02',
      end: '2026-11-11',
    });
  });

  it('matches the NBA board of today and tomorrow once the season is underway', () => {
    expect(ncaabBoardRange(new Date('2027-01-15T16:00:00Z'))).toEqual({
      start: '2027-01-15',
      end: '2027-01-16',
    });
  });

  it('treats the season as the ending year', () => {
    expect(ncaabSeasonEnd('2026-10-28')).toBe(2027);
    expect(ncaabSeasonEnd('2026-06-01')).toBe(2027);
    expect(ncaabSeasonEnd('2026-05-31')).toBe(2026);
  });

  it('strips the ratings provider from any copy the card might show', () => {
    expect(hideRatingsProvider("a bottom-quintile KenPom program ranked 40")).toBe(
      'a bottom-quintile program ranked 40',
    );
    expect(hideRatingsProvider("KenPom's thrill score is 60+")).toBe('thrill score is 60+');
  });

  it('badges a model play only inside the bet tier', () => {
    expect(modelIsPlay('bet')).toBe(true);
    expect(modelIsPlay('pass')).toBe(false);
    expect(modelIsPlay(null)).toBe(false);
  });

  it('keeps a tracking read off the play badge', () => {
    expect(signalIsPlay('active', 'active')).toBe(true);
    expect(signalIsPlay('active', 'tracking')).toBe(false);
    expect(signalIsPlay('candidate', 'tracking')).toBe(false);
  });

  it('points a positive spread disagreement at the home side and a positive total at the over', () => {
    expect(disagreementSentence('spread', 1.8, 'Duke', 'Wake')).toBe('1.8 points toward Duke.');
    expect(disagreementSentence('h1_spread', -0.8, 'Duke', 'Wake')).toBe('0.8 points toward Wake.');
    expect(disagreementSentence('total', 0.41, 'Duke', 'Wake')).toBe('0.4 points toward the over.');
    expect(disagreementSentence('spread', 0.02, 'Duke', 'Wake')).toBe('In line with the posted number.');
  });

  it('keeps the home-team series and flips only win/loss for the other side', () => {
    const series = parseHeadToHead({
      opp: 'UCLA',
      opp_id: 313,
      meetings: 10,
      spread: { h: 6, n: 10, pct: 0.6 },
      total: { h: 4, n: 10, pct: 0.4 },
      moneyline: { h: 7, n: 10, pct: 0.7 },
      h1_spread: { h: 2, n: 4, pct: 0.5 },
      h1_total: { h: 1, n: 4, pct: 0.25 },
      h1_moneyline: { h: 4, n: 10, pct: 0.4 },
      team_total: { h: 1, n: 4, pct: 0.25 },
      games: [
        {
          date: '2024-01-01',
          cbbd_id: 1,
          ats: 'L',
          su: 'L',
          ou: 'O',
          spread: 3,
          h1_spread: null,
          h1_ats: null,
        },
        {
          date: '2025-11-14',
          cbbd_id: 209900,
          is_home: false,
          neutral: true,
          team_pts: 69,
          opp_pts: 65,
          spread: -1.5,
          ats: 'W',
          ou: 'U',
          su: 'W',
          h1_ats: 'W',
        },
      ],
    });
    expect(series.meetings).toBe(10);
    expect(series.games.map((game) => game.cbbd_id)).toEqual([209900, 1]);
    expect(series.games[0].h1_spread).toBeNull();
    expect(headToHeadSummary(series.spread, 'ats', 'Arizona', 'UCLA')).toBe(
      'Arizona 6-4 ATS · UCLA 4-6 ATS',
    );
    expect(headToHeadSummary(series.total, 'total', 'Arizona', 'UCLA')).toBe('4 over, 6 under');
    expect(awayResultLetter('W', false)).toBe('L');
    expect(awayResultLetter('L', false)).toBe('W');
    expect(awayResultLetter('P', false)).toBe('P');
    expect(awayResultLetter('U', true)).toBe('U');
    expect(awayResultLetter(null, false)).toBeNull();
    expect(parseHeadToHead({ meetings: 0, games: [] }).meetings).toBe(0);
    expect(parseHeadToHead(null).games).toEqual([]);
  });

  it('builds the header from the neutral site, the tournament, and the broadcast', () => {
    expect(
      headerContextPills({
        neutralSite: true,
        tournament: 'Maui Invitational',
        broadcasts: 'Fox',
        gameType: 'Regular Season',
      }),
    ).toEqual(['Neutral', 'Maui Invitational', 'Fox']);
    expect(
      headerContextPills({
        neutralSite: false,
        tournament: null,
        broadcasts: '',
        gameType: 'Conference Tournament',
      }),
    ).toEqual(['Conference Tournament']);
    expect(
      headerContextPills({
        neutralSite: false,
        tournament: null,
        broadcasts: 'ESPN',
        gameType: 'STD',
      }),
    ).toEqual(['ESPN']);
    expect(
      headerContextPills({
        neutralSite: false,
        tournament: null,
        broadcasts: null,
        gameType: 'TRNMNT',
      }),
    ).toEqual(['Tournament']);
  });

  it('reads the projected final from the prediction row', () => {
    expect(
      ncaabPredictedScore({ home_score_pred: 78.4, away_score_pred: 73.9 }),
    ).toEqual({ away: 73.9, home: 78.4 });
    expect(ncaabPredictedScore({ pred_over_line: 152.3, pred_home_margin: 4.5 })).toEqual({
      away: 73.9,
      home: 78.4,
    });
    expect(ncaabPredictedScore({ pred_over_line: 152.3, pred_spread: -4.5 })).toEqual({
      away: 73.9,
      home: 78.4,
    });
    expect(ncaabPredictedScore({ pred_over_line: 150 })).toBeNull();
  });

  it('highlights the better defensive rating, which is the lower number', () => {
    const defense = ratingTableRows(
      { adj_defense: 92.3, rating: 20 },
      { adj_defense: 98.1, rating: 18 },
    ).find((row) => row.label === 'Adj. defense');
    expect(defense && rowWinner(defense)).toBe('away');
    const tempo = ratingTableRows({ tempo: 70 }, { tempo: 64 }).find((row) => row.label === 'Tempo');
    expect(tempo && rowWinner(tempo)).toBeNull();
  });

  it('shows the early-season note until both teams have a game', () => {
    expect(showEarlySeasonNote(0, 0, true)).toBe(true);
    expect(showEarlySeasonNote(3, 0, true)).toBe(true);
    expect(showEarlySeasonNote(4, 5, true)).toBe(false);
    expect(showEarlySeasonNote(0, 0, false)).toBe(false);
  });
});
