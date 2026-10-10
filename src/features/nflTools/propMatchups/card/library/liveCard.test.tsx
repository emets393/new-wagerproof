import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { FpCards, NflPropPlayerPage, PropDefense } from '@/features/propBreakdown/types';
import { gradedWeeks, LivePropCard, medianMargin, rankedTraits, schemeLooks, trenchCopy } from './liveCard';
import { SpotlightPickCard } from '../SpotlightPickCard';

function page(): NflPropPlayerPage {
  return {
    player_id: 'adams',
    season: 2026,
    week: 5,
    player_name: 'Davante Adams',
    position: 'WR',
    team: 'LA',
    opponent: 'BUF',
    is_home: false,
    game_label: 'LA at BUF',
    kickoff: '2026-10-13T00:15:00+00:00',
    headshot_url: null,
    markets: [
      { key: 'player_reception_yds', label: 'Receiving yards', line: 63.5, over_price: -114, under_price: -114, status: 'posted' },
      { key: 'player_anytime_td', label: 'Anytime TD', line: null, over_price: -105, under_price: null, status: 'posted' },
    ],
    baseline: { season: 2025, games: 17, rec_yds: 57.29, total_td: 15 },
    ngs: null,
    scheme: {
      opponent: 'BUF',
      kind: 'receiving',
      defense: {
        identity: 'TWO-HIGH SHELL',
        identity_by_family: { receiving: 'TWO-HIGH SHELL' },
        note_by_family: { receiving: 'blitzes often — expect quick throws' },
        man: { rate: 0.32, pctile: 59 },
        two_high: { rate: 0.57, pctile: 94 },
      } as unknown as PropDefense,
      player_overall: { ypt: 8.02, targets: 1301, pctile: 67, sample: 'ok' },
      player_splits: {
        man: { ypt: 7.68, targets: 522, pctile: 69, delta_ypt: -0.34, sample: 'ok' },
        zone: { ypt: 8.26, targets: 779, pctile: 70, delta_ypt: 0.23, sample: 'ok' },
      },
    },
    highlights: [],
    fp_cards: null,
  };
}

describe('live prop card', () => {
  it('reads the posted line and does not turn overlapping looks into a pie', () => {
    const html = renderToStaticMarkup(
      <LivePropCard page={page()} marketKey="player_reception_yds" onMarket={() => {}} facts={[{ label: 'Total', value: '47.5' }]} />,
    );
    expect(html).toContain('63.5');
    expect(html).toContain('O');
    expect(html).toContain('U');
    expect(html).toContain('57.3');
    expect(html).toContain('2025 · 17 games');
    expect(html).toContain('sits in a two-high shell');
    expect(html).toContain('Coverage');
    expect(html).not.toContain('The trenches');
    expect(html).toContain('plays this on 32% of snaps');
    expect(html).toContain('7.68');
    expect(html).toContain('yards a target');
    expect(html).toContain('class="wheel"');
    expect(html).not.toContain('no routes on file');
    expect(html).not.toContain('yards a route');
    expect(html).not.toMatch(/\bOver\b/);
    expect(html).not.toMatch(/\bUnder\b/);
  });

  it('draws the cover wheel and points alignment and routes toward a side', () => {
    const html = renderToStaticMarkup(
      <LivePropCard
        page={{
          ...page(),
          fp_cards: {
            coverage: {
              overall: { yards_per_route: 2.67 },
              by: {
                Cover3: { def_plays_rate: 0.34, yards_per_route: 3.24, routes: 12.75, games: 4 },
                Cover2: { def_plays_rate: 0.11, yards_per_route: 1.12, routes: 8.5, games: 4 },
              },
            },
            playsheet: { spots: { slot: { routes: 4.75 }, wide: { routes: 31 } } },
            matchup: {
              vs_alignment: {
                slot: { yds_actual: 77, yds_league: 63, yds_rank: 9, yds_of: 32 },
                wide: { yds_actual: 124, yds_league: 107, yds_rank: 8, yds_of: 32 },
              },
            },
            routes: [{
              route: 'Go',
              share: 0.2,
              routes: 7.7,
              def_yards_per_route_actual: 1.11,
              def_yards_per_route_league: 1.31,
              def_rank: 21,
              def_of: 32,
            }],
          },
        }}
        marketKey="player_reception_yds"
        onMarket={() => {}}
      />,
    );
    expect(html).toContain('class="wheel"');
    expect(html).toContain('Man');
    expect(html).toContain('yards a target');
    expect(html).not.toContain('Cover 3');
    expect(html).not.toContain('no routes on file');
    expect(html).toContain('Out wide');
    expect(html).toContain('row duel');
    expect(html).toContain('21st of 32');
    expect(html).not.toMatch(/\bOver\b/);
    expect(html).not.toMatch(/\bUnder\b/);
  });

  it('switches the funnel with the market and only stamps the book that posted that line', () => {
    const shared = {
      ...page(),
      player_name: 'Aaron Jones',
      position: 'RB',
      markets: [
        { key: 'player_rush_yds', label: 'Rushing yards', line: 72.5, over_price: -114, under_price: -114, status: 'posted' as const },
        { key: 'player_reception_yds', label: 'Receiving yards', line: 18.5, over_price: -110, under_price: -117, status: 'posted' as const },
      ],
      scheme: {
        ...page().scheme!,
        kind: 'rushing',
        defense: {
          ...page().scheme!.defense,
          identity_by_family: { receiving: 'TWO-HIGH SHELL', rushing: 'LIGHT BOX' },
          heavy_box: { rate: 0.2, pctile: 40 },
          light_box: { rate: 0.72, pctile: 80 },
        },
        player_overall: { ypt: 8.02, targets: 40, pctile: 60, sample: 'ok', ypc: 4.4 },
        rush_splits: {
          heavy_box: { carries: 40, ypc: 3.8, delta_ypc: -0.6, sample: 'ok' },
          light_box: { carries: 80, ypc: 4.9, delta_ypc: 0.5, sample: 'ok' },
        },
      },
      fp_cards: {
        coverage: {
          overall: { yards_per_route: 1.4 },
          by: { Cover3: { def_plays_rate: 0.34, yards_per_route: 1.2, routes: 2, games: 4 } },
        },
        playsheet: { spots: { wide: { routes: 3 } } },
        matchup: {
          vs_alignment: { wide: { yds_actual: 20, yds_league: 18, yds_rank: 12, yds_of: 32 } },
          vs_position: { rush_yds_actual: 138.5, rush_yds_league: 91.7, rush_yds_rank: 1, rush_yds_of: 32 },
        },
        routes: [{ route: 'Go', share: 0.2, routes: 1.2, def_yards_per_route_actual: 1.1, def_yards_per_route_league: 1.3, def_rank: 21, def_of: 32 }],
        run_concept: {
          by: { Man: { yards_per_attempt: 5, attempts: 9, def_yards_per_attempt: 4.6, def_yards_per_attempt_league: 4.22, def_rank: 13, def_of: 32 } },
        },
        role: { carry_share: 0.64, target_share: 0.12 },
      },
    } as unknown as NflPropPlayerPage;
    const books = {
      player_rush_yds: {
        overBook: 'draftkings',
        overLine: 71.5,
        overPrice: -114,
        underBook: 'fanduel',
        underLine: 72.5,
        underPrice: -114,
      },
    };
    const rush = renderToStaticMarkup(
      <LivePropCard page={shared} marketKey="player_rush_yds" onMarket={() => {}} books={books} />,
    );
    expect(rush).toContain('72.5');
    expect(rush).toContain('/sportsbooks/fanduel.png');
    expect(rush).not.toContain('/sportsbooks/draftkings.png');
    expect(rush).toContain('How he runs');
    expect(rush).toContain('rushing yards a game');
    expect(rush).toContain('Carry share');
    expect(rush).not.toContain('sits in a light box');
    expect(rush).not.toContain('heavy box');
    expect(rush).not.toContain('His route tree');
    expect(rush).not.toContain('Where he lines up');
    expect(rush).not.toContain('class="wheel"');
    expect(rush).not.toContain('Target share');
    expect(rush).not.toMatch(/\bOver\b/);
    expect(rush).not.toMatch(/\bUnder\b/);

    const receiving = renderToStaticMarkup(
      <LivePropCard page={shared} marketKey="player_reception_yds" onMarket={() => {}} books={books} />,
    );
    expect(receiving).toContain('18.5');
    expect(receiving).toContain('His route tree');
    expect(receiving).toContain('Where he lines up');
    expect(receiving).not.toContain('class="wheel"');
    expect(receiving).not.toContain('How he runs');
    expect(receiving).not.toContain('Carry share');
  });

  it('uses the blended baseline and the quarterback wheel, and keeps the line separate from the price', () => {
    const html = renderToStaticMarkup(
      <LivePropCard
        page={{
          ...page(),
          player_name: 'Kyler Murray',
          position: 'QB',
          team: 'ARI',
          opponent: 'NO',
          markets: [
            { key: 'player_pass_yds', label: 'Passing yards', line: 212.5, over_price: -114, under_price: -114, status: 'posted' },
            { key: 'player_anytime_td', label: 'Anytime TD', line: null, over_price: 465, under_price: null, status: 'posted' },
            { key: 'player_rush_attempts', label: 'Rush attempts', line: null, over_price: null, under_price: null, status: 'pending' },
          ],
          baseline: { season: 2025, games: 5, pass_yds: 192.4 },
          projection: null,
          scheme: {
            opponent: 'NO',
            kind: 'qb',
            defense: {
              identity: 'ZONE',
              identity_by_family: { passing: 'ZONE' },
              zone: { rate: 0.57, pctile: 80 },
              man: { rate: 0.22, pctile: 40 },
              blitz: { rate: 0.31, pctile: 70 },
              pressure: { rate: 0.28, pctile: 60 },
            },
            player_overall: { ypa: 6.93, dropbacks: 3000, epa_db: 0.1, comp_pct: 0.66, sack_rate: 0.06, pctile: 65 },
            player_splits: {
              zone: { ypa: 7.44, delta_ypa: 0.51, pctile: 73, dropbacks: 2111 },
              man: { ypa: 5.82, delta_ypa: -1.1, pctile: 42, dropbacks: 913 },
              blitz: { ypa: 6.4, delta_ypa: -0.53, pctile: 48, dropbacks: 400 },
              pressure: { ypa: 5.1, delta_ypa: -1.83, pctile: 30, dropbacks: 220 },
            },
          },
          fp_cards: {
            baseline: {
              pass_yds: {
                blended: 201.03,
                season_to_date: 207.5,
                prior_season: 192.4,
                games: 2,
                weight_this_season: 0.571,
                rookie: false,
              },
            },
            coverage: {
              by: {
                Cover3: { def_plays_rate: 0.34, yards_per_route: null, routes: null, games: 4 },
              },
            },
          },
        } as unknown as NflPropPlayerPage}
        marketKey="player_pass_yds"
        onMarket={() => {}}
      />,
    );
    expect(html).toContain('201.0');
    expect(html).toContain('207.5 this season and 192.4 last, weighted 57/43');
    expect(html).not.toContain('2025 · 5 games');
    expect(html).toContain('7.44');
    expect(html).toContain('Blitz');
    expect(html).toContain('Pressure');
    expect(html).toContain('yards an attempt');
    expect(html).not.toContain('yards a route');
    expect(html).not.toContain('no routes on file');
    expect(html).not.toContain('Cover 3');
    expect(html).toContain('212.5');
    expect(html).toContain('O');
    expect(html).toContain('+465');
    expect(html).toContain('no line yet');
    expect(html).not.toContain('212.5−114');
    expect(html).not.toMatch(/\bOver\b/);

    const anytime = renderToStaticMarkup(
      <LivePropCard
        page={{
          ...page(),
          player_name: 'Kyler Murray',
          position: 'QB',
          team: 'ARI',
          opponent: 'NO',
          markets: [
            { key: 'player_pass_yds', label: 'Passing yards', line: 212.5, over_price: -114, under_price: -114, status: 'posted' },
            { key: 'player_anytime_td', label: 'Anytime TD', line: null, over_price: 465, under_price: null, status: 'posted' },
          ],
          scheme: {
            opponent: 'NO',
            kind: 'qb',
            defense: {
              identity: 'ZONE',
              identity_by_family: { passing: 'ZONE' },
              zone: { rate: 0.57, pctile: 80 },
              man: { rate: 0.22, pctile: 40 },
            },
            player_overall: { ypa: 6.93, dropbacks: 3000 },
            player_splits: {
              zone: { ypa: 7.44, delta_ypa: 0.51, pctile: 73, dropbacks: 2111 },
              man: { ypa: 5.82, delta_ypa: -1.1, pctile: 42, dropbacks: 913 },
            },
          },
          fp_cards: null,
        } as unknown as NflPropPlayerPage}
        marketKey="player_anytime_td"
        onMarket={() => {}}
      />,
    );
    expect(anytime).toContain('+465');
    expect(anytime).not.toContain('yards an attempt');
    expect(anytime).not.toContain('dropbacks');
    expect(anytime).not.toContain('Coverage');
    expect(html).not.toMatch(/\bUnder\b/);
  });

  it('keeps a look that has no defensive rate, and grades only games with both a result and a line', () => {
    const looks = schemeLooks(page(), 'player_reception_yds');
    expect(looks.find((look) => look.name === 'Zone')?.pct).toBeNull();
    expect(gradedWeeks([
      { season: 2026, week: 1, opp: 'BUF', actuals: { player_reception_yds: 80 }, lines: { player_reception_yds: 60 } },
      { season: 2026, week: 2, opp: 'BUF', actuals: { player_reception_yds: 40 } },
    ], 'player_reception_yds')).toEqual([{
      label: 'W1',
      margin: 20,
      season: 2026,
      week: 1,
      opponent: 'BUF',
      line: 60,
    }]);
  });

  it('walks the game log from oldest to newest and marks the season break', () => {
    const weeks = gradedWeeks([
      { season: 2026, week: 4, opp: 'DAL', is_home: false, actuals: { player_rush_yds: 93 }, lines: { player_rush_yds: 87.5 } },
      { season: 2026, week: 1, opp: 'GB', is_home: true, actuals: { player_rush_yds: 40 }, lines: { player_rush_yds: 29.5 } },
      { season: 2025, week: 17, opp: 'DET', is_home: true, actuals: { player_rush_yds: 53 }, lines: { player_rush_yds: 58.5 } },
    ], 'player_rush_yds');
    expect(weeks.map((week) => week.label)).toEqual(['W17', 'W1', 'W4']);
    expect(weeks[0]).toMatchObject({ opponent: 'DET', line: 58.5, season: 2025 });
    expect(weeks[2]).toMatchObject({ opponent: 'DAL', line: 87.5, home: false });
    expect(medianMargin(weeks.map((week) => week.margin))).toBe(5.5);

    const current = Array.from({ length: 8 }, (_, index) => ({
      season: 2026,
      week: index + 1,
      opp: 'GB',
      actuals: { player_rush_yds: 40 },
      lines: { player_rush_yds: 30 },
    }));
    const mixed = gradedWeeks([
      { season: 2025, week: 18, opp: 'DET', actuals: { player_rush_yds: 10 }, lines: { player_rush_yds: 20 } },
      ...current,
    ], 'player_rush_yds');
    expect(mixed.every((week) => week.season === 2026)).toBe(true);
    expect(mixed[0].label).toBe('W1');
  });

  it('leads the trench card with the larger edge and keeps traits outside 5% of the league', () => {
    const cards = {
      trenches: {
        line: { ol_pressure_faced_rank: 25, ol_ybc_per_att: 1.5876288659793814 },
        front: {
          dl_pressure_generated_rank: 5,
          dl_ybc_allowed: 2.0555555555555554,
          dl_ybc_allowed_rank: 23,
        },
        pass_pro_edge: -0.0959674884429007,
        run_block_edge: 0.17193263623320232,
      },
      scheme: {
        defense_traits: {
          RushingRunsExplosivePercentage_actual: 0.05545430298719772,
          RushingRunsExplosivePercentage_league: 0.03828409035314074,
          RushingRunsExplosivePercentage_rank: 6,
          RushingRunsExplosivePercentage_of: 32,
          RushingConceptManAttemptsSuccessPercentage_actual: 0.35119047619047616,
          RushingConceptManAttemptsSuccessPercentage_league: 0.49637975472531176,
          RushingConceptManAttemptsSuccessPercentage_rank: 30,
          RushingConceptManAttemptsSuccessPercentage_of: 32,
          RushingYardsAfterContactPerAttempt_actual: 1.987,
          RushingYardsAfterContactPerAttempt_league: 1.95,
          RushingYardsAfterContactPerAttempt_rank: 14,
          RushingYardsAfterContactPerAttempt_of: 32,
        },
      },
      run_concept: {
        by: {
          Zone: { attempts: 7.5, yards_per_attempt: 3.5, def_yards_per_attempt: 5.28, def_yards_per_attempt_league: 4.14, def_rank: 3, def_of: 32 },
        },
      },
    } as unknown as FpCards;
    const copy = trenchCopy(cards, 'TB', 'DAL');
    expect(copy).toBeTruthy();
    expect(copy!.indexOf('1.59')).toBeLessThan(copy!.indexOf('win the pocket'));
    expect(copy).toContain('Tampa Bay opens 1.59');
    expect(copy).toContain('Dallas front giving up 2.06, 23rd of 32');
    expect(copy).toContain('In the pocket it flips: Dallas win the pocket');
    expect(copy).toContain("Tampa Bay's line is 25th of 32");
    expect(copy).not.toContain('average fronts');
    expect(trenchCopy({ trenches: { pass_pro_edge: 0.01, run_block_edge: -0.02 } }, 'TB', 'DAL')).toBeNull();

    const traits = rankedTraits(cards, 'rushing').map((trait) => trait.label);
    expect(traits[0]).toBe('Explosive runs');
    expect(traits).toContain('Man/gap run success');
    expect(traits).not.toContain('Yards after contact');

    const html = renderToStaticMarkup(
      <LivePropCard
        page={{
          ...page(),
          player_name: 'Bucky Irving',
          position: 'RB',
          team: 'TB',
          opponent: 'DAL',
          markets: [{ key: 'player_rush_yds', label: 'Rushing yards', line: 68.5, over_price: -110, under_price: -110, status: 'posted' }],
          scheme: {
            opponent: 'DAL',
            kind: 'rb',
            defense: { identity: 'AVERAGE FRONTS', identity_by_family: { rushing: 'AVERAGE FRONTS' } },
          },
          fp_cards: cards,
        } as unknown as NflPropPlayerPage}
        marketKey="player_rush_yds"
        onMarket={() => {}}
        log={[
          { season: 2026, week: 4, opp: 'DAL', is_home: false, actuals: { player_rush_yds: 93 }, lines: { player_rush_yds: 87.5 } },
          { season: 2026, week: 1, opp: 'GB', is_home: true, actuals: { player_rush_yds: 40 }, lines: { player_rush_yds: 29.5 } },
          { season: 2025, week: 17, opp: 'DET', is_home: true, actuals: { player_rush_yds: 53 }, lines: { player_rush_yds: 58.5 } },
        ]}
      />,
    );
    expect(html).not.toContain('average fronts');
    expect(html).not.toContain('heavy box');
    expect(html).toContain('7.5 of his carries are zone');
    expect(html).toContain('bar pos');
    expect(html).toContain('bar neg');
    expect(html).not.toContain('bar nil');
    expect(html).toMatch(/bar pos" style="left:50%;width:[1-9]/);
    expect(html).toContain('class="log-zero"');
    expect(html.indexOf('2025')).toBeLessThan(html.indexOf('2026'));
    expect(html.indexOf('vs DET')).toBeLessThan(html.indexOf('vs GB'));
    expect(html.indexOf('vs GB')).toBeLessThan(html.indexOf('@ DAL'));
    expect(html).toContain('87.5');
    expect(html).toContain('2 of 3 · +5.5');
  });

  it('prints the spotlight narrative in full', () => {
    const narrative = 'The numbers point over for Aaron Jones’s rushing yards, led by a projected game script where Minnesota runs on 55% of snaps, up from a neutral rate of 43%. He’s also expected to see 2.69 yards before contact per carry against a league average of 1.74.';
    const html = renderToStaticMarkup(
      <SpotlightPickCard
        pick={{
          season: 2026,
          week: 5,
          player_id: 'jones',
          player_name: 'Aaron Jones',
          position: 'RB',
          team: 'MIN',
          opponent: 'NO',
          market: 'player_rush_yds',
          market_label: 'Rushing yards',
          side: 'over',
          line: 72.5,
          net: 1,
          n_for: 5,
          n_against: 0,
          board_rank: 1,
          tells: [],
          narrative,
          result: null,
          actual_value: null,
        }}
      />,
    );
    expect(html).toContain(narrative);
    expect(html).toContain('55% of snaps');
    expect(html).toContain('2.69 yards before contact');
  });
});
