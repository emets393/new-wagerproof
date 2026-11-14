import { describe, expect, it } from 'vitest';
import { clearedCount, lineMovement, nbaOpponentLogo, pickSide, recentForm, signalSentence, type NbaPropDef, type NbaSlateProp } from './nbaPropsApi';

function row(overrides: Partial<NbaSlateProp> = {}): NbaSlateProp {
  return {
    id: 1,
    game_date: '2026-10-28',
    commence_time: null,
    game: 'BOS @ NYK',
    home_abbr: 'NYK',
    away_abbr: 'BOS',
    athlete_id: 1,
    player_name: 'Jalen Brunson',
    position: 'G',
    team: 'NYK',
    opponent: 'BOS',
    headshot_url: null,
    market: 'player_points',
    market_label: 'Points',
    line: 24.5,
    over_price: -115,
    under_price: -105,
    open_line: null,
    line_delta: null,
    gp_prior: 10,
    last_game: null,
    l3_avg: null,
    l5_avg: null,
    l10_avg: null,
    szn_avg: null,
    prior_szn_avg: null,
    prior_szn_gp: null,
    min_l5: null,
    over_rate_l5: null,
    over_rate_l10: null,
    over_rate_szn: null,
    recent_games: [
      { date: '2026-10-20', opp: 'MIA', value: 30, line: 22 },
      { date: '2026-10-22', opp: 'PHI', value: 18, line: 25 },
      { date: '2026-10-18', opp: 'CHI', value: 24.5, line: 24 },
      { date: '2026-10-26', opp: 'MIL', value: 28, line: 24 },
    ],
    baseline: null,
    baseline_gap: null,
    rank_pos: 1,
    rank_tier: null,
    flags: null,
    flag_detail: null,
    report_status: null,
    ...overrides,
  };
}

const overDef: NbaPropDef = {
  signal_key: 'hot_over',
  display_name: 'Hot over',
  one_liner: 'He has been clearing this number.',
  definition: null,
  why_it_works: null,
  bet_direction: 'Over',
  record_text: null,
  season_record_text: null,
};

describe('pickSide', () => {
  it('names the side only when a fired signal has one', () => {
    expect(pickSide(row(), {})).toBeNull();
    expect(pickSide(row({ flags: ['hot_over'] }), { hot_over: overDef })).toBe('over');
    expect(pickSide(row({ flags: ['nba_player_ref_under'] }), {})).toBe('under');
  });
});

describe('nbaOpponentLogo', () => {
  it('maps abbreviations onto ESPN marks', () => {
    expect(nbaOpponentLogo('CHI')).toContain('/chi.png');
    expect(nbaOpponentLogo('nyk')).toContain('/ny.png');
    expect(nbaOpponentLogo('SAS')).toContain('/sa.png');
    expect(nbaOpponentLogo('Chicago Bulls')).toContain('/chi.png');
    expect(nbaOpponentLogo('')).toBeNull();
    expect(nbaOpponentLogo('ZZZ')).toBeNull();
  });
});

describe('clearedCount', () => {
  it('turns a share or a percent into games over the line', () => {
    expect(clearedCount(0.7, 10)).toBe(7);
    expect(clearedCount(70, 10)).toBe(7);
    expect(clearedCount(null, 10)).toBeNull();
  });
});

describe('lineMovement', () => {
  it('keeps the minutes the number changed and marks open, middle, and current', () => {
    const summary = lineMovement([
      { bookmaker: 'draftkings', line: 24.5, over_odds: -110, under_odds: -110, snapshot_time: '2026-10-27T13:10:00Z' },
      { bookmaker: 'fanduel', line: 24.5, over_odds: -115, under_odds: -105, snapshot_time: '2026-10-27T13:10:30Z' },
      { bookmaker: 'draftkings', line: 24.5, over_odds: -110, under_odds: -110, snapshot_time: '2026-10-27T18:00:00Z' },
      { bookmaker: 'draftkings', line: 25.5, over_odds: -110, under_odds: -110, snapshot_time: '2026-10-28T15:00:00Z' },
    ]);
    expect(summary.moves.map((move) => move.line)).toEqual([24.5, 25.5]);
    expect(summary.open?.line).toBe(24.5);
    expect(summary.current?.line).toBe(25.5);
    expect(summary.current?.at).toBeGreaterThan(summary.open?.at ?? 0);
    expect(summary.mid?.line).toBe(24.5);
  });

  it('skips the middle when the number never moved', () => {
    const summary = lineMovement([
      { bookmaker: 'draftkings', line: 10, over_odds: null, under_odds: null, snapshot_time: '2026-10-27T13:00:00Z' },
      { bookmaker: 'draftkings', line: 10, over_odds: null, under_odds: null, snapshot_time: '2026-10-28T13:00:00Z' },
    ]);
    expect(summary.moves).toHaveLength(1);
    expect(summary.mid).toBeNull();
    expect(summary.current?.at).toBeGreaterThan(summary.open?.at ?? 0);
  });
});

describe('signalSentence', () => {
  it('reads the new signal facts and the crew-chief under', () => {
    expect(signalSentence('nba_hot_shooter_under', { nba_hot_shooter_under: { heat_l5: 4.01 } })).toContain('4.0 points');
    expect(signalSentence('nba_player_ref_under', {
      nba_player_ref_under: { above: 3, below: 5, games: 8, chief: 'Sean Wright' },
    })).toBe('5 of 8 games below his norm with Sean Wright');
    expect(signalSentence('nba_backup_same_pos_under', {
      nba_backup_same_pos_under: { out_mpg: 33.8, position: 'G', out_player: 99, games_missed_before: 0 },
    }, (id) => (id === '99' ? 'Coby White' : null))).toBe(
      'Coby White, a 34-minute G starter, is out for the first game and this player is still on the bench',
    );
    expect(signalSentence('nba_homecoming_pts_over', {})).toBeNull();
  });
});

describe('recentForm', () => {
  it('orders games oldest first and clears tonight’s line', () => {
    const form = recentForm(row(), 10);
    expect(form.bars.map((bar) => bar.date)).toEqual(['2026-10-18', '2026-10-20', '2026-10-22', '2026-10-26']);
    expect(form.bars.map((bar) => bar.cleared)).toEqual([false, true, false, true]);
    expect(form.strip.map((bar) => bar.cleared)).toEqual([false, true, false, true]);
    expect(form.hits).toBe(2);
    expect(form.games).toBe(4);
    expect(form.pct).toBe(50);
    expect(form.bars[0].archetype).toBe('CHI');
  });

  it('keeps the last ten games', () => {
    const recent_games = Array.from({ length: 12 }, (_, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, '0')}`,
      opp: 'BOS',
      value: index + 1,
    }));
    const form = recentForm(row({ recent_games, line: 0 }), 10);
    expect(form.games).toBe(10);
    expect(form.bars[0].value).toBe(3);
    expect(form.bars[9].value).toBe(12);
  });
});
