package com.wagerproof.app.features.outliers

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.app.features.gamecards.NBATeams
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.models.NBAGameTrendsData
import com.wagerproof.core.models.NBASituationalTrendRow
import com.wagerproof.core.models.SportLeague
import com.wagerproof.core.models.formatNBASituation
import com.wagerproof.core.models.parseNBARecord
import kotlin.math.abs
import kotlin.math.min

/**
 * Maps an `NBAGameTrendsData` bundle into the shared `TrendsMatrixSection` rows.
 * NBA renders the 5 RN situational pairs (the `_today` view has no home/away
 * columns) with ATS record + cover% and O/U record + over/under split per team.
 * Port of iOS NBATrendsMatrixAdapter.swift.
 */
object NBATrendsMatrixAdapter {
    /** RN NBA trends header icon color (`#3b82f6`). */
    val accent: Color = hexColor(0x3B82F6L)

    private class Config(
        val id: String,
        val title: String,
        val icon: String,
        val tip: String,
        val label: (NBASituationalTrendRow) -> String?,
        val atsRecord: (NBASituationalTrendRow) -> String?,
        val atsPct: (NBASituationalTrendRow) -> Double?,
        val ouRecord: (NBASituationalTrendRow) -> String?,
        val ouOver: (NBASituationalTrendRow) -> Double?,
        val ouUnder: (NBASituationalTrendRow) -> Double?,
    )

    private val configs = listOf(
        Config(
            "lastGame", "Last Game Situation", "clock",
            "How each team performs ATS and O/U after a win vs. after a loss. Look for momentum patterns.",
            { it.lastGameSituation }, { it.atsLastGameRecord }, { it.atsLastGameCoverPct },
            { it.ouLastGameRecord }, { it.ouLastGameOverPct }, { it.ouLastGameUnderPct },
        ),
        Config(
            "favDog", "Favorite/Underdog Situation", "rosette",
            "Performance when favored vs. as underdog. Strong ATS contrast (≥15%) suggests an edge.",
            { it.favDogSituation }, { it.atsFavDogRecord }, { it.atsFavDogCoverPct },
            { it.ouFavDogRecord }, { it.ouFavDogOverPct }, { it.ouFavDogUnderPct },
        ),
        Config(
            "sideFavDog", "Side Spread Situation", "house",
            "Combines home/away with favorite/underdog role. Home favorites and away underdogs often have distinct patterns.",
            { it.sideSpreadSituation }, { it.atsSideFavDogRecord }, { it.atsSideFavDogCoverPct },
            { it.ouSideFavDogRecord }, { it.ouSideFavDogOverPct }, { it.ouSideFavDogUnderPct },
        ),
        Config(
            "restBucket", "Rest Bucket", "calendar.badge.clock",
            "Performance based on days of rest (1, 2-3, or 4+). Fatigue or rust can impact both ATS and totals.",
            { it.restBucket }, { it.atsRestBucketRecord }, { it.atsRestBucketCoverPct },
            { it.ouRestBucketRecord }, { it.ouRestBucketOverPct }, { it.ouRestBucketUnderPct },
        ),
        Config(
            "restComp", "Rest Comparison", "scale.3d",
            "Rest advantage vs. opponent. Teams with more rest often cover, but totals can swing either way.",
            { it.restComp }, { it.atsRestCompRecord }, { it.atsRestCompCoverPct },
            { it.ouRestCompRecord }, { it.ouRestCompOverPct }, { it.ouRestCompUnderPct },
        ),
    )

    fun sections(game: NBAGameTrendsData): List<TrendsMatrixSection> =
        configs.map { config ->
            // RN coalesces empty strings too (`record || '-'`), not just null.
            val awayATSRecord = normalizeRecord(config.atsRecord(game.awayTeam))
            val homeATSRecord = normalizeRecord(config.atsRecord(game.homeTeam))
            val awayATSPct = config.atsPct(game.awayTeam)
            val homeATSPct = config.atsPct(game.homeTeam)
            val awayOURecord = normalizeRecord(config.ouRecord(game.awayTeam))
            val homeOURecord = normalizeRecord(config.ouRecord(game.homeTeam))
            val awayOver = config.ouOver(game.awayTeam)
            val homeOver = config.ouOver(game.homeTeam)
            val awayUnder = config.ouUnder(game.awayTeam)
            val homeUnder = config.ouUnder(game.homeTeam)

            TrendsMatrixSection(
                id = config.id,
                title = config.title,
                systemImage = config.icon,
                tooltip = config.tip,
                awayLabel = formatNBASituation(config.label(game.awayTeam)),
                homeLabel = formatNBASituation(config.label(game.homeTeam)),
                rows = listOf(
                    TrendsMatrixMetricRow(
                        "${config.id}-ats", "ATS",
                        TrendsMatrixCell.RecordPct(awayATSRecord, awayATSPct),
                        TrendsMatrixCell.RecordPct(homeATSRecord, homeATSPct),
                    ),
                    TrendsMatrixMetricRow(
                        "${config.id}-ou", "O/U",
                        TrendsMatrixCell.RecordOU(awayOURecord, awayOver, awayUnder),
                        TrendsMatrixCell.RecordOU(homeOURecord, homeOver, homeUnder),
                    ),
                ),
                badges = badges(
                    awayATSPct, homeATSPct,
                    parseNBARecord(awayATSRecord).total, parseNBARecord(homeATSRecord).total,
                    awayOver, homeOver, awayUnder, homeUnder,
                    parseNBARecord(awayOURecord).total, parseNBARecord(homeOURecord).total,
                    game.awayTeam.teamAbbr, game.homeTeam.teamAbbr,
                ),
                // RN `hasData`: at least one side carries an ATS record string.
                hasData = awayATSRecord != "-" || homeATSRecord != "-",
            )
        }

    /**
     * Per-side team disc — resolves the ESPN slug by name (same table the
     * Outliers cards use), initials fallback. Uses [OutlierGlassTeamAvatar]
     * (`TrendsTeamAvatar`/`GameCardTeamAvatar` fallback not required here).
     */
    fun avatarProvider(game: NBAGameTrendsData): @Composable (TrendsTeamSide, Dp) -> Unit = { side, size ->
        val row = if (side == TrendsTeamSide.away) game.awayTeam else game.homeTeam
        OutlierGlassTeamAvatar(
            logoUrl = OutlierTeamPalette.logoURL(row.teamName, SportLeague.NBA),
            initials = row.teamAbbr,
            primary = NBATeams.colorPair(row.teamName).primary,
            size = size,
        )
    }

    /** Per-team brand stripe (RN A.7: away pair → home pair). */
    fun stripeColors(game: NBAGameTrendsData): List<Color> {
        val aw = NBATeams.colorPair(game.awayTeam.teamName)
        val hm = NBATeams.colorPair(game.homeTeam.teamName)
        return listOf(aw.primary, aw.secondary, hm.primary, hm.secondary)
    }

    fun timeDisplay(game: NBAGameTrendsData): String {
        val raw = game.tipoffTime
        if (raw.isNullOrEmpty()) return "TBD"
        return GameCardFormatting.convertTimeToEST(raw)
    }

    fun normalizeRecord(raw: String?): String = if (raw.isNullOrEmpty()) "-" else raw

    /**
     * Per-situation consensus chips, gated exactly like the RN list-sort
     * formulas: ATS needs ≥5 games on BOTH sides and a >10pt cover gap; O/U needs
     * both sides >55% the same direction with ≥5-game samples.
     */
    fun badges(
        awayATSPct: Double?, homeATSPct: Double?,
        awayATSGames: Int, homeATSGames: Int,
        awayOver: Double?, homeOver: Double?,
        awayUnder: Double?, homeUnder: Double?,
        awayOUGames: Int, homeOUGames: Int,
        awayAbbr: String, homeAbbr: String,
    ): List<TrendsConsensusBadge> {
        val out = mutableListOf<TrendsConsensusBadge>()
        if (awayATSPct != null && homeATSPct != null &&
            min(awayATSGames, homeATSGames) >= 5 && abs(awayATSPct - homeATSPct) > 10
        ) {
            out += TrendsConsensusBadge(
                text = "ATS ${if (awayATSPct > homeATSPct) awayAbbr else homeAbbr}",
                systemImage = "bolt.fill",
                colorHex = 0x22C55EL,
            )
        }
        val ouSampled = min(awayOUGames, homeOUGames) >= 5
        if (ouSampled && awayOver != null && homeOver != null && awayOver > 55 && homeOver > 55) {
            out += TrendsConsensusBadge("Over lean", "arrow.up", 0x22C55EL)
        } else if (ouSampled && awayUnder != null && homeUnder != null && awayUnder > 55 && homeUnder > 55) {
            out += TrendsConsensusBadge("Under lean", "arrow.down", 0x3B82F6L)
        }
        return out
    }
}
