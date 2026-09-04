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
 * NFL and CFB use `trainingKey` FIRST, not the model's `id`: on the slate path
 * the two are the same value, but the legacy merge sets `id` from the input
 * view's own primary key while `trainingKey` stays the nflverse / CFBD id the
 * agents actually wrote. Joining on `id` would silently return zero matches
 * whenever the feed falls back to that path.
 *
 * Both football chains then fall through the remaining published ids rather than
 * jumping straight to `id`, so a row with an empty `home_away_unique` (blank
 * training key) still resolves its consensus instead of joining on the input
 * view's private key. CFB mirrors the V3 formatter's `training_key || unique_id`
 * fallback.
 *
 * NBA/NCAAB/MLB have exactly one id (`game_id` / `game_pk`) and the V3 slate
 * builder writes it verbatim, so `id` is correct there.
 */
object GameConsensusKey {
    fun of(game: NFLPrediction): String = firstNonBlank(game.trainingKey, game.gameId, game.id)
    fun of(game: CFBPrediction): String =
        firstNonBlank(game.trainingKey, game.uniqueId, game.gameId, game.id)
    fun of(game: NBAGame): String = game.id
    fun of(game: NCAABGame): String = game.id
    fun of(game: MLBGame): String = game.id

    private fun firstNonBlank(vararg candidates: String?): String =
        candidates.firstOrNull { !it.isNullOrBlank() } ?: ""
}
