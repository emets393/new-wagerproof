package com.wagerproof.app.features.props

import com.wagerproof.core.models.NFLPlayerProps
import com.wagerproof.core.models.NFLPropMarket
import com.wagerproof.core.models.NFLPropPlayer
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.models.NFLTeams

// MARK: - NFL feed filters (Props tab only)

/** NFL-only Props tab narrowing — game matchup, prop market, and/or signal-only feed. */
data class NFLPropFeedFilters(
    val gameId: String? = null,
    val market: String? = null,
    /** When true, only players with a P-flag on the displayed market are shown. */
    val signalsOnly: Boolean = false,
) {
    val isDefault: Boolean get() = gameId == null && market == null && !signalsOnly

    /** Markets grouped for the picker sheet — only keys present in the board. */
    data class SheetMarkets(
        val passing: List<String>,
        val rushing: List<String>,
        val receiving: List<String>,
        val other: List<String>,
    ) {
        val isEmpty: Boolean
            get() = passing.isEmpty() && rushing.isEmpty() && receiving.isEmpty() && other.isEmpty()

        val allKeys: Set<String> get() = (passing + rushing + receiving + other).toSet()
    }

    companion object {
        val sheetPassingMarkets = listOf(
            "player_pass_yds", "player_pass_tds", "player_pass_attempts",
            "player_pass_completions", "player_pass_interceptions",
        )
        val sheetRushingMarkets = listOf(
            "player_rush_yds", "player_rush_attempts", "player_rush_tds",
        )
        val sheetReceivingMarkets = listOf(
            "player_reception_yds", "player_receptions", "player_reception_tds",
        )
        val sheetOtherMarkets = listOf(
            "player_anytime_td", "player_kicking_points", "player_field_goals",
            "player_sacks", "player_tackles_assists",
        )

        private val sheetMarketOrder =
            sheetPassingMarkets + sheetRushingMarkets + sheetReceivingMarkets + sheetOtherMarkets

        fun sheetMarkets(players: List<NFLPropPlayer>): SheetMarkets {
            val available = players.flatMap { p -> p.markets.map { it.market } }.toSet()
            fun filter(keys: List<String>): List<String> =
                keys.filter { it in available }
                    .sortedBy { NFLPlayerProps.marketSortIndex(it) }
            val other = filter(sheetOtherMarkets).toMutableList()
            val categorized = sheetMarketOrder.toSet()
            val uncategorized = available.subtract(categorized)
                .sortedBy { NFLPlayerProps.marketSortIndex(it) }
            other.addAll(uncategorized)
            return SheetMarkets(
                passing = filter(sheetPassingMarkets),
                rushing = filter(sheetRushingMarkets),
                receiving = filter(sheetReceivingMarkets),
                other = other,
            )
        }

        fun marketLabel(market: String?): String =
            if (market == null) "All Markets" else NFLPlayerProps.marketLabel(market)

        fun filterLabel(filters: NFLPropFeedFilters): String =
            if (filters.signalsOnly) "Prop Signals" else marketLabel(filters.market)

        fun flaggedPlayerCount(players: List<NFLPropPlayer>, gameId: String? = null): Int {
            val scoped = gameId?.let { gid -> players.filter { it.gameId == gid } } ?: players
            return scoped.count { p -> p.markets.any { it.flags.isNotEmpty() } }
        }

        fun hasFlaggedPlayers(players: List<NFLPropPlayer>, gameId: String): Boolean =
            players.any { p -> p.gameId == gameId && p.markets.any { it.flags.isNotEmpty() } }

        fun gameOptionPlayers(players: List<NFLPropPlayer>, signalsOnly: Boolean): List<NFLPropPlayer> {
            if (!signalsOnly) return players
            return players.filter { p -> p.markets.any { it.flags.isNotEmpty() } }
        }
    }
}

/** One game tile in the matchup filter picker. */
data class NFLPropGameFilterOption(
    val gameId: String?,
    val awayTeam: String,
    val homeTeam: String,
    val awayAbbr: String,
    val homeAbbr: String,
    val gameDate: String,
    val slot: String?,
) {
    val id: String get() = gameId ?: "all"
    val isAllGames: Boolean get() = gameId == null
}

object NFLPropGameFilterOptions {
    fun build(players: List<NFLPropPlayer>, signalsOnly: Boolean = false): List<NFLPropGameFilterOption> {
        val pool = NFLPropFeedFilters.gameOptionPlayers(players, signalsOnly)
        val byGame = LinkedHashMap<String, NFLPropPlayer>()
        for (p in pool) if (byGame[p.gameId] == null) byGame[p.gameId] = p
        val sorted = byGame.values.sortedWith(
            compareBy({ it.gameDate }, { NFLPlayerProps.slotOrder(it.slot) }),
        )
        val options = mutableListOf(
            NFLPropGameFilterOption(
                gameId = null, awayTeam = "", homeTeam = "",
                awayAbbr = "", homeAbbr = "", gameDate = "", slot = null,
            ),
        )
        for (p in sorted) {
            val (away, home) = awayHomeTeams(p)
            options.add(
                NFLPropGameFilterOption(
                    gameId = p.gameId,
                    awayTeam = NFLTeams.fullName(away) ?: away,
                    homeTeam = NFLTeams.fullName(home) ?: home,
                    awayAbbr = NFLTeamAssets.abbr(away),
                    homeAbbr = NFLTeamAssets.abbr(home),
                    gameDate = p.gameDate,
                    slot = p.slot,
                ),
            )
        }
        return options
    }

    private fun awayHomeTeams(player: NFLPropPlayer): Pair<String, String> {
        val team = player.team ?: ""
        val opp = player.opponent ?: ""
        if (player.isHome == true) return opp to team
        if (player.isHome == false) return team to opp
        // Fallback: parse `2025_12_AWAY_HOME` when home/away flag is missing.
        val parts = player.gameId.split("_")
        if (parts.size >= 4) return parts[parts.size - 2] to parts[parts.size - 1]
        return team to opp
    }
}

/** Navigation payload pushed when an NFL prop card is tapped. */
data class NFLPlayerPropSelection(
    val player: NFLPropPlayer,
    /** When set, the detail page opens on this market (feed market filter). */
    val preferredMarket: String?,
    val transitionID: String,
) {
    val id: String get() = transitionID
}

/** One player card in the NFL props feed. */
data class NFLPropFeedItem(
    val player: NFLPropPlayer,
    val displayMarket: NFLPropMarket,
    val metricLabel: String,
    val selection: NFLPlayerPropSelection,
) {
    val id: String get() = selection.transitionID

    val sortDate: String get() = player.gameDate
    val sortTime: String get() = player.sortKey
    val hitRate: Double get() = displayMarket.l10HitRate ?: -1.0
}

object NFLPropFeed {
    fun items(
        players: List<NFLPropPlayer>,
        filters: NFLPropFeedFilters = NFLPropFeedFilters(),
    ): List<NFLPropFeedItem> {
        val scoped = filters.gameId?.let { gid -> players.filter { it.gameId == gid } } ?: players
        return scoped.mapNotNull { player ->
            val market = headlineMarket(player, filters.market, filters.signalsOnly) ?: return@mapNotNull null
            val metricLabel = when {
                filters.signalsOnly -> "SIGNAL"
                filters.market == null -> "BEST"
                else -> NFLPlayerProps.marketLabel(filters.market).uppercase()
            }
            val selection = NFLPlayerPropSelection(
                player = player,
                preferredMarket = market.market,
                transitionID = "nflprop-${player.id}",
            )
            NFLPropFeedItem(
                player = player,
                displayMarket = market,
                metricLabel = metricLabel,
                selection = selection,
            )
        }
    }

    private fun headlineMarket(player: NFLPropPlayer, filter: String?, signalsOnly: Boolean): NFLPropMarket? {
        if (signalsOnly) {
            if (filter != null) {
                val market = player.markets.firstOrNull { it.market == filter } ?: return null
                return if (market.flags.isNotEmpty()) market else null
            }
            return player.markets.firstOrNull { it.flags.isNotEmpty() }
        }
        if (filter != null) return player.markets.firstOrNull { it.market == filter }
        return player.markets.firstOrNull { it.flags.isNotEmpty() } ?: player.markets.firstOrNull()
    }
}
