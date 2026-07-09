package com.wagerproof.core.models

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.math.max

object HistoricalAnalysisFilterBuilder {
    data class SpreadConfig(val max: Double, val minKey: String, val maxKey: String, val absMinKey: String, val absMaxKey: String)
    data class TotalConfig(val min: Double, val max: Double, val minKey: String, val maxKey: String, val label: String)

    private val nflSpread = mapOf(
        "fg_spread" to SpreadConfig(20.0, "spread_min", "spread_max", "abs_spread_min", "abs_spread_max"),
        "h1_spread" to SpreadConfig(14.0, "h1_spread_min", "h1_spread_max", "h1_abs_spread_min", "h1_abs_spread_max"),
    )
    private val cfbSpread = mapOf(
        "fg_spread" to SpreadConfig(28.0, "spread_min", "spread_max", "abs_spread_min", "abs_spread_max"),
        "h1_spread" to SpreadConfig(18.0, "h1_spread_min", "h1_spread_max", "h1_abs_spread_min", "h1_abs_spread_max"),
    )
    private val nflTotal = mapOf(
        "fg_total" to TotalConfig(30.0, 60.0, "total_min", "total_max", "Game total"),
        "h1_total" to TotalConfig(15.0, 35.0, "h1_total_min", "h1_total_max", "1H total"),
        "team_total" to TotalConfig(10.0, 40.0, "tt_min", "tt_max", "Team total line"),
    )
    private val cfbTotal = mapOf(
        "fg_total" to TotalConfig(30.0, 80.0, "total_min", "total_max", "Game total"),
        "h1_total" to TotalConfig(15.0, 45.0, "h1_total_min", "h1_total_max", "1H total"),
        "team_total" to TotalConfig(10.0, 55.0, "tt_min", "tt_max", "Team total line"),
    )

    fun spreadConfig(sport: HistoricalAnalysisSport, betType: String): SpreadConfig? =
        (if (sport == HistoricalAnalysisSport.NFL) nflSpread else cfbSpread)[betType]

    fun totalConfig(sport: HistoricalAnalysisSport, betType: String): TotalConfig? =
        (if (sport == HistoricalAnalysisSport.NFL) nflTotal else cfbTotal)[betType]

    fun seasonFloor(betType: String, sport: HistoricalAnalysisSport): Int =
        if (betType in HistoricalAnalysisBetType.limitedHistory) 2023 else sport.defaultSeasonFloor

    fun buildRPCFilters(
        sport: HistoricalAnalysisSport,
        snapshot: HistoricalAnalysisUISnapshot,
        conferenceTeamMap: Map<String, List<String>> = emptyMap(),
    ): JsonObject = buildJsonObject {
        val betType = snapshot.betType
        val floor = seasonFloor(betType, sport)
        if (snapshot.seasonMin > floor) put("season_min", snapshot.seasonMin)
        if (snapshot.seasonMax < HistoricalAnalysisSport.SEASON_MAX) put("season_max", snapshot.seasonMax)

        if (sport == HistoricalAnalysisSport.NFL) {
            when (snapshot.seasonType) {
                "regular" -> {
                    put("season_type", "regular")
                    if (snapshot.weekMin > 1) put("week_min", snapshot.weekMin)
                    if (snapshot.weekMax < 18) put("week_max", snapshot.weekMax)
                }
                "postseason" -> {
                    put("season_type", "postseason")
                    if (snapshot.playoffRound != "any") put("playoff_round", snapshot.playoffRound)
                }
            }
        } else {
            if (snapshot.gameType != "any") put("game_type", snapshot.gameType)
            if (snapshot.rankedMatchup != "any") put("ranked_matchup", snapshot.rankedMatchup)
            if (snapshot.gameType == "regular") {
                if (snapshot.weekMin > 1) put("week_min", snapshot.weekMin)
                if (snapshot.weekMax < 16) put("week_max", snapshot.weekMax)
            }
        }

        if (snapshot.side != "any") put("side", snapshot.side)

        spreadConfig(sport, betType)?.let { cfg ->
            val lo = snapshot.spreadMin
            val hi = snapshot.spreadMax
            val nonPickemFloor = max(lo, 0.5)
            when (snapshot.spreadSide) {
                "favorite" -> {
                    put(cfg.minKey, -hi)
                    put(cfg.maxKey, -nonPickemFloor)
                }
                "underdog" -> {
                    put(cfg.minKey, nonPickemFloor)
                    put(cfg.maxKey, hi)
                }
                else -> if (lo > 0 || hi < cfg.max) {
                    put(cfg.absMinKey, lo)
                    put(cfg.absMaxKey, hi)
                }
            }
        }

        if (snapshot.favDog != "any" &&
            (betType in HistoricalAnalysisBetType.moneylineMarkets || betType == "team_total")
        ) put("fav_dog", snapshot.favDog)

        var mlA = snapshot.mlMin.trim().toDoubleOrNull()
        var mlB = snapshot.mlMax.trim().toDoubleOrNull()
        if (mlA != null && mlB != null && mlA > mlB) {
            val lower = mlB
            mlB = mlA
            mlA = lower
        }
        mlA?.let { put("ml_min", it) }
        mlB?.let { put("ml_max", it) }

        totalConfig(sport, betType)?.let { cfg ->
            if (snapshot.lineMin > cfg.min) put(cfg.minKey, snapshot.lineMin)
            if (snapshot.lineMax < cfg.max) put(cfg.maxKey, snapshot.lineMax)
        }
        snapshot.primetime?.let { put("primetime", it) }

        if (sport == HistoricalAnalysisSport.NFL) {
            snapshot.division?.let { put("division", it) }
            if (snapshot.dome != "any") put("dome", snapshot.dome == "dome")
            if (snapshot.precip != "any") put("precip", snapshot.precip)
            if (snapshot.tempMin > -10) put("temp_min", snapshot.tempMin)
            if (snapshot.tempMax < 100) put("temp_max", snapshot.tempMax)
            if (snapshot.windMax < 60) put("wind_max", snapshot.windMax)
            when (snapshot.restBye) {
                "off_bye" -> put("rest_min", 13)
                "short" -> put("rest_max", 4)
                "pre_bye" -> put("pre_bye", true)
            }
            if (snapshot.coach != "any") put("coach", snapshot.coach)
            if (snapshot.referee != "any") put("referee", snapshot.referee)
        } else {
            snapshot.conferenceGame?.let { put("conference_game", it) }
            snapshot.neutralSite?.let { put("neutral_site", it) }
            val selected = snapshot.selectedConferences.filter(String::isNotBlank)
            when {
                selected.size == 1 -> put("conference", selected.first())
                selected.size > 1 -> {
                    val teams = selected.flatMap { conferenceTeamMap[it].orEmpty() }.distinct().sorted()
                    if (teams.isNotEmpty()) put("team", JsonArray(teams.map(::JsonPrimitive)))
                }
                snapshot.conference != "any" -> put("conference", snapshot.conference)
            }
            if (snapshot.tempMin > -10) put("temp_min", snapshot.tempMin)
            if (snapshot.tempMax < 110) put("temp_max", snapshot.tempMax)
            if (snapshot.windMax < 60) put("wind_max", snapshot.windMax)
        }
    }

    fun nonDegenerateBars(bars: List<HistoricalAnalysisBar>): List<HistoricalAnalysisBar> = bars.filter { bar ->
        val total = bar.options.sumOf { it.n }
        total > 0 && bar.options.all { it.n > 0 && it.n.toDouble() / total >= 0.1 }
    }

    fun shownBars(bars: List<HistoricalAnalysisBar>, snapshot: HistoricalAnalysisUISnapshot): List<HistoricalAnalysisBar> =
        nonDegenerateBars(bars).filterNot { bar ->
            when (bar.dimension) {
                "home_away" -> snapshot.side != "any"
                "fav_dog" -> when {
                    snapshot.betType == "fg_spread" || snapshot.betType == "h1_spread" -> snapshot.spreadSide != "any"
                    snapshot.betType in HistoricalAnalysisBetType.moneylineMarkets || snapshot.betType == "team_total" -> snapshot.favDog != "any"
                    else -> false
                }
                else -> false
            }
        }
}
