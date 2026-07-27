package com.wagerproof.app.features.games

import com.wagerproof.core.models.CFBPrediction
import com.wagerproof.core.models.MLBGame
import com.wagerproof.core.models.NBAGame
import com.wagerproof.core.models.NCAABGame
import com.wagerproof.core.models.NFLPrediction

/**
 * The id a feed game joins to `avatar_picks.game_id` on. Port of iOS
 * `Features/Games/GameConsensusKey.swift`; see .claude/docs/18_agent_consensus.md.
 *
 * NFL and CFB use `trainingKey`, NOT the model's `id`: on the dry-run path the
 * two are the same value, but the legacy merge sets `id` from the input view's
 * own primary key while `trainingKey` stays the nflverse / CFBD id the agents
 * actually wrote. Joining on `id` would silently return zero matches whenever
 * the feed falls back to that path.
 *
 * NBA/NCAAB/MLB have exactly one id (`game_id` / `game_pk`) and the V3 slate
 * builder writes it verbatim, so `id` is correct there.
 */
object GameConsensusKey {
    fun of(game: NFLPrediction): String = game.trainingKey.ifBlank { game.id }
    fun of(game: CFBPrediction): String = game.trainingKey.ifBlank { game.id }
    fun of(game: NBAGame): String = game.id
    fun of(game: NCAABGame): String = game.id
    fun of(game: MLBGame): String = game.id
}
