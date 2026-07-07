package com.wagerproof.app.features.props

import com.wagerproof.core.models.MLBHeadlineProp
import com.wagerproof.core.models.MLBLineupRow
import com.wagerproof.core.models.MLBPlayerPropBestPick
import com.wagerproof.core.models.MLBPlayerPropMarket
import com.wagerproof.core.models.MLBPlayerPropPickKind
import com.wagerproof.core.models.MLBPlayerPropRow
import com.wagerproof.core.models.MLBPlayerProps
import com.wagerproof.core.models.MLBPropMatchup
import com.wagerproof.core.models.MLBPropStarter
import com.wagerproof.core.models.MLBTeams

// MARK: - MLB feed filters (Props tab only)

/** MLB-only Props tab narrowing — game matchup and/or prop market. */
data class MLBPropFeedFilters(
    val gamePk: Int? = null,
    val market: String? = null,
) {
    val isDefault: Boolean get() = gamePk == null && market == null

    companion object {
        /** Home runs excluded — not posted. */
        private val excludedSheetMarkets = setOf("batter_home_runs")

        val sheetPitcherMarkets: List<String>
            get() = MLBPlayerPropMarket.entries.map { it.raw }
                .filter { it.startsWith("pitcher_") && it !in excludedSheetMarkets }

        val sheetBatterMarkets: List<String>
            get() = MLBPlayerPropMarket.entries.map { it.raw }
                .filter { it.startsWith("batter_") && it !in excludedSheetMarkets }

        fun marketLabel(market: String?): String =
            if (market == null) "All Markets" else MLBPlayerProps.marketLabel(market)
    }
}

/** One game tile in the matchup filter picker. */
data class MLBPropGameFilterOption(
    val gamePk: Int?,
    val awayAbbr: String,
    val homeAbbr: String,
    val awayName: String,
    val homeName: String,
    val awayLogoUrl: String?,
    val homeLogoUrl: String?,
) {
    val id: String get() = gamePk?.toString() ?: "all"
    val isAllGames: Boolean get() = gamePk == null
}

object MLBPropGameFilterOptions {
    fun build(matchups: List<MLBPropMatchup>): List<MLBPropGameFilterOption> {
        val sorted = matchups.sortedWith(
            compareBy({ it.officialDate }, { it.gameTimeEt ?: "" }),
        )
        val options = mutableListOf(
            MLBPropGameFilterOption(
                gamePk = null,
                awayAbbr = "", homeAbbr = "", awayName = "", homeName = "",
                awayLogoUrl = null, homeLogoUrl = null,
            ),
        )
        for (m in sorted) {
            options.add(
                MLBPropGameFilterOption(
                    gamePk = m.gamePk,
                    awayAbbr = m.awayAbbr,
                    homeAbbr = m.homeAbbr,
                    awayName = m.awayTeamName,
                    homeName = m.homeTeamName,
                    awayLogoUrl = m.awayLogoUrl,
                    homeLogoUrl = m.homeLogoUrl,
                ),
            )
        }
        return options
    }
}

// MARK: - Feed items

/**
 * One player-specific item in the Props feed. Carries the headline prop for the
 * card plus the full [PlayerPropSelection] for the detail push.
 */
data class PlayerPropFeedItem(
    val selection: PlayerPropSelection,
    val headline: MLBHeadlineProp,
    val teamPrimaryHex: Long,
    val teamSecondaryHex: Long,
    val lineOrder: Int?,
    /** Bottom-row metric label — "BEST" on the default feed, market name when filtered. */
    val metricLabel: String,
) {
    val id: String get() = selection.transitionID

    val sortDate: String get() = selection.officialDate
    val sortTime: String get() = selection.gameTimeEt ?: ""
    val hitRate: Double
        get() {
            val l10 = headline.computed.l10
            return if (l10.games > 0) l10.over.toDouble() / l10.games else -1.0
        }
}

object PlayerPropFeed {

    fun items(
        matchups: List<MLBPropMatchup>,
        filters: MLBPropFeedFilters = MLBPropFeedFilters(),
    ): List<PlayerPropFeedItem> {
        val scoped = filters.gamePk?.let { pk -> matchups.filter { it.gamePk == pk } } ?: matchups
        val metricLabel = if (filters.market == null) {
            "BEST"
        } else {
            MLBPlayerProps.marketLabel(filters.market).uppercase()
        }

        val out = mutableListOf<PlayerPropFeedItem>()
        for (m in scoped) {
            out.addAll(starterItem(m, m.awayStarter, isAway = true, filters, metricLabel))
            out.addAll(starterItem(m, m.homeStarter, isAway = false, filters, metricLabel))

            for (row in m.awayLineup) out.addAll(batterItem(m, row, isAway = true, filters, metricLabel))
            for (row in m.homeLineup) out.addAll(batterItem(m, row, isAway = false, filters, metricLabel))

            for (group in m.extraBatterGroups) {
                val headline = resolveHeadline(group.props, filters) ?: continue
                val name = group.props.firstOrNull()?.playerName ?: "Player"
                val sel = PlayerPropSelection(
                    playerId = group.playerId,
                    playerName = name,
                    isPitcher = false,
                    position = null,
                    batSide = null,
                    teamName = "",
                    teamAbbr = "",
                    teamLogoUrl = null,
                    opponentName = "",
                    opponentAbbr = "",
                    opposingStarterName = "opposing starter",
                    opposingStarterHand = "R",
                    opposingArchetypeName = null,
                    gameTimeEt = m.gameTimeEt,
                    officialDate = m.officialDate,
                    gamePk = m.gamePk,
                    preferredMarket = filters.market,
                    props = group.props,
                    transitionID = "prop-${m.gamePk}-${group.playerId}-batter",
                )
                val colors = MLBTeams.colors("")
                out.add(
                    PlayerPropFeedItem(
                        selection = sel, headline = headline,
                        teamPrimaryHex = colors.primary, teamSecondaryHex = colors.secondary,
                        lineOrder = null, metricLabel = metricLabel,
                    ),
                )
            }
        }
        return out
    }

    private fun resolveHeadline(
        props: List<MLBPlayerPropRow>,
        filters: MLBPropFeedFilters,
    ): MLBHeadlineProp? {
        filters.market?.let { return MLBPlayerProps.pickHeadlineProp(props, it) }
        val kProps = props.filter { it.market == "pitcher_strikeouts" }
        return MLBPlayerProps.pickHeadlineProp(if (kProps.isEmpty()) props else kProps)
    }

    private fun starterItem(
        m: MLBPropMatchup,
        starter: MLBPropStarter,
        isAway: Boolean,
        filters: MLBPropFeedFilters,
        metricLabel: String,
    ): List<PlayerPropFeedItem> {
        val myProps = m.pitcherProps(starter.pitcherId)
        val headline = resolveHeadline(myProps, filters) ?: return emptyList()
        val opp = if (isAway) m.homeStarter else m.awayStarter
        val sel = PlayerPropSelection(
            playerId = starter.pitcherId,
            playerName = starter.name,
            isPitcher = true,
            position = "${starter.hand}HP",
            batSide = null,
            teamName = if (isAway) m.awayTeamName else m.homeTeamName,
            teamAbbr = if (isAway) m.awayAbbr else m.homeAbbr,
            teamLogoUrl = if (isAway) m.awayLogoUrl else m.homeLogoUrl,
            opponentName = if (isAway) m.homeTeamName else m.awayTeamName,
            opponentAbbr = if (isAway) m.homeAbbr else m.awayAbbr,
            opposingStarterName = opp.name,
            opposingStarterHand = opp.hand,
            opposingArchetypeName = null,
            gameTimeEt = m.gameTimeEt,
            officialDate = m.officialDate,
            gamePk = m.gamePk,
            preferredMarket = filters.market,
            props = myProps,
            transitionID = "prop-${m.gamePk}-${starter.pitcherId}-pitcher",
        )
        val colors = MLBTeams.colors(if (isAway) m.awayTeamName else m.homeTeamName)
        return listOf(
            PlayerPropFeedItem(
                selection = sel, headline = headline,
                teamPrimaryHex = colors.primary, teamSecondaryHex = colors.secondary,
                lineOrder = null, metricLabel = metricLabel,
            ),
        )
    }

    private fun batterItem(
        m: MLBPropMatchup,
        row: MLBLineupRow,
        isAway: Boolean,
        filters: MLBPropFeedFilters,
        metricLabel: String,
    ): List<PlayerPropFeedItem> {
        val myProps = m.batterProps(row.playerId)
        val headline = resolveHeadline(myProps, filters) ?: return emptyList()
        val opp = if (isAway) m.homeStarter else m.awayStarter
        val sel = PlayerPropSelection(
            playerId = row.playerId,
            playerName = row.playerName,
            isPitcher = false,
            position = row.position,
            batSide = row.batSide,
            teamName = if (isAway) m.awayTeamName else m.homeTeamName,
            teamAbbr = if (isAway) m.awayAbbr else m.homeAbbr,
            teamLogoUrl = if (isAway) m.awayLogoUrl else m.homeLogoUrl,
            opponentName = if (isAway) m.homeTeamName else m.awayTeamName,
            opponentAbbr = if (isAway) m.homeAbbr else m.awayAbbr,
            opposingStarterName = opp.name,
            opposingStarterHand = opp.hand,
            opposingArchetypeName = opp.archetype?.archetype,
            gameTimeEt = m.gameTimeEt,
            officialDate = m.officialDate,
            gamePk = m.gamePk,
            preferredMarket = filters.market,
            props = myProps,
            transitionID = "prop-${m.gamePk}-${row.playerId}-batter",
        )
        val colors = MLBTeams.colors(if (isAway) m.awayTeamName else m.homeTeamName)
        return listOf(
            PlayerPropFeedItem(
                selection = sel, headline = headline,
                teamPrimaryHex = colors.primary, teamSecondaryHex = colors.secondary,
                lineOrder = row.battingOrder, metricLabel = metricLabel,
            ),
        )
    }

    // MARK: - Best Picks Report → detail

    fun selection(pick: MLBPlayerPropBestPick, matchups: List<MLBPropMatchup>): PlayerPropSelection? {
        val matchup = matchups.firstOrNull { it.gamePk == pick.gamePk } ?: return null
        return selection(pick, matchup)
    }

    fun selection(pick: MLBPlayerPropBestPick, matchup: MLBPropMatchup): PlayerPropSelection? {
        val filters = MLBPropFeedFilters(gamePk = matchup.gamePk, market = pick.market)

        if (pick.kind == MLBPlayerPropPickKind.PITCHER) {
            if (matchup.awayStarter.pitcherId == pick.playerId) {
                return starterItem(matchup, matchup.awayStarter, isAway = true, filters, "BEST").firstOrNull()?.selection
            }
            if (matchup.homeStarter.pitcherId == pick.playerId) {
                return starterItem(matchup, matchup.homeStarter, isAway = false, filters, "BEST").firstOrNull()?.selection
            }
            val props = matchup.pitcherProps(pick.playerId)
            if (props.isEmpty()) return null
            return pitcherSelection(pick, matchup, props)
        }

        matchup.awayLineup.firstOrNull { it.playerId == pick.playerId }?.let { row ->
            return batterItem(matchup, row, isAway = true, filters, "BEST").firstOrNull()?.selection
        }
        matchup.homeLineup.firstOrNull { it.playerId == pick.playerId }?.let { row ->
            return batterItem(matchup, row, isAway = false, filters, "BEST").firstOrNull()?.selection
        }
        val props = matchup.batterProps(pick.playerId)
        if (props.isEmpty()) return null
        return batterSelection(pick, matchup, props)
    }

    /** Last-resort builder when the matchup card isn't cached — prop rows still carry the game log. */
    fun selection(
        pick: MLBPlayerPropBestPick,
        props: List<MLBPlayerPropRow>,
        officialDate: String,
        gameTimeEt: String?,
    ): PlayerPropSelection? {
        val isPitcher = pick.kind == MLBPlayerPropPickKind.PITCHER
        val myProps = props.filter { it.playerId == pick.playerId && it.isPitcher == isPitcher }
        if (myProps.isEmpty()) return null

        val sides = parseGameLabel(pick.gameLabel)
        val teamName = pick.teamName ?: sides?.first ?: ""
        val isAway = sides?.let { MLBTeams.normalize(teamName) == MLBTeams.normalize(it.first) } ?: true
        val opponentName = if (isAway) (sides?.second ?: "Opponent") else (sides?.first ?: "Opponent")
        val teamInfo = MLBTeams.info(teamName)
        val oppInfo = MLBTeams.info(opponentName)

        return PlayerPropSelection(
            playerId = pick.playerId,
            playerName = pick.playerName,
            isPitcher = isPitcher,
            position = if (isPitcher) "SP" else null,
            batSide = null,
            teamName = teamName,
            teamAbbr = teamInfo?.team ?: teamName.take(3).uppercase(),
            teamLogoUrl = teamInfo?.logoUrl,
            opponentName = opponentName,
            opponentAbbr = oppInfo?.team ?: opponentName.take(3).uppercase(),
            opposingStarterName = "Opposing starter",
            opposingStarterHand = "R",
            opposingArchetypeName = myProps.firstOrNull()?.oppArchetypeToday,
            gameTimeEt = gameTimeEt,
            officialDate = officialDate,
            gamePk = pick.gamePk,
            preferredMarket = pick.market,
            props = myProps,
            transitionID = "best-pick-${pick.id}",
        )
    }

    private fun pitcherSelection(
        pick: MLBPlayerPropBestPick,
        matchup: MLBPropMatchup,
        props: List<MLBPlayerPropRow>,
    ): PlayerPropSelection {
        val isAway = teamMatches(pick.teamName, matchup.awayTeamName)
        val starter = if (isAway) matchup.awayStarter else matchup.homeStarter
        val opp = if (isAway) matchup.homeStarter else matchup.awayStarter
        return PlayerPropSelection(
            playerId = pick.playerId,
            playerName = pick.playerName,
            isPitcher = true,
            position = "${starter.hand}HP",
            batSide = null,
            teamName = if (isAway) matchup.awayTeamName else matchup.homeTeamName,
            teamAbbr = if (isAway) matchup.awayAbbr else matchup.homeAbbr,
            teamLogoUrl = if (isAway) matchup.awayLogoUrl else matchup.homeLogoUrl,
            opponentName = if (isAway) matchup.homeTeamName else matchup.awayTeamName,
            opponentAbbr = if (isAway) matchup.homeAbbr else matchup.awayAbbr,
            opposingStarterName = opp.name,
            opposingStarterHand = opp.hand,
            opposingArchetypeName = null,
            gameTimeEt = matchup.gameTimeEt,
            officialDate = matchup.officialDate,
            gamePk = matchup.gamePk,
            preferredMarket = pick.market,
            props = props,
            transitionID = "best-pick-${pick.id}",
        )
    }

    private fun batterSelection(
        pick: MLBPlayerPropBestPick,
        matchup: MLBPropMatchup,
        props: List<MLBPlayerPropRow>,
    ): PlayerPropSelection {
        val isAway = teamMatches(pick.teamName, matchup.awayTeamName)
        val opp = if (isAway) matchup.homeStarter else matchup.awayStarter
        return PlayerPropSelection(
            playerId = pick.playerId,
            playerName = pick.playerName,
            isPitcher = false,
            position = null,
            batSide = null,
            teamName = if (isAway) matchup.awayTeamName else matchup.homeTeamName,
            teamAbbr = if (isAway) matchup.awayAbbr else matchup.homeAbbr,
            teamLogoUrl = if (isAway) matchup.awayLogoUrl else matchup.homeLogoUrl,
            opponentName = if (isAway) matchup.homeTeamName else matchup.awayTeamName,
            opponentAbbr = if (isAway) matchup.homeAbbr else matchup.awayAbbr,
            opposingStarterName = opp.name,
            opposingStarterHand = opp.hand,
            opposingArchetypeName = opp.archetype?.archetype,
            gameTimeEt = matchup.gameTimeEt,
            officialDate = matchup.officialDate,
            gamePk = matchup.gamePk,
            preferredMarket = pick.market,
            props = props,
            transitionID = "best-pick-${pick.id}",
        )
    }

    private fun teamMatches(pickTeam: String?, matchupTeam: String): Boolean {
        if (pickTeam.isNullOrEmpty()) return false
        return MLBTeams.normalize(pickTeam) == MLBTeams.normalize(matchupTeam)
    }

    private fun parseGameLabel(label: String): Pair<String, String>? {
        for (sep in listOf(" @ ", " at ", " vs ", " vs. ")) {
            val parts = label.split(sep)
            if (parts.size == 2) {
                val away = parts[0].trim()
                val home = parts[1].trim()
                if (away.isNotEmpty() && home.isNotEmpty()) return away to home
            }
        }
        return null
    }
}
