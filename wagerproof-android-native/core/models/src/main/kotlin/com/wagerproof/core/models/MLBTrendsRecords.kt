package com.wagerproof.core.models

/**
 * MLB team-trends slate bundle. Port of iOS `MLBTrendsRecords.swift` —
 * client-only (assembled by the trends store, never decoded directly).
 * Reuses the NFL trend-split primitives: [NFLTrendSplits] (typealias in
 * OutliersTrends.kt) and [NFLTrendMatchupRecord] (NFLTrendsRecords.kt).
 */
data class MLBTrendsSlateBundle(
    val games: List<OutliersTrendsGame>,
    val season: Int,
    val throughDate: String?,
    val teams: List<MLBTeamTrendRecord>,
)

data class MLBTeamTrendRecord(
    val teamAbbr: String,
    val teamName: String?,
    val season: Int,
    val throughDate: String?,
    val splits: NFLTrendSplits,
    val matchups: Map<String, NFLTrendMatchupRecord>,
) {
    val id: String get() = teamAbbr
}
