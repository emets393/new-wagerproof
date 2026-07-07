package com.wagerproof.app.features.outliers

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.wagerproof.app.features.props.PlayerPropFeed
import com.wagerproof.app.features.props.PlayerPropFeedItem
import com.wagerproof.app.features.props.PropsFormatting
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.models.MLBF5Game
import com.wagerproof.core.models.MLBF5Insight
import com.wagerproof.core.models.MLBGameTrends
import com.wagerproof.core.models.MLBPropMatchup
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.models.MLBTrendsInsight
import com.wagerproof.core.stores.MLBF5SplitsStore
import kotlin.math.abs

/**
 * Ranks each live source into its own primitive section for the Outliers hub.
 * Unlike [OutlierAggregator] (which merges every source into one per-game tile),
 * this keeps sources separate so the hub can browse by insight type. Port of iOS
 * OutlierSections.swift.
 */
object OutlierSections {
    /** The three primitive rails, used as nav values for each rail's "See all". */
    enum class Kind(val title: String, val icon: String, private val accentHex: Long) {
        trends("Betting Trends", "chart.line.uptrend.xyaxis", 0x0EA5E9L),
        f5("First 5 Innings", "baseball.diamond.bases", 0xF97316L),
        props("Player Props", "figure.baseball", 0x22C55EL);

        val accent: Color get() = hexColor(accentHex)
    }

    /**
     * Games with at least one fired situational signal, strongest first (signal
     * count, then combined consensus score).
     */
    fun trends(games: List<MLBGameTrends>): List<MLBGameTrends> =
        games
            .mapNotNull { game ->
                val summary = MLBTrendsInsight.summary(game)
                if (summary.signals.isEmpty()) return@mapNotNull null
                Triple(game, summary.signals.size, game.ouConsensusScore * 0.25 + game.mlDominanceScore)
            }
            .sortedWith(compareByDescending<Triple<MLBGameTrends, Int, Double>> { it.second }.thenByDescending { it.third })
            .map { it.first }

    /**
     * Games whose first-five split clears the showable floor and produces an edge
     * summary, ranked by the peak F5 run/line divergence.
     */
    fun f5(games: List<MLBF5Game>, store: MLBF5SplitsStore): List<MLBF5Game> =
        games
            .mapNotNull { game ->
                val matchup = store.matchup(game.gamePk) ?: return@mapNotNull null
                if (MLBF5Insight.summary(matchup) == null) return@mapNotNull null
                val away = store.split(game, "away")
                val home = store.split(game, "home")
                val peak = listOfNotNull(away?.f5LineEdge, home?.f5LineEdge, away?.rsDiffVsSeason, home?.rsDiffVsSeason)
                    .map { abs(it) }.maxOrNull() ?: 0.0
                game to peak
            }
            .sortedByDescending { it.second }
            .map { it.first }

    /**
     * Standout L10 prop streaks across the slate: a real sample (≥5 games)
     * leaning hard either way (≥70% over, or ≤30%), strongest lean first.
     */
    fun props(matchups: List<MLBPropMatchup>): List<PlayerPropFeedItem> =
        PlayerPropFeed.items(matchups)
            .filter { item ->
                val l10 = item.headline.computed.l10
                val pct = l10.pct
                l10.games >= 5 && pct != null && (pct >= 70 || pct <= 30)
            }
            .sortedByDescending { abs((it.headline.computed.l10.pct ?: 50) - 50) }
}

/**
 * Single source of truth for the trends/F5 rail cards so the rail and the "See
 * all" list render identically. Swift returns `OutlierInsightCard` views; here
 * the builders are composables that emit the card directly.
 */
object OutlierCardBuilder {
    @Composable
    fun trends(game: MLBGameTrends, stretches: Boolean = false, onTap: () -> Unit) {
        val summary = MLBTrendsInsight.summary(game)
        OutlierInsightCard(
            awayAbbr = abbr(game.awayTeam.teamName),
            homeAbbr = abbr(game.homeTeam.teamName),
            awayLogoURL = MLBTeams.info(game.awayTeam.teamName)?.logoUrl,
            homeLogoURL = MLBTeams.info(game.homeTeam.teamName)?.logoUrl,
            awayColor = color(game.awayTeam.teamName),
            homeColor = color(game.homeTeam.teamName),
            badge = summary.badge,
            verdict = summary.verdicts.firstOrNull()?.text ?: "Situational angles",
            timeLabel = PropsFormatting.gameTime(game.gameTimeEt),
            stretches = stretches,
            onTap = onTap,
        )
    }

    @Composable
    fun f5(game: MLBF5Game, store: MLBF5SplitsStore?, stretches: Boolean = false, onTap: () -> Unit) {
        val summary = store?.matchup(game.gamePk)?.let { MLBF5Insight.summary(it) }
        OutlierInsightCard(
            awayAbbr = game.awayAbbr,
            homeAbbr = game.homeAbbr,
            awayLogoURL = MLBTeams.info(game.awayTeamName)?.logoUrl,
            homeLogoURL = MLBTeams.info(game.homeTeamName)?.logoUrl,
            awayColor = color(game.awayTeamName),
            homeColor = color(game.homeTeamName),
            badge = summary?.badge,
            verdict = summary?.verdicts?.firstOrNull()?.text ?: "First-five splits",
            timeLabel = PropsFormatting.gameTime(game.gameTimeEt),
            stretches = stretches,
            onTap = onTap,
        )
    }

    private fun abbr(name: String): String = MLBTeams.info(name)?.team ?: name.take(3).uppercase()

    private fun color(name: String): Color = hexColor(MLBTeams.colors(name).primary)
}
