package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

enum class HistoricalAnalysisSport(val raw: String) {
    NFL("nfl"), CFB("cfb");

    val title: String get() = if (this == NFL) "NFL Historical Analysis" else "CFB Historical Analysis"
    val shortTitle: String get() = raw.uppercase()
    val analysisRPC: String get() = "${raw}_analysis"
    val upcomingRPC: String get() = "${raw}_analysis_upcoming"
    val savedFiltersTable: String get() = "${raw}_analysis_saved_filters"
    val defaultSeasonFloor: Int get() = if (this == NFL) 2018 else 2016

    companion object { const val SEASON_MAX = 2025 }
}

enum class HistoricalAnalysisBetType(val raw: String, val label: String, val group: String) {
    FG_SPREAD("fg_spread", "Spread", "Full Game"),
    FG_ML("fg_ml", "Moneyline", "Full Game"),
    FG_TOTAL("fg_total", "Total", "Full Game"),
    TEAM_TOTAL("team_total", "Team Total", "Full Game"),
    H1_SPREAD("h1_spread", "1H Spread", "First Half"),
    H1_ML("h1_ml", "1H ML", "First Half"),
    H1_TOTAL("h1_total", "1H Total", "First Half");

    companion object {
        val limitedHistory = setOf("h1_spread", "h1_ml", "h1_total", "team_total")
        val moneylineMarkets = setOf("fg_ml", "h1_ml")
        fun from(raw: String): HistoricalAnalysisBetType = entries.firstOrNull { it.raw == raw } ?: FG_SPREAD
    }
}

@Serializable
data class HistoricalAnalysisCoverage(
    @SerialName("season_min") val seasonMin: Int,
    @SerialName("season_max") val seasonMax: Int,
    @SerialName("n_bets") val nBets: Int,
    @SerialName("n_games") val nGames: Int,
)

@Serializable
data class HistoricalAnalysisOverall(
    val n: Int,
    val wins: Int,
    @SerialName("hit_pct") val hitPct: Double,
    val roi: Double? = null,
)

@Serializable
data class HistoricalAnalysisBarOption(
    val side: String,
    val n: Int,
    val wins: Int,
    @SerialName("hit_pct") val hitPct: Double,
    val roi: Double? = null,
)

@Serializable
data class HistoricalAnalysisBar(
    val dimension: String,
    val options: List<HistoricalAnalysisBarOption>,
)

@Serializable
data class HistoricalAnalysisBreakdownRow(
    val team: String? = null,
    val coach: String? = null,
    val referee: String? = null,
    val conference: String? = null,
    val n: Int,
    @SerialName("hit_pct") val hitPct: Double,
    val roi: Double? = null,
) {
    val id: String get() = team ?: coach ?: referee ?: conference ?: "$n-$hitPct"
    val label: String get() = team ?: coach ?: referee ?: conference ?: "—"
}

@Serializable
data class HistoricalAnalysisResponse(
    @SerialName("bet_type") val betType: String,
    val coverage: HistoricalAnalysisCoverage,
    @SerialName("baseline_pct") val baselinePct: Double,
    val overall: HistoricalAnalysisOverall,
    val bars: List<HistoricalAnalysisBar> = emptyList(),
    @SerialName("by_team") val byTeam: List<HistoricalAnalysisBreakdownRow> = emptyList(),
    @SerialName("by_coach") val byCoach: List<HistoricalAnalysisBreakdownRow>? = null,
    @SerialName("by_referee") val byReferee: List<HistoricalAnalysisBreakdownRow>? = null,
    @SerialName("by_conference") val byConference: List<HistoricalAnalysisBreakdownRow>? = null,
)

@Serializable
data class HistoricalAnalysisUpcomingGame(
    val team: String,
    val opponent: String,
    @SerialName("is_home") val isHome: Boolean,
    @SerialName("is_favorite") val isFavorite: Boolean,
    val matchup: String,
    val kickoff: String,
    @SerialName("team_spread") val teamSpread: Double? = null,
    val total: Double? = null,
    @SerialName("tt_line") val ttLine: Double? = null,
    @SerialName("h1_spread") val h1Spread: Double? = null,
    @SerialName("h1_total") val h1Total: Double? = null,
    val referee: String? = null,
) {
    val id: String get() = "$team-$kickoff"
}

@Serializable
data class HistoricalAnalysisSavedFilter(
    val id: String,
    @SerialName("user_id") val userId: String,
    val name: String,
    @SerialName("bet_type") val betType: String,
    val filters: HistoricalAnalysisUISnapshot,
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class HistoricalAnalysisUISnapshot(
    var betType: String,
    var seasonMin: Int,
    var seasonMax: Int,
    var weekMin: Int,
    var weekMax: Int,
    var side: String,
    var favDog: String,
    var spreadSide: String,
    var spreadMin: Double,
    var spreadMax: Double,
    var lineMin: Double,
    var lineMax: Double,
    var mlMin: String,
    var mlMax: String,
    var primetime: Boolean?,
    var tempMin: Int,
    var tempMax: Int,
    var windMax: Int,
    var seasonType: String,
    var playoffRound: String,
    var division: Boolean?,
    var dome: String,
    var precip: String,
    var restBye: String,
    var coach: String,
    var referee: String,
    var gameType: String,
    var rankedMatchup: String,
    var conferenceGame: Boolean?,
    var neutralSite: Boolean?,
    var conference: String,
    var selectedConferences: List<String>,
) {
    companion object {
        fun defaults(sport: HistoricalAnalysisSport) = HistoricalAnalysisUISnapshot(
            betType = HistoricalAnalysisBetType.FG_SPREAD.raw,
            seasonMin = sport.defaultSeasonFloor,
            seasonMax = HistoricalAnalysisSport.SEASON_MAX,
            weekMin = 1,
            weekMax = if (sport == HistoricalAnalysisSport.NFL) 18 else 16,
            side = "any",
            favDog = "any",
            spreadSide = "any",
            spreadMin = 0.0,
            spreadMax = if (sport == HistoricalAnalysisSport.NFL) 20.0 else 28.0,
            lineMin = 30.0,
            lineMax = if (sport == HistoricalAnalysisSport.NFL) 60.0 else 80.0,
            mlMin = "",
            mlMax = "",
            primetime = null,
            tempMin = -10,
            tempMax = if (sport == HistoricalAnalysisSport.NFL) 100 else 110,
            windMax = 60,
            seasonType = "any",
            playoffRound = "any",
            division = null,
            dome = "any",
            precip = "any",
            restBye = "any",
            coach = "any",
            referee = "any",
            gameType = "any",
            rankedMatchup = "any",
            conferenceGame = null,
            neutralSite = null,
            conference = "any",
            selectedConferences = emptyList(),
        )
    }
}
