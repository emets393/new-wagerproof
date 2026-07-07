package com.wagerproof.app.features.outliers

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import com.wagerproof.app.features.props.PropsFormatting
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.models.MLBGameTrends
import com.wagerproof.core.models.MLBSituationalTrendRow
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.models.formatMLBSituation
import kotlin.math.abs

/**
 * Maps an `MLBGameTrends` bundle into the shared `TrendsMatrixSection` rows. MLB
 * renders all 7 situational pairs with WIN% + OVER% per team (the
 * `mlb_situational_trends_today` view is percent-only — no records, no sample
 * counts). Port of iOS MLBTrendsMatrixAdapter.swift.
 */
object MLBTrendsMatrixAdapter {
    /** RN MLB trends header icon color (`#16a34a`). */
    val accent: Color = hexColor(0x16A34AL)

    private class Config(
        val id: String,
        val title: String,
        val icon: String,
        val tip: String,
        val label: (MLBSituationalTrendRow) -> String?,
        val win: (MLBSituationalTrendRow) -> Double?,
        val over: (MLBSituationalTrendRow) -> Double?,
    )

    private val configs = listOf(
        Config(
            "lastGame", "Last Game Situation", "clock",
            "How each team performs after a win vs. after a loss. Look for momentum or bounce-back patterns.",
            { it.lastGameSituation }, { it.winPctLastGame }, { it.overPctLastGame },
        ),
        Config(
            "homeAway", "Home / Away", "house",
            "Win rate and over rate when playing at home vs. on the road. Home-field advantage varies by park.",
            { it.homeAwaySituation }, { it.winPctHomeAway }, { it.overPctHomeAway },
        ),
        Config(
            "favDog", "Favorite / Underdog", "rosette",
            "Performance when favored vs. as underdog. Big win% gaps between the two teams suggest an ML edge.",
            { it.favDogSituation }, { it.winPctFavDog }, { it.overPctFavDog },
        ),
        Config(
            "restBucket", "Rest Bucket", "calendar.badge.clock",
            "Performance based on days of rest (1, 2-3, or 4+). Pitching rotations are heavily affected by rest.",
            { it.restBucket }, { it.winPctRestBucket }, { it.overPctRestBucket },
        ),
        Config(
            "restComp", "Rest Comparison", "scale.3d",
            "Rest advantage vs. opponent. Teams with more rest may have a pitching edge.",
            { it.restComp }, { it.winPctRestComp }, { it.overPctRestComp },
        ),
        Config(
            "league", "League Situation", "shield",
            "Performance in league (AL/NL) vs. non-league games. Interleague games can shift dynamics.",
            { it.leagueSituation }, { it.winPctLeague }, { it.overPctLeague },
        ),
        Config(
            "division", "Division Situation", "trophy",
            "Performance in division vs. non-division games. Divisional familiarity can impact results.",
            { it.divisionSituation }, { it.winPctDivision }, { it.overPctDivision },
        ),
    )

    fun sections(game: MLBGameTrends): List<TrendsMatrixSection> {
        val awayAbbr = abbr(game.awayTeam)
        val homeAbbr = abbr(game.homeTeam)

        return configs.map { config ->
            val awayWin = normalizePct(config.win(game.awayTeam))
            val homeWin = normalizePct(config.win(game.homeTeam))
            val awayOver = normalizePct(config.over(game.awayTeam))
            val homeOver = normalizePct(config.over(game.homeTeam))
            TrendsMatrixSection(
                id = config.id,
                title = config.title,
                systemImage = config.icon,
                tooltip = config.tip,
                awayLabel = formatMLBSituation(config.label(game.awayTeam)),
                homeLabel = formatMLBSituation(config.label(game.homeTeam)),
                rows = listOf(
                    TrendsMatrixMetricRow("${config.id}-win", "WIN%", TrendsMatrixCell.Pct(awayWin), TrendsMatrixCell.Pct(homeWin)),
                    TrendsMatrixMetricRow("${config.id}-over", "OVER%", TrendsMatrixCell.Pct(awayOver), TrendsMatrixCell.Pct(homeOver)),
                ),
                badges = badges(awayWin, homeWin, awayOver, homeOver, awayAbbr, homeAbbr),
                hasData = awayWin != null || homeWin != null || awayOver != null || homeOver != null,
            )
        }
    }

    /**
     * Per-side team disc (iOS `MLBTeamLogo`). Uses [OutlierGlassTeamAvatar] since
     * the true `teamGlassDisc`/`MLBTeamLogo` aren't ported.
     */
    fun avatarProvider(game: MLBGameTrends): @Composable (TrendsTeamSide, Dp) -> Unit = { side, size ->
        val row = if (side == TrendsTeamSide.away) game.awayTeam else game.homeTeam
        val display = MLBTeams.displayById(row.teamId)
        OutlierGlassTeamAvatar(
            logoUrl = display?.logoUrl,
            initials = display?.abbrev ?: "MLB",
            primary = hexColor(MLBTeams.colors(row.teamName).primary),
            size = size,
        )
    }

    fun stripeColors(game: MLBGameTrends): List<Color> {
        val aw = MLBTeams.colors(game.awayTeam.teamName)
        val hm = MLBTeams.colors(game.homeTeam.teamName)
        return listOf(hexColor(aw.primary), hexColor(aw.secondary), hexColor(hm.primary), hexColor(hm.secondary))
    }

    fun timeDisplay(game: MLBGameTrends): String = PropsFormatting.gameTime(game.gameTimeEt)

    fun abbr(row: MLBSituationalTrendRow): String =
        MLBTeams.displayById(row.teamId)?.abbrev ?: row.teamName.take(3).uppercase()

    /** RN `toTrendPct` — fractional values (0..1) scale to 0..100. */
    private fun normalizePct(value: Double?): Double? {
        if (value == null) return null
        return if (value > 0 && value < 1) value * 100 else value
    }

    /**
     * Per-situation consensus chips: ML dominance when |awayWin−homeWin| ≥ 10,
     * O/U consensus when both sides >55 (Over) or <45 (Under). MLB has no
     * sample-size gate — no records exist.
     */
    private fun badges(
        awayWin: Double?, homeWin: Double?,
        awayOver: Double?, homeOver: Double?,
        awayAbbr: String, homeAbbr: String,
    ): List<TrendsConsensusBadge> {
        val out = mutableListOf<TrendsConsensusBadge>()
        if (awayWin != null && homeWin != null && abs(awayWin - homeWin) >= 10) {
            out += TrendsConsensusBadge(
                text = "ML ${if (awayWin > homeWin) awayAbbr else homeAbbr}",
                systemImage = "bolt.fill",
                colorHex = 0x22C55EL,
            )
        }
        if (awayOver != null && homeOver != null) {
            if (awayOver > 55 && homeOver > 55) {
                out += TrendsConsensusBadge("Over lean", "arrow.up", 0x22C55EL)
            } else if (awayOver < 45 && homeOver < 45) {
                out += TrendsConsensusBadge("Under lean", "arrow.down", 0x3B82F6L)
            }
        }
        return out
    }
}
