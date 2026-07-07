package com.wagerproof.core.models

import kotlinx.serialization.Serializable

// MARK: - Filters

/** ⚠️ Uses `ncaaf` for college football here (not `cfb`) — matches DB trend tables. */
enum class OutliersTrendsSport(val raw: String) {
    NFL("nfl"),
    NCAAF("ncaaf"),
    MLB("mlb"),
    NBA("nba"),
    NCAAB("ncaab");

    val id: String get() = raw

    val label: String
        get() = when (this) {
            NFL -> "NFL"
            NCAAF -> "NCAAF"
            MLB -> "MLB"
            NBA -> "NBA"
            NCAAB -> "NCAAB"
        }

    val hasTrendsData: Boolean get() = this == NFL || this == NCAAF || this == MLB

    val allowedSubjects: List<OutliersTrendsSubject>
        get() = when (this) {
            NFL -> listOf(
                OutliersTrendsSubject.ALL,
                OutliersTrendsSubject.TEAMS,
                OutliersTrendsSubject.COACHES,
                OutliersTrendsSubject.REFS,
                OutliersTrendsSubject.PLAYERS,
            )
            NCAAF -> listOf(
                OutliersTrendsSubject.ALL,
                OutliersTrendsSubject.TEAMS,
                OutliersTrendsSubject.COACHES,
            )
            MLB -> listOf(OutliersTrendsSubject.TEAMS)
            else -> emptyList()
        }

    val usesClientSideTrendCards: Boolean get() = this == MLB
}

enum class OutliersTrendsSubject(val raw: String) {
    ALL("all"),
    TEAMS("teams"),
    COACHES("coaches"),
    REFS("refs"),
    PLAYERS("players");

    val id: String get() = raw

    val label: String
        get() = when (this) {
            ALL -> "All"
            TEAMS -> "Teams"
            COACHES -> "Coaches"
            REFS -> "Refs"
            PLAYERS -> "Players"
        }
}

enum class OutliersTrendsGameMarket(val raw: String) {
    ALL("all"),
    SPREAD("spread"),
    MONEYLINE("moneyline"),
    TOTAL("total"),
    TEAM_TOTAL("teamTotal"),
    H1_SPREAD("h1Spread"),
    H1_TOTAL("h1Total"),
    ML("ml"),
    RL("rl"),
    OU("ou"),
    F5_ML("f5Ml"),
    F5_RL("f5Rl"),
    F5_OU("f5Ou");

    val id: String get() = raw

    val dbKey: String?
        get() = when (this) {
            ALL -> null
            SPREAD -> "spread"
            MONEYLINE -> "moneyline"
            TOTAL -> "total"
            TEAM_TOTAL -> "team_total"
            H1_SPREAD -> "h1_spread"
            H1_TOTAL -> "h1_total"
            ML -> "ml"
            RL -> "rl"
            OU -> "ou"
            F5_ML -> "f5_ml"
            F5_RL -> "f5_rl"
            F5_OU -> "f5_ou"
        }

    val label: String
        get() = when (this) {
            ALL -> "All bet types"
            SPREAD -> "Spread"
            MONEYLINE -> "Moneyline"
            TOTAL -> "Total"
            TEAM_TOTAL -> "Team Total"
            H1_SPREAD -> "1H Spread"
            H1_TOTAL -> "1H Total"
            ML -> "Moneyline"
            RL -> "Run Line"
            OU -> "Total"
            F5_ML -> "1st 5 Moneyline"
            F5_RL -> "1st 5 Run Line"
            F5_OU -> "1st 5 Total"
        }

    companion object {
        fun markets(
            sport: OutliersTrendsSport,
            subject: OutliersTrendsSubject,
        ): List<OutliersTrendsGameMarket> = when (sport) {
            OutliersTrendsSport.MLB -> listOf(ALL, ML, RL, OU, F5_ML, F5_RL, F5_OU)
            OutliersTrendsSport.NFL, OutliersTrendsSport.NCAAF -> when (subject) {
                // Refs never get team totals — the ref trend tables don't carry that market.
                OutliersTrendsSubject.REFS ->
                    listOf(ALL, SPREAD, MONEYLINE, TOTAL, H1_SPREAD, H1_TOTAL)
                else ->
                    listOf(ALL, SPREAD, MONEYLINE, TOTAL, TEAM_TOTAL, H1_SPREAD, H1_TOTAL)
            }
            else -> listOf(ALL)
        }
    }
}

enum class OutliersTrendsPropMarket(val raw: String) {
    ALL("all"),
    PASS_YARDS("passYards"),
    PASS_TDS("passTDs"),
    PASS_ATTEMPTS("passAttempts"),
    PASS_COMPLETIONS("passCompletions"),
    RUSH_YARDS("rushYards"),
    RUSH_ATTEMPTS("rushAttempts"),
    REC_YARDS("recYards"),
    RECEPTIONS("receptions"),
    ANYTIME_TD("anytimeTD");

    val id: String get() = raw

    val dbKey: String?
        get() = when (this) {
            ALL -> null
            ANYTIME_TD -> "player_anytime_td"
            RUSH_YARDS -> "player_rush_yds"
            REC_YARDS -> "player_reception_yds"
            RECEPTIONS -> "player_receptions"
            PASS_YARDS -> "player_pass_yds"
            PASS_TDS -> "player_pass_tds"
            PASS_ATTEMPTS -> "player_pass_attempts"
            PASS_COMPLETIONS -> "player_pass_completions"
            RUSH_ATTEMPTS -> "player_rush_attempts"
        }

    val label: String
        get() = when (this) {
            ALL -> "All bet types"
            ANYTIME_TD -> "Anytime TD"
            RUSH_YARDS -> "Rushing Yards"
            REC_YARDS -> "Receiving Yards"
            RECEPTIONS -> "Receptions"
            PASS_YARDS -> "Passing Yards"
            PASS_TDS -> "Passing TDs"
            PASS_ATTEMPTS -> "Pass Attempts"
            PASS_COMPLETIONS -> "Completions"
            RUSH_ATTEMPTS -> "Rush Attempts"
        }
}

// MARK: - Slate

/** Full-game + first-5 lines/odds bundle attached to MLB slate games (client-built). */
data class OutliersTrendsMLBContext(
    val homeMl: Double?,
    val awayMl: Double?,
    val homeSpread: Double?,
    val awaySpread: Double?,
    val totalLine: Double?,
    val f5HomeMl: Double?,
    val f5AwayMl: Double?,
    val f5HomeSpread: Double?,
    val f5AwaySpread: Double?,
    val f5TotalLine: Double?,
    val homeSpreadOdds: Double? = null,
    val awaySpreadOdds: Double? = null,
    val totalOverOdds: Double? = null,
    val totalUnderOdds: Double? = null,
    val f5HomeSpreadOdds: Double? = null,
    val f5AwaySpreadOdds: Double? = null,
    val f5TotalOverOdds: Double? = null,
    val f5TotalUnderOdds: Double? = null,
    val isDivisional: Boolean,
    val isDayGame: Boolean,
    val seriesGameNumber: Int?,
)

data class OutliersTrendsGame(
    val id: String,
    val season: Int,
    val week: Int,
    val awayAb: String,
    val homeAb: String,
    val awayTeam: String,
    val homeTeam: String,
    val fgSpreadClose: Double?,
    val fgTotalClose: Double?,
    val kickoff: String?,
    val slot: String?,
    val assignedReferee: String?,
    val mlbContext: OutliersTrendsMLBContext? = null,
) {
    val label: String get() = "$awayAb @ $homeAb"
}

/** Swift enum with associated value → sealed class. */
sealed class OutliersTrendsMatchupFilter {
    data object AllGames : OutliersTrendsMatchupFilter()
    data class Game(val id: String) : OutliersTrendsMatchupFilter()
}

// MARK: - Display cards

enum class OutliersTrendsSubjectKind(val raw: String) {
    TEAM("team"),
    COACH("coach"),
    REFEREE("referee"),
    PLAYER("player"),
}

data class OutliersTrendsBettingLine(
    val id: String,
    val label: String,
    val lineText: String,
    val oddsText: String? = null,
    val bookName: String? = null,
    val bookLogoUrl: String? = null,
    val teamAbbr: String? = null,
)

data class OutliersTrendsCardRow(
    val id: String,
    val text: String,
    val coverageNote: String?,
    val dominantPct: Double,
    val sampleN: Int,
)

data class OutliersTrendsCard(
    val id: String,
    val gameId: String,
    val matchupLabel: String,
    val subjectKind: OutliersTrendsSubjectKind,
    val subjectName: String,
    val subjectDetail: String?,
    val teamAbbr: String?,
    val playerId: String?,
    val marketKey: String,
    val betTypeLabel: String,
    val trendValue: Double,
    val trendSampleN: Int,
    val lineContext: String?,
    val headshotUrl: String? = null,
    val bettingLines: List<OutliersTrendsBettingLine> = emptyList(),
    val rows: List<OutliersTrendsCardRow>,
    val isPlayerOverflow: Boolean = false,
)

// MARK: - Market sections

/**
 * One bet-type group on the Outliers page: a section header + a horizontal card carousel.
 * Market stopped being a filter pill — it's now the page's organizing dimension.
 */
data class OutliersTrendsMarketSection(
    val marketKey: String,
    val title: String,
    val cards: List<OutliersTrendsCard>,
) {
    val id: String get() = marketKey

    companion object {
        // Canonical section order across every sport; unranked markets fall to the end.
        private val marketOrder: List<String> = listOf(
            "spread", "moneyline", "total", "team_total", "h1_spread", "h1_total",
            "ml", "rl", "ou", "f5_ml", "f5_rl", "f5_ou",
            "player_pass_yds", "player_pass_tds", "player_pass_attempts", "player_pass_completions",
            "player_rush_yds", "player_rush_attempts",
            "player_reception_yds", "player_receptions", "player_anytime_td",
        )

        private fun rank(key: String): Int =
            marketOrder.indexOf(key).let { if (it >= 0) it else marketOrder.size }

        /**
         * Buckets an already-sorted (best-first) card list by market into ordered sections,
         * capping each carousel. Overflow placeholder cards are dropped — carousels scroll instead.
         */
        fun sections(cards: List<OutliersTrendsCard>, cap: Int): List<OutliersTrendsMarketSection> {
            val keyOrder = mutableListOf<String>()
            val groups = mutableMapOf<String, MutableList<OutliersTrendsCard>>()
            for (card in cards) {
                if (card.isPlayerOverflow) continue
                groups.getOrPut(card.marketKey) {
                    keyOrder.add(card.marketKey)
                    mutableListOf()
                }.add(card)
            }
            return keyOrder.map { key ->
                val bucket = groups[key].orEmpty()
                OutliersTrendsMarketSection(
                    marketKey = key,
                    title = bucket.firstOrNull()?.betTypeLabel ?: key,
                    cards = bucket.take(cap),
                )
            }.sortedBy { rank(it.marketKey) }
        }
    }
}

// MARK: - Search index entry

/**
 * A trend card plus the context Search needs to render the exact trend card
 * from the Outliers tab — the card's sport (for logos) and its game (for the
 * schedule label + matchup names). The cross-sport search index is a list of these.
 */
data class OutliersTrendsSearchEntry(
    val card: OutliersTrendsCard,
    val sport: OutliersTrendsSport,
    val game: OutliersTrendsGame?,
) {
    val id: String get() = "${sport.raw}-${card.id}"
}

// MARK: - Split primitives (decoded from `*_team_trends` JSONB; literal short keys)

@Serializable
data class NFLTrendSplitCell(
    val h: Int,
    val l: Int,
    val p: Int? = null,
    val n: Int,
    val pct: Double,
)

@Serializable
data class NFLTrendH2HCell(
    val h: Int,
    val n: Int,
    val pct: Double? = null,
) {
    val l: Int get() = maxOf(0, n - h)
}

/** market → situation → window → cell. */
typealias NFLTrendSplits = Map<String, Map<String, Map<String, NFLTrendSplitCell>>>
typealias NFLTrendMarketCoverage = Map<String, String>
