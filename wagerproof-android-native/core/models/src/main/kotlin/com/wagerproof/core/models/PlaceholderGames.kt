package com.wagerproof.core.models

import kotlinx.serialization.Serializable

/**
 * Slim placeholder NBA/MLB game summaries from the incremental iOS port.
 * Mostly superseded by the full NBAGame/MLBGame models — kept so the
 * 46-file parity checklist stays complete. camelCase wire keys (no renames).
 */
@Serializable
data class NBAGameSummary(
    val id: String,
    val awayTeam: String,
    val homeTeam: String,
    val awayAbbr: String? = null,
    val homeAbbr: String? = null,
    val gameDate: String? = null,
    val gameTime: String? = null,
)

@Serializable
data class MLBGameSummary(
    val id: String,
    val awayTeamName: String? = null,
    val homeTeamName: String? = null,
    val awayAbbr: String? = null,
    val homeAbbr: String? = null,
    val officialDate: String? = null,
    val gameTimeEt: String? = null,
    val isPostponed: Boolean? = null,
)
