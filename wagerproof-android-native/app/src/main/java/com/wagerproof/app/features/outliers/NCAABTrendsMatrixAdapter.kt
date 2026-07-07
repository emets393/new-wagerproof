package com.wagerproof.app.features.outliers

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import com.wagerproof.app.features.gamecards.FallbackTeamColor
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.core.models.NCAABGameTrendsData
import com.wagerproof.core.models.NCAABSituationalTrendRow
import com.wagerproof.core.models.formatNCAABSituation
import com.wagerproof.core.models.parseNCAABRecord

/**
 * Maps an `NCAABGameTrendsData` bundle into the shared `TrendsMatrixSection`
 * rows. RN renders the same 5 situational pairs as NBA for college (the NCAAB
 * sheet literally imports the NBA section component), so the section configs
 * mirror `NBATrendsMatrixAdapter`. Port of iOS NCAABTrendsMatrixAdapter.swift.
 */
object NCAABTrendsMatrixAdapter {
    /** Same blue as the NBA trends accent — RN shares the component. */
    val accent: Color = NBATrendsMatrixAdapter.accent

    private class Config(
        val id: String,
        val title: String,
        val icon: String,
        val tip: String,
        val label: (NCAABSituationalTrendRow) -> String?,
        val atsRecord: (NCAABSituationalTrendRow) -> String?,
        val atsPct: (NCAABSituationalTrendRow) -> Double?,
        val ouRecord: (NCAABSituationalTrendRow) -> String?,
        val ouOver: (NCAABSituationalTrendRow) -> Double?,
        val ouUnder: (NCAABSituationalTrendRow) -> Double?,
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

    fun sections(game: NCAABGameTrendsData): List<TrendsMatrixSection> =
        configs.map { config ->
            val awayATSRecord = NBATrendsMatrixAdapter.normalizeRecord(config.atsRecord(game.awayTeam))
            val homeATSRecord = NBATrendsMatrixAdapter.normalizeRecord(config.atsRecord(game.homeTeam))
            val awayATSPct = config.atsPct(game.awayTeam)
            val homeATSPct = config.atsPct(game.homeTeam)
            val awayOURecord = NBATrendsMatrixAdapter.normalizeRecord(config.ouRecord(game.awayTeam))
            val homeOURecord = NBATrendsMatrixAdapter.normalizeRecord(config.ouRecord(game.homeTeam))
            val awayOver = config.ouOver(game.awayTeam)
            val homeOver = config.ouOver(game.homeTeam)
            val awayUnder = config.ouUnder(game.awayTeam)
            val homeUnder = config.ouUnder(game.homeTeam)

            TrendsMatrixSection(
                id = config.id,
                title = config.title,
                systemImage = config.icon,
                tooltip = config.tip,
                awayLabel = formatNCAABSituation(config.label(game.awayTeam)),
                homeLabel = formatNCAABSituation(config.label(game.homeTeam)),
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
                // Same gates as NBA — RN shares one consensus implementation.
                badges = NBATrendsMatrixAdapter.badges(
                    awayATSPct, homeATSPct,
                    parseNCAABRecord(awayATSRecord).total, parseNCAABRecord(homeATSRecord).total,
                    awayOver, homeOver, awayUnder, homeUnder,
                    parseNCAABRecord(awayOURecord).total, parseNCAABRecord(homeOURecord).total,
                    game.awayTeam.teamAbbr, game.homeTeam.teamAbbr,
                ),
                hasData = awayATSRecord != "-" || homeATSRecord != "-",
            )
        }

    /**
     * Per-side team disc — ESPN logo from ncaab_team_mapping (resolved by the
     * store) with initials/hashed-color fallback via [FallbackTeamColor].
     */
    fun avatarProvider(game: NCAABGameTrendsData): @Composable (TrendsTeamSide, Dp) -> Unit = { side, size ->
        val row = if (side == TrendsTeamSide.away) game.awayTeam else game.homeTeam
        OutlierGlassTeamAvatar(
            logoUrl = if (side == TrendsTeamSide.away) game.awayTeamLogo else game.homeTeamLogo,
            initials = row.teamAbbr,
            primary = FallbackTeamColor.colorPair(row.teamName).primary,
            size = size,
        )
    }

    /** Per-team stripe (RN A.7: away pair → home pair) — hashed stable colors. */
    fun stripeColors(game: NCAABGameTrendsData): List<Color> {
        val aw = FallbackTeamColor.colorPair(game.awayTeam.teamName)
        val hm = FallbackTeamColor.colorPair(game.homeTeam.teamName)
        return listOf(aw.primary, aw.secondary, hm.primary, hm.secondary)
    }

    fun timeDisplay(game: NCAABGameTrendsData): String {
        val raw = game.tipoffTime
        if (raw.isNullOrEmpty()) return "TBD"
        return GameCardFormatting.convertTimeToEST(raw)
    }
}
