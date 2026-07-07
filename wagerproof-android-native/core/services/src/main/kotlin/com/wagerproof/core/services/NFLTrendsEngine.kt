package com.wagerproof.core.services

import com.wagerproof.core.models.NFLCoachTrendRecord
import com.wagerproof.core.models.NFLPlayerPropTrendRecord
import com.wagerproof.core.models.NFLRefereeTrendRecord
import com.wagerproof.core.models.NFLTeamTrendRecord
import com.wagerproof.core.models.NFLTeams
import com.wagerproof.core.models.NFLTrendH2HCell
import com.wagerproof.core.models.NFLTrendMatchupRecord
import com.wagerproof.core.models.NFLTrendSplitCell
import com.wagerproof.core.models.NFLTrendSplits
import com.wagerproof.core.models.NFLTrendsSlateBundle
import com.wagerproof.core.models.OutliersTrendsCard
import com.wagerproof.core.models.OutliersTrendsCardRow
import com.wagerproof.core.models.OutliersTrendsGame
import com.wagerproof.core.models.OutliersTrendsGameMarket
import com.wagerproof.core.models.OutliersTrendsMatchupFilter
import com.wagerproof.core.models.OutliersTrendsPropMarket
import com.wagerproof.core.models.OutliersTrendsSport
import com.wagerproof.core.models.OutliersTrendsSubject
import com.wagerproof.core.models.OutliersTrendsSubjectKind
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Pure logic: game context, extreme-window stats, card assembly.
 * Ports iOS `NFLTrendsEngine.swift` (which itself ports
 * `research/nfl-extreme-outcomes/CURSOR_OUTLIERS_TRENDS_PROMPT.md` §3–5).
 */
object NFLTrendsEngine {
    const val playerPreviewCap = 4
    const val allGamesPreviewCap = 50

    private val ET: ZoneId = ZoneId.of("America/New_York")

    private val divisions: List<List<String>> = listOf(
        listOf("BUF", "MIA", "NE", "NYJ"),
        listOf("BAL", "CIN", "CLE", "PIT"),
        listOf("HOU", "IND", "JAX", "TEN"),
        listOf("DEN", "KC", "LV", "LAC"),
        listOf("DAL", "NYG", "PHI", "WAS"),
        listOf("CHI", "DET", "GB", "MIN"),
        listOf("ATL", "CAR", "NO", "TB"),
        listOf("ARI", "LA", "SF", "SEA"),
    )

    private val teamMarkets = listOf("spread", "moneyline", "total", "team_total", "h1_spread", "h1_total")
    private val coachMarkets = teamMarkets
    private val refereeMarkets = listOf("spread", "moneyline", "total", "h1_spread", "h1_total")

    fun isDivisionGame(home: String, away: String): Boolean =
        divisions.any { it.contains(home) && it.contains(away) }

    data class GameContext(
        val homeFavDog: String?,
        val awayFavDog: String?,
        val divisionScope: String,
        val primetimeScope: String,
    )

    fun gameContext(game: OutliersTrendsGame): GameContext {
        val spread = game.fgSpreadClose ?: 0.0
        val homeFav: String?
        val awayFav: String?
        when {
            spread == 0.0 -> { homeFav = null; awayFav = null }
            spread < 0 -> { homeFav = "favorite"; awayFav = "underdog" }
            else -> { homeFav = "underdog"; awayFav = "favorite" }
        }
        return GameContext(
            homeFavDog = homeFav,
            awayFavDog = awayFav,
            divisionScope = if (isDivisionGame(home = game.homeAb, away = game.awayAb)) "division" else "non_division",
            primetimeScope = if (isPrimetime(game.kickoff)) "primetime" else "regular",
        )
    }

    fun isPrimetime(kickoff: String?): Boolean {
        if (kickoff.isNullOrEmpty()) return false
        parseIsoHourET(kickoff)?.let { return it >= 19 }
        return false
    }

    // ISO_OFFSET_DATE_TIME covers both fractional + non-fractional seconds (Swift tried
    // the two ISO8601DateFormatter option sets separately); string fallback matches Swift's.
    private fun parseIsoHourET(kickoff: String): Int? {
        try {
            return OffsetDateTime.parse(kickoff).atZoneSameInstant(ET).hour
        } catch (_: Exception) {
            // fall through to raw string parse
        }
        val hourPart = kickoff.split("T").filter { it.isNotEmpty() }.lastOrNull()
            ?.split(":")?.filter { it.isNotEmpty() }?.firstOrNull()
        return hourPart?.toIntOrNull()
    }

    /** Filters pre-rendered cards from outliers trend card tables (same rules as [buildCards]). */
    fun filterPrecomputedCards(
        cards: List<OutliersTrendsCard>,
        games: List<OutliersTrendsGame>,
        sport: OutliersTrendsSport,
        gameFilter: OutliersTrendsMatchupFilter,
        subject: OutliersTrendsSubject,
        gameMarket: OutliersTrendsGameMarket,
        propMarket: OutliersTrendsPropMarket,
        includeAllPlayers: Boolean,
        visibleLimit: Int,
    ): List<OutliersTrendsCard> {
        val gamesById = games.associateBy { it.id }
        var filtered = cards.filter { card ->
            if (!matchesSlateScope(card, gamesById)) return@filter false
            if (!matchesSubjectFilter(card, subject)) return@filter false
            if (!matchesMarketFilter(card, gameMarket, propMarket)) return@filter false
            if (!hasDisplayableBettingLine(card, sport)) return@filter false
            when (gameFilter) {
                is OutliersTrendsMatchupFilter.AllGames -> true
                is OutliersTrendsMatchupFilter.Game -> card.gameId == gameFilter.id
            }
        }

        if (sport == OutliersTrendsSport.NFL && gameFilter is OutliersTrendsMatchupFilter.Game) {
            val game = games.firstOrNull { it.id == gameFilter.id }
            if (game != null) {
                val nonPlayers = filtered.filter { it.subjectKind != OutliersTrendsSubjectKind.PLAYER }
                val playerCards = filtered
                    .filter { it.subjectKind == OutliersTrendsSubjectKind.PLAYER && !it.isPlayerOverflow }
                    .sortedWith(displayComparator)
                val home = capPlayers(
                    playerCards.filter { it.teamAbbr == game.homeAb },
                    teamAb = game.homeAb, game = game, includeAll = includeAllPlayers,
                )
                val away = capPlayers(
                    playerCards.filter { it.teamAbbr == game.awayAb },
                    teamAb = game.awayAb, game = game, includeAll = includeAllPlayers,
                )
                filtered = nonPlayers + home + away
            }
        }

        val sorted = filtered.sortedWith(displayComparator)

        if (gameFilter is OutliersTrendsMatchupFilter.AllGames) {
            return sorted.take(visibleLimit)
        }
        return sorted
    }

    private fun hasDisplayableBettingLine(card: OutliersTrendsCard, sport: OutliersTrendsSport): Boolean {
        if (sport == OutliersTrendsSport.NCAAF) return true
        if (card.subjectKind == OutliersTrendsSubjectKind.PLAYER && !card.isPlayerOverflow) {
            return card.bettingLines.isNotEmpty()
        }
        return true
    }

    private fun teamMatchesGame(teamKey: String, game: OutliersTrendsGame): Boolean =
        teamKey == game.homeAb || teamKey == game.awayAb ||
            teamKey == game.homeTeam || teamKey == game.awayTeam

    /** Only subjects tied to the current slate week — assigned ref, teams in the game, etc. */
    private fun matchesSlateScope(
        card: OutliersTrendsCard,
        gamesById: Map<String, OutliersTrendsGame>,
    ): Boolean {
        val game = gamesById[card.gameId] ?: return false
        return when (card.subjectKind) {
            OutliersTrendsSubjectKind.REFEREE -> {
                val assigned = game.assignedReferee
                if (assigned.isNullOrEmpty()) false else card.subjectName == assigned
            }
            OutliersTrendsSubjectKind.TEAM,
            OutliersTrendsSubjectKind.COACH,
            OutliersTrendsSubjectKind.PLAYER -> {
                val teamKey = card.teamAbbr ?: return false
                teamMatchesGame(teamKey, game)
            }
        }
    }

    /** Refs/coaches don't have every game market — ignore stale picks from another subject tab. */
    fun effectiveGameMarket(
        subject: OutliersTrendsSubject,
        selected: OutliersTrendsGameMarket,
    ): OutliersTrendsGameMarket {
        val allowed: List<OutliersTrendsGameMarket> = when (subject) {
            OutliersTrendsSubject.REFS -> listOf(
                OutliersTrendsGameMarket.ALL, OutliersTrendsGameMarket.SPREAD,
                OutliersTrendsGameMarket.MONEYLINE, OutliersTrendsGameMarket.TOTAL,
                OutliersTrendsGameMarket.H1_SPREAD, OutliersTrendsGameMarket.H1_TOTAL,
            )
            OutliersTrendsSubject.TEAMS -> listOf(
                OutliersTrendsGameMarket.ALL, OutliersTrendsGameMarket.SPREAD,
                OutliersTrendsGameMarket.MONEYLINE, OutliersTrendsGameMarket.TOTAL,
                OutliersTrendsGameMarket.TEAM_TOTAL,
                OutliersTrendsGameMarket.H1_SPREAD, OutliersTrendsGameMarket.H1_TOTAL,
            )
            else -> return selected
        }
        return if (allowed.contains(selected)) selected else OutliersTrendsGameMarket.ALL
    }

    // trendValue desc, then trendSampleN desc; stable, matching the Swift comparator.
    private val displayComparator: Comparator<OutliersTrendsCard> =
        compareByDescending<OutliersTrendsCard> { it.trendValue }.thenByDescending { it.trendSampleN }

    private fun matchesSubjectFilter(card: OutliersTrendsCard, subject: OutliersTrendsSubject): Boolean =
        when (subject) {
            OutliersTrendsSubject.ALL -> true
            OutliersTrendsSubject.TEAMS -> card.subjectKind == OutliersTrendsSubjectKind.TEAM
            OutliersTrendsSubject.COACHES -> card.subjectKind == OutliersTrendsSubjectKind.COACH
            OutliersTrendsSubject.REFS -> card.subjectKind == OutliersTrendsSubjectKind.REFEREE
            OutliersTrendsSubject.PLAYERS -> card.subjectKind == OutliersTrendsSubjectKind.PLAYER
        }

    private fun matchesMarketFilter(
        card: OutliersTrendsCard,
        gameMarket: OutliersTrendsGameMarket,
        propMarket: OutliersTrendsPropMarket,
    ): Boolean {
        if (card.subjectKind == OutliersTrendsSubjectKind.PLAYER) {
            val key = propMarket.dbKey ?: return true
            return card.marketKey == key
        }
        val key = gameMarket.dbKey ?: return true
        return card.marketKey == key
    }

    fun buildCards(
        bundle: NFLTrendsSlateBundle,
        gameFilter: OutliersTrendsMatchupFilter,
        subject: OutliersTrendsSubject,
        gameMarket: OutliersTrendsGameMarket,
        propMarket: OutliersTrendsPropMarket,
        includeAllPlayers: Boolean,
        visibleLimit: Int,
    ): List<OutliersTrendsCard> {
        val games = filteredGames(bundle.games, gameFilter)
        val cards = mutableListOf<OutliersTrendsCard>()

        val teamByAbbr = bundle.teams.associateBy { it.teamAbbr }
        val coachByTeam = activeCoachesByTeam(bundle.coaches)
        val refByName = bundle.referees.associateBy { it.referee }
        val playersByTeam = bundle.players.groupBy { it.currentTeam ?: "" }

        for (game in games) {
            val ctx = gameContext(game)
            val matchupLabel = game.label

            if (subject == OutliersTrendsSubject.ALL || subject == OutliersTrendsSubject.TEAMS) {
                appendTeamCards(cards, game, ctx, matchupLabel, teamByAbbr, gameMarket)
            }

            if (subject == OutliersTrendsSubject.ALL || subject == OutliersTrendsSubject.COACHES) {
                appendCoachCards(cards, game, ctx, matchupLabel, coachByTeam, gameMarket)
            }

            if (subject == OutliersTrendsSubject.ALL || subject == OutliersTrendsSubject.REFS) {
                val refName = game.assignedReferee
                if (!refName.isNullOrEmpty()) {
                    refByName[refName]?.let { ref ->
                        appendRefereeCards(cards, ref, game, ctx, matchupLabel, gameMarket)
                    }
                }
            }

            if (subject == OutliersTrendsSubject.ALL || subject == OutliersTrendsSubject.PLAYERS) {
                appendPlayerCards(
                    cards, game, ctx, matchupLabel,
                    playersByTeam, propMarket, gameFilter, includeAllPlayers,
                )
            }
        }

        val sorted = cards.sortedWith(displayComparator)

        if (gameFilter is OutliersTrendsMatchupFilter.AllGames) {
            return sorted.take(visibleLimit)
        }
        return sorted
    }

    // MARK: - Card assembly

    private fun appendTeamCards(
        cards: MutableList<OutliersTrendsCard>,
        game: OutliersTrendsGame,
        ctx: GameContext,
        matchupLabel: String,
        teamByAbbr: Map<String, NFLTeamTrendRecord>,
        gameMarket: OutliersTrendsGameMarket,
    ) {
        for ((abbr, side, opp, favDog) in listOf(
            SideSpec(game.homeAb, "home", game.awayAb, ctx.homeFavDog),
            SideSpec(game.awayAb, "away", game.homeAb, ctx.awayFavDog),
        )) {
            val team = teamByAbbr[abbr] ?: continue
            val dims = teamDimensionSpecs(side = side, favDog = favDog, opponent = opp)
            for (market in teamMarkets) {
                val gm = gameMarket.dbKey
                if (gm != null && gm != market) continue
                buildSubjectCard(
                    idPrefix = "team-${team.teamAbbr}-${game.id}-$market",
                    gameId = game.id,
                    matchupLabel = matchupLabel,
                    kind = OutliersTrendsSubjectKind.TEAM,
                    subjectName = team.teamName ?: team.teamAbbr,
                    subjectDetail = team.teamAbbr,
                    teamAbbr = team.teamAbbr,
                    playerId = null,
                    market = market,
                    isReferee = false,
                    splits = team.splits,
                    h2h = team.matchups[opp],
                    dimensions = dims,
                    coverage = null,
                    lineContext = lineContext(market, game, abbr),
                )?.let { cards.add(it) }
            }
        }
    }

    private fun appendCoachCards(
        cards: MutableList<OutliersTrendsCard>,
        game: OutliersTrendsGame,
        ctx: GameContext,
        matchupLabel: String,
        coachByTeam: Map<String, NFLCoachTrendRecord>,
        gameMarket: OutliersTrendsGameMarket,
    ) {
        for ((abbr, side, opp, favDog) in listOf(
            SideSpec(game.homeAb, "home", game.awayAb, ctx.homeFavDog),
            SideSpec(game.awayAb, "away", game.homeAb, ctx.awayFavDog),
        )) {
            val coach = coachByTeam[abbr] ?: continue
            val dims = coachDimensionSpecs(side = side, favDog = favDog, ctx = ctx, opponent = opp)
            for (market in coachMarkets) {
                val gm = gameMarket.dbKey
                if (gm != null && gm != market) continue
                buildSubjectCard(
                    idPrefix = "coach-${coach.coach}-${game.id}-$market",
                    gameId = game.id,
                    matchupLabel = matchupLabel,
                    kind = OutliersTrendsSubjectKind.COACH,
                    subjectName = coach.coach,
                    subjectDetail = coachDetail(coach),
                    teamAbbr = abbr,
                    playerId = null,
                    market = market,
                    isReferee = false,
                    splits = coach.splits,
                    h2h = coach.matchups[opp],
                    dimensions = dims,
                    coverage = coach.marketCoverage?.get(market),
                    lineContext = lineContext(market, game, abbr),
                )?.let { cards.add(it) }
            }
        }
    }

    private fun appendRefereeCards(
        cards: MutableList<OutliersTrendsCard>,
        ref: NFLRefereeTrendRecord,
        game: OutliersTrendsGame,
        ctx: GameContext,
        matchupLabel: String,
        gameMarket: OutliersTrendsGameMarket,
    ) {
        val dims = refereeDimensionSpecs(ctx)
        for (market in refereeMarkets) {
            val gm = gameMarket.dbKey
            if (gm != null && gm != market) continue
            buildSubjectCard(
                idPrefix = "ref-${ref.referee}-${game.id}-$market",
                gameId = game.id,
                matchupLabel = matchupLabel,
                kind = OutliersTrendsSubjectKind.REFEREE,
                subjectName = ref.referee,
                subjectDetail = ref.careerGames?.let { "$it career games" },
                teamAbbr = null,
                playerId = null,
                market = market,
                isReferee = true,
                splits = ref.splits,
                h2h = null,
                dimensions = dims,
                coverage = ref.marketCoverage?.get(market),
                lineContext = lineContext(market, game, game.homeAb),
            )?.let { cards.add(it) }
        }
    }

    private fun appendPlayerCards(
        cards: MutableList<OutliersTrendsCard>,
        game: OutliersTrendsGame,
        ctx: GameContext,
        matchupLabel: String,
        playersByTeam: Map<String, List<NFLPlayerPropTrendRecord>>,
        propMarket: OutliersTrendsPropMarket,
        gameFilter: OutliersTrendsMatchupFilter,
        includeAllPlayers: Boolean,
    ) {
        val allPlayers = (playersByTeam[game.homeAb] ?: emptyList()) + (playersByTeam[game.awayAb] ?: emptyList())
        val playerCards = mutableListOf<OutliersTrendsCard>()
        for (player in allPlayers) {
            val teamAb = player.currentTeam ?: ""
            val side = if (teamAb == game.homeAb) "home" else "away"
            val opponent = if (teamAb == game.homeAb) game.awayAb else game.homeAb
            val dims = playerDimensionSpecs(side = side, ctx = ctx, opponent = opponent)
            for (market in playerMarkets(player)) {
                val pm = propMarket.dbKey
                if (pm != null && pm != market) continue
                buildSubjectCard(
                    idPrefix = "player-${player.playerId}-${game.id}-$market",
                    gameId = game.id,
                    matchupLabel = matchupLabel,
                    kind = OutliersTrendsSubjectKind.PLAYER,
                    subjectName = player.playerName ?: "Player",
                    subjectDetail = playerDetail(player),
                    teamAbbr = player.currentTeam,
                    playerId = player.playerId,
                    market = market,
                    isReferee = false,
                    splits = player.splits,
                    h2h = playerMatchup(player, opponent),
                    dimensions = dims,
                    coverage = player.coverage,
                    lineContext = null,
                )?.let { playerCards.add(it) }
            }
        }
        val sortedPlayerCards = playerCards.sortedWith(displayComparator)

        if (gameFilter is OutliersTrendsMatchupFilter.Game) {
            val home = capPlayers(
                sortedPlayerCards.filter { it.teamAbbr == game.homeAb },
                teamAb = game.homeAb, game = game, includeAll = includeAllPlayers,
            )
            val away = capPlayers(
                sortedPlayerCards.filter { it.teamAbbr == game.awayAb },
                teamAb = game.awayAb, game = game, includeAll = includeAllPlayers,
            )
            cards.addAll(home + away)
        } else {
            cards.addAll(sortedPlayerCards)
        }
    }

    private data class SideSpec(
        val abbr: String,
        val side: String,
        val opp: String,
        val favDog: String?,
    )

    private data class TrendDimensionSpec(
        val key: String,
        val displayContext: String,
        val isH2H: Boolean,
        val opponent: String?,
    )

    private fun buildSubjectCard(
        idPrefix: String,
        gameId: String,
        matchupLabel: String,
        kind: OutliersTrendsSubjectKind,
        subjectName: String,
        subjectDetail: String?,
        teamAbbr: String?,
        playerId: String?,
        market: String,
        isReferee: Boolean,
        splits: NFLTrendSplits,
        h2h: NFLTrendMatchupRecord?,
        dimensions: List<TrendDimensionSpec>,
        coverage: String?,
        lineContext: String?,
    ): OutliersTrendsCard? {
        val rows = mutableListOf<OutliersTrendsCardRow>()
        for (dim in dimensions) {
            if (dim.isH2H) {
                val opp = dim.opponent
                val cell = h2h?.markets?.get(market)
                if (opp != null && cell != null) {
                    extremeH2HRow(cell, market, isReferee, opp, coverage)?.let { rows.add(it) }
                }
                continue
            }
            extremeSplitRow(
                splits = splits,
                market = market,
                dimension = dim.key,
                displayContext = dim.displayContext,
                isReferee = isReferee,
                coverage = coverage,
            )?.let { rows.add(it) }
        }
        if (rows.isEmpty()) return null
        // Ties keep the earliest row, same as Swift max(by:).
        val strongest = rows.maxWith(
            compareBy<OutliersTrendsCardRow> { it.dominantPct }.thenBy { it.sampleN },
        )
        return OutliersTrendsCard(
            id = idPrefix,
            gameId = gameId,
            matchupLabel = matchupLabel,
            subjectKind = kind,
            subjectName = subjectName,
            subjectDetail = subjectDetail,
            teamAbbr = teamAbbr,
            playerId = playerId,
            marketKey = market,
            betTypeLabel = marketLabel(market),
            trendValue = strongest.dominantPct,
            trendSampleN = strongest.sampleN,
            lineContext = lineContext,
            rows = rows,
        )
    }

    // MARK: - Extreme stats

    private data class TrendRowMetrics(
        val count: Int,
        val displayPct: Double,
        val sortPct: Double,
        val hitSide: Boolean,
        val verb: String,
    )

    /** Anytime TD is always shown/sorted from the Yes (scored) perspective. */
    private fun splitCellMetrics(
        market: String,
        cell: NFLTrendSplitCell,
        isReferee: Boolean,
    ): TrendRowMetrics? {
        if (cell.n < 2) return null
        if (market == "player_anytime_td") {
            val scored = cell.h
            val rate = cell.pct
            return TrendRowMetrics(
                count = scored,
                displayPct = rate,
                sortPct = rate,
                hitSide = true,
                verb = "Scored",
            )
        }
        val dominant = maxOf(cell.pct, 1 - cell.pct)
        val hitSide = cell.pct >= 0.5
        val count = if (hitSide) cell.h else cell.l
        return TrendRowMetrics(
            count = count,
            displayPct = dominant,
            sortPct = dominant,
            hitSide = hitSide,
            verb = verb(market, hitSide, isReferee),
        )
    }

    private fun h2hCellMetrics(
        market: String,
        cell: NFLTrendH2HCell,
        isReferee: Boolean,
    ): TrendRowMetrics? {
        if (cell.n < 2) return null
        val pct = cell.pct ?: if (cell.n > 0) cell.h.toDouble() / cell.n else 0.0
        val synthetic = NFLTrendSplitCell(h = cell.h, l = cell.l, p = 0, n = cell.n, pct = pct)
        return splitCellMetrics(market, synthetic, isReferee)
    }

    private fun extremeSplitRow(
        splits: NFLTrendSplits,
        market: String,
        dimension: String,
        displayContext: String,
        isReferee: Boolean,
        coverage: String?,
    ): OutliersTrendsCardRow? {
        val dimBlock = splits[market]?.get(dimension) ?: return null
        val windowKeys = dimBlock.keys.sortedBy { it.toIntOrNull() ?: 0 }
        var best: Triple<NFLTrendSplitCell, String, TrendRowMetrics>? = null
        for (window in windowKeys) {
            val cell = dimBlock[window] ?: continue
            val metrics = splitCellMetrics(market, cell, isReferee) ?: continue
            val current = best
            if (current == null ||
                metrics.sortPct > current.third.sortPct ||
                (metrics.sortPct == current.third.sortPct && cell.n > current.first.n)
            ) {
                best = Triple(cell, window, metrics)
            }
        }
        val (cell, window, metrics) = best ?: return null
        val pctText = (metrics.displayPct * 100).roundToInt()
        val text = "${metrics.verb} ${metrics.count} of last ${cell.n} $displayContext ($pctText%)"
        return OutliersTrendsCardRow(
            id = "$market-$dimension-$window",
            text = text,
            coverageNote = coverageChip(coverage),
            dominantPct = metrics.displayPct,
            sampleN = cell.n,
        )
    }

    private fun extremeH2HRow(
        cell: NFLTrendH2HCell,
        market: String,
        isReferee: Boolean,
        opponent: String,
        coverage: String?,
    ): OutliersTrendsCardRow? {
        val metrics = h2hCellMetrics(market, cell, isReferee) ?: return null
        val pctText = (metrics.displayPct * 100).roundToInt()
        val text = "${metrics.verb} ${metrics.count} of last ${cell.n} vs $opponent ($pctText%)"
        return OutliersTrendsCardRow(
            id = "$market-h2h-$opponent",
            text = text,
            coverageNote = coverageChip(coverage),
            dominantPct = metrics.displayPct,
            sampleN = cell.n,
        )
    }

    // MARK: - Dimensions

    private fun teamDimensionSpecs(side: String, favDog: String?, opponent: String): MutableList<TrendDimensionSpec> {
        val dims = mutableListOf(
            TrendDimensionSpec("overall", "games", isH2H = false, opponent = null),
            TrendDimensionSpec(side, if (side == "home") "home games" else "road games", isH2H = false, opponent = null),
        )
        if (favDog != null) {
            dims.add(
                TrendDimensionSpec(
                    favDog,
                    if (favDog == "favorite") "as a favorite" else "as an underdog",
                    isH2H = false,
                    opponent = null,
                ),
            )
        }
        dims.add(TrendDimensionSpec("h2h", "vs $opponent", isH2H = true, opponent = opponent))
        return dims
    }

    private fun coachDimensionSpecs(
        side: String,
        favDog: String?,
        ctx: GameContext,
        opponent: String,
    ): List<TrendDimensionSpec> {
        val dims = teamDimensionSpecs(side, favDog, opponent)
        // Both inserted before the trailing h2h dim, matching Swift insert-at-count-1 twice.
        dims.add(
            dims.size - 1,
            TrendDimensionSpec(
                ctx.divisionScope,
                if (ctx.divisionScope == "division") "division games" else "non-division games",
                isH2H = false,
                opponent = null,
            ),
        )
        dims.add(
            dims.size - 1,
            TrendDimensionSpec(
                ctx.primetimeScope,
                if (ctx.primetimeScope == "primetime") "primetime games" else "non-primetime games",
                isH2H = false,
                opponent = null,
            ),
        )
        return dims
    }

    private fun refereeDimensionSpecs(ctx: GameContext): List<TrendDimensionSpec> = listOf(
        TrendDimensionSpec("overall", "games", isH2H = false, opponent = null),
        TrendDimensionSpec(
            ctx.divisionScope,
            if (ctx.divisionScope == "division") "division games" else "non-division games",
            isH2H = false,
            opponent = null,
        ),
        TrendDimensionSpec(
            ctx.primetimeScope,
            if (ctx.primetimeScope == "primetime") "primetime games" else "non-primetime games",
            isH2H = false,
            opponent = null,
        ),
    )

    private fun playerDimensionSpecs(side: String, ctx: GameContext, opponent: String): List<TrendDimensionSpec> =
        listOf(
            TrendDimensionSpec("overall", "games", isH2H = false, opponent = null),
            TrendDimensionSpec(side, if (side == "home") "home games" else "road games", isH2H = false, opponent = null),
            TrendDimensionSpec(
                ctx.divisionScope,
                if (ctx.divisionScope == "division") "division games" else "non-division games",
                isH2H = false,
                opponent = null,
            ),
            TrendDimensionSpec(
                ctx.primetimeScope,
                if (ctx.primetimeScope == "primetime") "primetime games" else "non-primetime games",
                isH2H = false,
                opponent = null,
            ),
            TrendDimensionSpec("h2h", "vs $opponent", isH2H = true, opponent = opponent),
        )

    private fun playerMatchup(player: NFLPlayerPropTrendRecord, opponent: String): NFLTrendMatchupRecord? {
        player.matchups[opponent]?.let { return it }
        val abbr = NFLTeams.abbr(opponent)
        return player.matchups[abbr]
    }

    // MARK: - Helpers

    private fun playerMarkets(player: NFLPlayerPropTrendRecord): List<String> {
        if (player.markets.isEmpty()) {
            return listOf(
                "player_pass_yds", "player_pass_tds", "player_pass_attempts", "player_pass_completions",
                "player_rush_yds", "player_rush_attempts",
                "player_reception_yds", "player_receptions", "player_anytime_td",
            )
        }
        return player.markets
    }

    private fun activeCoachesByTeam(coaches: List<NFLCoachTrendRecord>): Map<String, NFLCoachTrendRecord> {
        val best = mutableMapOf<String, NFLCoachTrendRecord>()
        for (coach in coaches) {
            val team = coach.currentTeam
            if (team.isNullOrEmpty()) continue
            val existing = best[team]
            if (existing != null) {
                if ((coach.lastSeason ?: 0) > (existing.lastSeason ?: 0)) {
                    best[team] = coach
                }
            } else {
                best[team] = coach
            }
        }
        return best
    }

    private fun filteredGames(
        games: List<OutliersTrendsGame>,
        filter: OutliersTrendsMatchupFilter,
    ): List<OutliersTrendsGame> = when (filter) {
        is OutliersTrendsMatchupFilter.AllGames -> games
        is OutliersTrendsMatchupFilter.Game -> games.filter { it.id == filter.id }
    }

    private fun capPlayers(
        cards: List<OutliersTrendsCard>,
        teamAb: String,
        game: OutliersTrendsGame,
        includeAll: Boolean,
    ): List<OutliersTrendsCard> {
        if (includeAll || cards.size <= playerPreviewCap) return cards
        val visible = cards.take(playerPreviewCap)
        val hidden = cards.size - playerPreviewCap
        val overflow = OutliersTrendsCard(
            id = "player-overflow-$teamAb-${game.id}",
            gameId = game.id,
            matchupLabel = game.label,
            subjectKind = OutliersTrendsSubjectKind.PLAYER,
            subjectName = "See all $teamAb players",
            subjectDetail = "+$hidden more player trends",
            teamAbbr = teamAb,
            playerId = null,
            marketKey = "overflow",
            betTypeLabel = "Players",
            trendValue = cards[playerPreviewCap].trendValue,
            trendSampleN = 0,
            lineContext = null,
            rows = emptyList(),
            isPlayerOverflow = true,
        )
        return visible + overflow
    }

    private fun coachDetail(coach: NFLCoachTrendRecord): String? {
        val parts = mutableListOf<String>()
        coach.currentTeam?.let { parts.add(it) }
        coach.careerGames?.let { parts.add("$it career games") }
        return if (parts.isEmpty()) null else parts.joinToString(" · ")
    }

    private fun playerDetail(player: NFLPlayerPropTrendRecord): String? {
        val parts = mutableListOf<String>()
        player.position?.let { parts.add(it) }
        player.currentTeam?.let { parts.add(it) }
        return if (parts.isEmpty()) null else parts.joinToString(" · ")
    }

    private fun coverageChip(coverage: String?): String? {
        if (coverage == null || coverage.lowercase() == "career") return null
        if (coverage.contains("2023")) return "2023–25"
        if (coverage.contains("2024")) return "2024–25"
        return coverage
    }

    fun marketLabel(market: String): String = when (market) {
        "spread" -> "Spread"
        "moneyline" -> "Moneyline"
        "total" -> "Total"
        "team_total" -> "Team Total"
        "h1_spread" -> "1H Spread"
        "h1_total" -> "1H Total"
        "player_anytime_td" -> "Anytime TD"
        "player_rush_yds" -> "Rushing Yards"
        "player_reception_yds" -> "Receiving Yards"
        "player_receptions" -> "Receptions"
        "player_pass_yds" -> "Passing Yards"
        "player_pass_tds" -> "Passing TDs"
        "player_pass_attempts" -> "Pass Attempts"
        "player_pass_completions" -> "Completions"
        "player_rush_attempts" -> "Rush Attempts"
        else -> capitalizedWords(market.replace("_", " "))
    }

    // Mirrors Swift `.capitalized`: each whitespace-separated word first-uppercased, rest lowered.
    internal fun capitalizedWords(text: String): String =
        text.split(" ").joinToString(" ") { word ->
            word.lowercase().replaceFirstChar { it.uppercaseChar() }
        }

    private fun verb(market: String, hitSide: Boolean, isReferee: Boolean): String = when (market) {
        "spread" -> {
            if (isReferee) {
                if (hitSide) "Home covered" else "Away covered"
            } else {
                if (hitSide) "Covered" else "Failed to cover"
            }
        }
        "moneyline" -> {
            if (isReferee) {
                if (hitSide) "Home won" else "Away won"
            } else {
                if (hitSide) "Won" else "Lost"
            }
        }
        "total", "team_total", "h1_total",
        "player_pass_yds", "player_pass_tds", "player_receptions",
        "player_reception_yds", "player_rush_yds",
        "player_pass_attempts", "player_pass_completions", "player_rush_attempts",
        -> if (hitSide) "Over" else "Under"
        "h1_spread" -> {
            if (isReferee) {
                if (hitSide) "Home covered 1H" else "Away covered 1H"
            } else {
                if (hitSide) "Covered 1H" else "Failed to cover 1H"
            }
        }
        "player_anytime_td" -> if (hitSide) "Scored" else "Didn't score"
        else -> if (hitSide) "Hit" else "Missed"
    }

    private fun lineContext(market: String, game: OutliersTrendsGame, teamAbbr: String): String? = when (market) {
        "spread" -> {
            val spread = game.fgSpreadClose
            if (spread == null) {
                null
            } else {
                val teamSpread = if (teamAbbr == game.homeAb) spread else -spread
                "Line ${formatSpread(teamSpread)}"
            }
        }
        "total" -> game.fgTotalClose?.let { "Total ${formattedLine(it)}" }
        "team_total" -> "Team total on slate"
        "moneyline" -> "Moneyline on slate"
        "h1_spread", "h1_total" -> "1H line on slate"
        else -> null
    }

    private fun formatSpread(value: Double): String {
        if (value == Math.round(value).toDouble()) {
            return if (value > 0) "+${value.toInt()}" else "${value.toInt()}"
        }
        val body = String.format(Locale.US, "%.1f", value)
        return if (value > 0) "+$body" else body
    }

    private fun formattedLine(value: Double): String {
        if (value == Math.round(value).toDouble()) return String.format(Locale.US, "%.0f", value)
        return String.format(Locale.US, "%.1f", value)
    }
}
