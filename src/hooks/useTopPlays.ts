import { useMemo } from 'react';
import type { ParkHRFactors } from '@/hooks/usePark';
import type {
  MatchupGame,
  PitcherMatchupData,
  PowerStackAlert,
  TopPlayEntry,
  TopPlays,
} from '@/types/mlb-matchups';
import {
  SCORE_CONSTANTS,
  battedBallForBatter,
  computeHrThreat,
  hitLeanScore,
  pitcherPerformanceScore,
  strikeoutLeanScore,
} from '@/components/mlb/pitcher-matchups/topPlaysScoring';

function topN(entries: TopPlayEntry[]): TopPlayEntry[] {
  return entries
    .filter(e => e.score >= SCORE_CONSTANTS.MIN_SCORE_TO_DISPLAY)
    .sort((a, b) => b.score - a.score)
    .slice(0, SCORE_CONSTANTS.TOP_N_PER_COLUMN);
}

export function computeTopPlays(
  games: MatchupGame[],
  dataByGamePk: Map<number, PitcherMatchupData>,
  parksByAbbr: Map<string, ParkHRFactors>,
): TopPlays {
  const hr_threats: TopPlayEntry[] = [];
  const hit_leans: TopPlayEntry[] = [];
  const pitcher_plays: TopPlayEntry[] = [];
  const k_props: TopPlayEntry[] = [];
  const stackCandidates: {
    team_name: string;
    game_pk: number;
    opp_pitcher: string;
    hitters: { player_name: string; score: number }[];
  }[] = [];

  for (const game of games) {
    const data = dataByGamePk.get(game.game_pk);
    if (!data) continue;

    const park = parksByAbbr.get(game.home_abbr) ?? null;

    const awayBb = data.awayBattedBall.overall;
    const homeBb = data.homeBattedBall.overall;

    if (awayBb && homeBb) {
      const awayPitcherScore = pitcherPerformanceScore(
        awayBb,
        data.awayArsenal.A,
        data.homeLineupSplits,
        game,
      );
      if (awayPitcherScore > 0) {
        pitcher_plays.push({
          player_id: game.away_sp_id,
          player_name: game.away_sp_name,
          team_name: game.away_team_name,
          game_pk: game.game_pk,
          score: awayPitcherScore,
          context: `vs ${game.home_team_name} · ${game.home_sp_hand}HP`,
          breakdown: [{ component: 'Pitcher performance', value: awayPitcherScore }],
        });
      }

      const homePitcherScore = pitcherPerformanceScore(
        homeBb,
        data.homeArsenal.A,
        data.awayLineupSplits,
        game,
      );
      if (homePitcherScore > 0) {
        pitcher_plays.push({
          player_id: game.home_sp_id,
          player_name: game.home_sp_name,
          team_name: game.home_team_name,
          game_pk: game.game_pk,
          score: homePitcherScore,
          context: `vs ${game.away_team_name} · ${game.away_sp_hand}HP`,
          breakdown: [{ component: 'Pitcher performance', value: homePitcherScore }],
        });
      }

      const awayK = strikeoutLeanScore(
        awayBb,
        data.awayArsenal.A,
        data.homeLineupSplits,
        data.homeBatterVsPitch,
        game.away_sp_hand,
      );
      if (awayK > 0) {
        k_props.push({
          player_id: game.away_sp_id,
          player_name: game.away_sp_name,
          team_name: game.away_team_name,
          game_pk: game.game_pk,
          score: awayK,
          context: `K prop lean vs ${game.home_team_name}`,
          breakdown: [{ component: 'Strikeout lean', value: awayK }],
        });
      }

      const homeK = strikeoutLeanScore(
        homeBb,
        data.homeArsenal.A,
        data.awayLineupSplits,
        data.awayBatterVsPitch,
        game.home_sp_hand,
      );
      if (homeK > 0) {
        k_props.push({
          player_id: game.home_sp_id,
          player_name: game.home_sp_name,
          team_name: game.home_team_name,
          game_pk: game.game_pk,
          score: homeK,
          context: `K prop lean vs ${game.away_team_name}`,
          breakdown: [{ component: 'Strikeout lean', value: homeK }],
        });
      }
    }

    const awayStackHitters: { player_name: string; score: number }[] = [];
    for (const batter of data.awayLineupSplits) {
      const opp = battedBallForBatter(batter, game.home_sp_hand, data.homeBattedBall);
      if (!opp) continue;
      const hr = computeHrThreat(
        batter,
        opp,
        data.homeArsenal,
        data.awayBatterVsPitch.filter(r => r.batter_id === batter.batter_id),
        game,
        game.home_sp_hand,
        park,
        game.home_sp_name,
      );
      if (hr.score >= SCORE_CONSTANTS.POWER_STACK_MIN_HR_SCORE) {
        awayStackHitters.push({ player_name: batter.batter_name, score: hr.score });
      }
      if (hr.score > 0) {
        hr_threats.push({
          player_id: batter.batter_id,
          player_name: batter.batter_name,
          team_name: game.away_team_name,
          game_pk: game.game_pk,
          score: hr.score,
          context: `vs ${game.home_sp_name} (${game.home_sp_hand}HP)`,
          breakdown: hr.breakdown,
        });
      }
      const hit = hitLeanScore(
        batter,
        opp,
        data.homeArsenal,
        data.awayBatterVsPitch.filter(r => r.batter_id === batter.batter_id),
        game.home_sp_hand,
      );
      if (hit > 0) {
        hit_leans.push({
          player_id: batter.batter_id,
          player_name: batter.batter_name,
          team_name: game.away_team_name,
          game_pk: game.game_pk,
          score: hit,
          context: `vs ${game.home_sp_name} (${game.home_sp_hand}HP)`,
          breakdown: [{ component: 'Hit lean', value: hit }],
        });
      }
    }

    if (awayStackHitters.length >= SCORE_CONSTANTS.POWER_STACK_MIN_HITTERS) {
      stackCandidates.push({
        team_name: game.away_team_name,
        game_pk: game.game_pk,
        opp_pitcher: game.home_sp_name,
        hitters: awayStackHitters,
      });
    }

    const homeStackHitters: { player_name: string; score: number }[] = [];
    for (const batter of data.homeLineupSplits) {
      const opp = battedBallForBatter(batter, game.away_sp_hand, data.awayBattedBall);
      if (!opp) continue;
      const hr = computeHrThreat(
        batter,
        opp,
        data.awayArsenal,
        data.homeBatterVsPitch.filter(r => r.batter_id === batter.batter_id),
        game,
        game.away_sp_hand,
        park,
        game.away_sp_name,
      );
      if (hr.score >= SCORE_CONSTANTS.POWER_STACK_MIN_HR_SCORE) {
        homeStackHitters.push({ player_name: batter.batter_name, score: hr.score });
      }
      if (hr.score > 0) {
        hr_threats.push({
          player_id: batter.batter_id,
          player_name: batter.batter_name,
          team_name: game.home_team_name,
          game_pk: game.game_pk,
          score: hr.score,
          context: `vs ${game.away_sp_name} (${game.away_sp_hand}HP)`,
          breakdown: hr.breakdown,
        });
      }
      const hit = hitLeanScore(
        batter,
        opp,
        data.awayArsenal,
        data.homeBatterVsPitch.filter(r => r.batter_id === batter.batter_id),
        game.away_sp_hand,
      );
      if (hit > 0) {
        hit_leans.push({
          player_id: batter.batter_id,
          player_name: batter.batter_name,
          team_name: game.home_team_name,
          game_pk: game.game_pk,
          score: hit,
          context: `vs ${game.away_sp_name} (${game.away_sp_hand}HP)`,
          breakdown: [{ component: 'Hit lean', value: hit }],
        });
      }
    }

    if (homeStackHitters.length >= SCORE_CONSTANTS.POWER_STACK_MIN_HITTERS) {
      stackCandidates.push({
        team_name: game.home_team_name,
        game_pk: game.game_pk,
        opp_pitcher: game.away_sp_name,
        hitters: homeStackHitters,
      });
    }
  }

  const power_stacks: PowerStackAlert[] = stackCandidates
    .map(candidate => {
      const top_hitters = [...candidate.hitters]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      return {
        team_name: candidate.team_name,
        game_pk: candidate.game_pk,
        hr_count: candidate.hitters.length,
        opp_pitcher: candidate.opp_pitcher,
        top_hitters,
        stack_strength: top_hitters.reduce((sum, h) => sum + h.score, 0),
      };
    })
    .sort((a, b) => b.stack_strength - a.stack_strength)
    .slice(0, SCORE_CONSTANTS.POWER_STACK_MAX_DISPLAYED);

  return {
    hr_threats: topN(hr_threats),
    hit_leans: topN(hit_leans),
    pitcher_plays: topN(pitcher_plays),
    k_props: topN(k_props),
    power_stacks,
  };
}

export function useTopPlays(
  games: MatchupGame[],
  dataByGamePk: Map<number, PitcherMatchupData>,
  parksByAbbr: Map<string, ParkHRFactors>,
  ready: boolean,
) {
  return useMemo(() => {
    if (!ready || dataByGamePk.size === 0) {
      return {
        hr_threats: [],
        hit_leans: [],
        pitcher_plays: [],
        k_props: [],
        power_stacks: [],
      } satisfies TopPlays;
    }
    return computeTopPlays(games, dataByGamePk, parksByAbbr);
  }, [games, dataByGamePk, parksByAbbr, ready]);
}
