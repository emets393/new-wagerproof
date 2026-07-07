package com.wagerproof.core.models

// NFL trends records — client-decoded from `nfl_team_trends` etc. (the
// repository parses the JSONB columns itself), so these are plain data
// classes, mirroring the non-Codable Swift structs. The split primitives
// (NFLTrendSplitCell / NFLTrendH2HCell) and the NFLTrendSplits /
// NFLTrendMarketCoverage typealiases live in OutliersTrends.kt.

data class NFLTrendsSlateBundle(
    val games: List<OutliersTrendsGame>,
    val season: Int,
    val throughWeek: Int,
    val teams: List<NFLTeamTrendRecord>,
    val coaches: List<NFLCoachTrendRecord>,
    val referees: List<NFLRefereeTrendRecord>,
    val players: List<NFLPlayerPropTrendRecord>,
)

data class NFLTeamTrendRecord(
    val teamAbbr: String,
    val teamName: String?,
    val season: Int,
    val throughWeek: Int,
    val splits: NFLTrendSplits,
    val matchups: Map<String, NFLTrendMatchupRecord>,
) {
    val id: String get() = teamAbbr
}

data class NFLCoachTrendRecord(
    val coach: String,
    val currentTeam: String?,
    val careerGames: Int?,
    val lastSeason: Int?,
    val throughSeason: Int,
    val throughWeek: Int,
    val splits: NFLTrendSplits,
    val matchups: Map<String, NFLTrendMatchupRecord>,
    val marketCoverage: NFLTrendMarketCoverage?,
) {
    val id: String get() = coach
}

data class NFLRefereeTrendRecord(
    val referee: String,
    val careerGames: Int?,
    val throughSeason: Int,
    val throughWeek: Int,
    val splits: NFLTrendSplits,
    val marketCoverage: NFLTrendMarketCoverage?,
) {
    val id: String get() = referee
}

data class NFLPlayerPropTrendRecord(
    val playerId: String,
    val playerName: String?,
    val position: String?,
    val currentTeam: String?,
    val markets: List<String>,
    val coverage: String?,
    val throughSeason: Int,
    val throughWeek: Int,
    val splits: NFLTrendSplits,
    val matchups: Map<String, NFLTrendMatchupRecord> = emptyMap(),
) {
    val id: String get() = playerId
}

/** One head-to-head opponent block: total meetings + per-market H2H cells. */
data class NFLTrendMatchupRecord(
    val meetings: Int?,
    val markets: Map<String, NFLTrendH2HCell>,
)
