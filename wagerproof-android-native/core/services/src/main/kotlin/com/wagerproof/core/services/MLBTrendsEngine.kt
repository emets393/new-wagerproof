package com.wagerproof.core.services

import com.wagerproof.core.models.MLBTeamTrendRecord
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.models.MLBTrendsSlateBundle
import com.wagerproof.core.models.NFLTrendH2HCell
import com.wagerproof.core.models.NFLTrendMatchupRecord
import com.wagerproof.core.models.NFLTrendSplitCell
import com.wagerproof.core.models.NFLTrendSplits
import com.wagerproof.core.models.OutliersTrendsBettingLine
import com.wagerproof.core.models.OutliersTrendsCard
import com.wagerproof.core.models.OutliersTrendsCardRow
import com.wagerproof.core.models.OutliersTrendsGame
import com.wagerproof.core.models.OutliersTrendsGameMarket
import com.wagerproof.core.models.OutliersTrendsMatchupFilter
import com.wagerproof.core.models.OutliersTrendsSubject
import com.wagerproof.core.models.OutliersTrendsSubjectKind
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Client-side MLB Outliers trend cards from `mlb_team_trends` splits + matchups.
 * Port of iOS `MLBTrendsEngine.swift` — pure logic, no network.
 */
object MLBTrendsEngine {
    const val allGamesPreviewCap = 50

    private val ET: ZoneId = ZoneId.of("America/New_York")

    private val teamMarkets = listOf("ml", "rl", "ou", "f5_ml", "f5_rl", "f5_ou")

    /** Slate / mapping abbr → `mlb_team_trends.team_abbr` (legacy short keys in the table). */
    private val appToTrendsAbbr: Map<String, String> = mapOf(
        "ARI" to "AZ",
        "OAK" to "ATH",
        "SFG" to "SF",
        "SDP" to "SD",
    )

    fun trendsAbbr(appAbbr: String): String {
        val upper = appAbbr.uppercase()
        return appToTrendsAbbr[upper] ?: upper
    }

    fun appAbbr(trendsAbbr: String): String {
        val upper = trendsAbbr.uppercase()
        for ((app, trends) in appToTrendsAbbr) {
            if (trends == upper) return app
        }
        return upper
    }

    fun remapTeamRecord(record: MLBTeamTrendRecord, preferredAppAbbr: String?): MLBTeamTrendRecord {
        val resolvedAbbr = preferredAppAbbr ?: appAbbr(record.teamAbbr)
        val normalizedMatchups = mutableMapOf<String, NFLTrendMatchupRecord>()
        for ((opp, value) in record.matchups) {
            normalizedMatchups[appAbbr(opp)] = value
        }
        return MLBTeamTrendRecord(
            teamAbbr = resolvedAbbr,
            teamName = record.teamName,
            season = record.season,
            throughDate = record.throughDate,
            splits = record.splits,
            matchups = normalizedMatchups,
        )
    }

    private fun matchupRecord(
        matchups: Map<String, NFLTrendMatchupRecord>,
        opponent: String,
    ): NFLTrendMatchupRecord? {
        val candidates = listOf(
            opponent.uppercase(),
            trendsAbbr(opponent),
            appAbbr(opponent),
        ).distinct()
        for (key in candidates) {
            matchups[key]?.let { return it }
        }
        return null
    }

    private val divisions: List<List<String>> = listOf(
        listOf("BAL", "BOS", "NYY", "TBR", "TOR"),
        listOf("CWS", "CLE", "DET", "KC", "MIN"),
        listOf("HOU", "LAA", "ATH", "SEA", "TEX"),
        listOf("ATL", "MIA", "NYM", "PHI", "WSH"),
        listOf("CHC", "CIN", "MIL", "PIT", "STL"),
        listOf("ARI", "COL", "LAD", "SDP", "SFG"),
    )

    data class GameContext(
        val homeFavDog: String?,
        val awayFavDog: String?,
        val divisionScope: String,
        val dayNightScope: String,
        val seriesDimension: String?,
    )

    fun isDivisionGame(home: String, away: String): Boolean {
        val homeKey = trendsAbbr(home)
        val awayKey = trendsAbbr(away)
        // Division table mixes app-style keys (SDP/SFG/ARI); normalize both sides to trends keys.
        val normalizedDivisions = divisions.map { div -> div.map { trendsAbbr(it) } }
        return normalizedDivisions.any { it.contains(homeKey) && it.contains(awayKey) }
    }

    fun gameContext(game: OutliersTrendsGame): GameContext {
        val ctx = game.mlbContext
        val homeMl = ctx?.homeMl
        val awayMl = ctx?.awayMl

        val homeFav: String?
        val awayFav: String?
        if (homeMl != null && awayMl != null && homeMl != awayMl) {
            if (homeMl < awayMl) {
                homeFav = "favorite"
                awayFav = "underdog"
            } else {
                homeFav = "underdog"
                awayFav = "favorite"
            }
        } else {
            homeFav = null
            awayFav = null
        }

        val divisionScope = if (ctx?.isDivisional ?: isDivisionGame(home = game.homeAb, away = game.awayAb)) {
            "division"
        } else {
            "non_division"
        }
        val dayNightScope = if (ctx?.isDayGame ?: isDayGame(game.kickoff)) "day" else "night"
        val seriesGameNumber = ctx?.seriesGameNumber
        val seriesDimension = if (seriesGameNumber != null && seriesGameNumber in 1..4) {
            "series_game_$seriesGameNumber"
        } else {
            null
        }

        return GameContext(
            homeFavDog = homeFav,
            awayFavDog = awayFav,
            divisionScope = divisionScope,
            dayNightScope = dayNightScope,
            seriesDimension = seriesDimension,
        )
    }

    fun isDayGame(kickoff: String?): Boolean {
        if (kickoff.isNullOrEmpty()) return false
        // ISO_OFFSET_DATE_TIME covers fractional + non-fractional seconds (Swift tried both
        // ISO8601DateFormatter option sets); raw-string fallback matches Swift's.
        try {
            return OffsetDateTime.parse(kickoff).atZoneSameInstant(ET).hour < 17
        } catch (_: Exception) {
            // fall through to raw string parse
        }
        val hourPart = kickoff.split("T").filter { it.isNotEmpty() }.lastOrNull()
            ?.split(":")?.filter { it.isNotEmpty() }?.firstOrNull()
        hourPart?.toIntOrNull()?.let { return it < 17 }
        return false
    }

    fun buildCards(
        bundle: MLBTrendsSlateBundle,
        gameFilter: OutliersTrendsMatchupFilter,
        subject: OutliersTrendsSubject,
        gameMarket: OutliersTrendsGameMarket,
        visibleLimit: Int,
    ): List<OutliersTrendsCard> {
        if (subject != OutliersTrendsSubject.ALL && subject != OutliersTrendsSubject.TEAMS) return emptyList()
        val games = filteredGames(bundle.games, gameFilter)
        val teamByAbbr = bundle.teams.associateBy { it.teamAbbr }
        val cards = mutableListOf<OutliersTrendsCard>()

        for (game in games) {
            val ctx = gameContext(game)
            val matchupLabel = game.label
            for ((abbr, side, opp, favDog) in listOf(
                SideSpec(game.homeAb, "home", game.awayAb, ctx.homeFavDog),
                SideSpec(game.awayAb, "away", game.homeAb, ctx.awayFavDog),
            )) {
                val team = teamByAbbr[abbr] ?: continue
                for (market in teamMarkets) {
                    val gm = gameMarket.dbKey
                    if (gm != null && gm != market) continue
                    buildTeamCard(
                        team = team,
                        game = game,
                        ctx = ctx,
                        side = side,
                        opponent = opp,
                        favDog = favDog,
                        matchupLabel = matchupLabel,
                        market = market,
                    )?.let { cards.add(it) }
                }
            }
        }

        val sorted = cards.sortedWith(
            compareByDescending<OutliersTrendsCard> { it.trendValue }.thenByDescending { it.trendSampleN },
        )

        if (gameFilter is OutliersTrendsMatchupFilter.AllGames) {
            return sorted.take(visibleLimit)
        }
        return sorted
    }

    private data class SideSpec(
        val abbr: String,
        val side: String,
        val opp: String,
        val favDog: String?,
    )

    // MARK: - Card assembly

    private fun buildTeamCard(
        team: MLBTeamTrendRecord,
        game: OutliersTrendsGame,
        ctx: GameContext,
        side: String,
        opponent: String,
        favDog: String?,
        matchupLabel: String,
        market: String,
    ): OutliersTrendsCard? {
        val dims = teamDimensionSpecs(side = side, favDog = favDog, ctx = ctx)
        val extraRows = mutableListOf<OutliersTrendsCardRow>()
        headToHeadRow(team, opponent, market)?.let { extraRows.add(it) }
        val lines = bettingLines(market, game, team.teamAbbr)
        return buildSplitCard(
            idPrefix = "team-${team.teamAbbr}-${game.id}-$market",
            gameId = game.id,
            matchupLabel = matchupLabel,
            subjectName = MLBTeams.nickname(team.teamName ?: team.teamAbbr),
            subjectDetail = team.teamAbbr,
            teamAbbr = team.teamAbbr,
            market = market,
            splits = team.splits,
            dimensions = dims,
            bettingLines = lines,
            extraRows = extraRows,
        )
    }

    private fun headToHeadRow(
        team: MLBTeamTrendRecord,
        opponent: String,
        market: String,
    ): OutliersTrendsCardRow? {
        val record = matchupRecord(team.matchups, opponent) ?: return null
        val cell = record.markets[market] ?: return null
        return h2hRow(cell, market, opponent)
    }

    private data class TrendDimensionSpec(
        val key: String,
        val displayContext: String,
    )

    private fun buildSplitCard(
        idPrefix: String,
        gameId: String,
        matchupLabel: String,
        subjectName: String,
        subjectDetail: String?,
        teamAbbr: String,
        market: String,
        splits: NFLTrendSplits,
        dimensions: List<TrendDimensionSpec>,
        bettingLines: List<OutliersTrendsBettingLine>,
        extraRows: List<OutliersTrendsCardRow> = emptyList(),
    ): OutliersTrendsCard? {
        val rows = mutableListOf<OutliersTrendsCardRow>()
        for (dim in dimensions) {
            extremeSplitRow(
                splits = splits,
                market = market,
                dimension = dim.key,
                displayContext = dim.displayContext,
            )?.let { rows.add(it) }
        }
        rows.addAll(extraRows)
        if (rows.isEmpty()) return null
        // Ties keep the earliest row, same as Swift max(by:).
        val strongest = rows.maxWith(
            compareBy<OutliersTrendsCardRow> { it.dominantPct }.thenBy { it.sampleN },
        )
        return OutliersTrendsCard(
            id = idPrefix,
            gameId = gameId,
            matchupLabel = matchupLabel,
            subjectKind = OutliersTrendsSubjectKind.TEAM,
            subjectName = subjectName,
            subjectDetail = subjectDetail,
            teamAbbr = teamAbbr,
            playerId = null,
            marketKey = market,
            betTypeLabel = marketLabel(market),
            trendValue = strongest.dominantPct,
            trendSampleN = strongest.sampleN,
            lineContext = null,
            bettingLines = bettingLines,
            rows = rows,
        )
    }

    private fun teamDimensionSpecs(
        side: String,
        favDog: String?,
        ctx: GameContext,
    ): List<TrendDimensionSpec> {
        val dims = mutableListOf(
            TrendDimensionSpec("overall", "games"),
            TrendDimensionSpec(side, if (side == "home") "Home" else "Away"),
        )
        if (favDog != null) {
            dims.add(TrendDimensionSpec(favDog, if (favDog == "favorite") "As Favorite" else "As Underdog"))
        }
        dims.add(
            TrendDimensionSpec(
                ctx.divisionScope,
                if (ctx.divisionScope == "division") "Division" else "Non-Division",
            ),
        )
        dims.add(
            TrendDimensionSpec(
                ctx.dayNightScope,
                if (ctx.dayNightScope == "day") "Day Games" else "Night Games",
            ),
        )
        ctx.seriesDimension?.let { series ->
            dims.add(TrendDimensionSpec(series, seriesDisplayLabel(series)))
        }
        return dims
    }

    private fun seriesDisplayLabel(key: String): String = when (key) {
        "series_game_1" -> "Series G1"
        "series_game_2" -> "Series G2"
        "series_game_3" -> "Series G3"
        "series_game_4" -> "Series G4"
        else -> NFLTrendsEngine.capitalizedWords(key.replace("_", " "))
    }

    // MARK: - Extreme stats

    private data class TrendRowMetrics(
        val count: Int,
        val displayPct: Double,
        val sortPct: Double,
        val hitSide: Boolean,
        val verb: String,
    )

    private fun isOverUnderMarket(market: String): Boolean = market == "ou" || market == "f5_ou"

    private fun isRunLineMarket(market: String): Boolean = market == "rl" || market == "f5_rl"

    private fun h2hCellMetrics(market: String, cell: NFLTrendH2HCell): TrendRowMetrics? {
        if (cell.n < 1) return null
        val pct = cell.pct ?: if (cell.n > 0) cell.h.toDouble() / cell.n else 0.0
        val synthetic = NFLTrendSplitCell(h = cell.h, l = cell.l, p = 0, n = cell.n, pct = pct)
        // H2H samples are tiny in MLB — accept single-game cells (minSample 1 vs the split default 2).
        return splitCellMetrics(market, synthetic, minSample = 1)
    }

    private fun splitCellMetrics(
        market: String,
        cell: NFLTrendSplitCell,
        minSample: Int = 2,
    ): TrendRowMetrics? {
        if (cell.n < minSample) return null
        if (isOverUnderMarket(market)) {
            val rate = cell.pct
            val hitSide = rate >= 0.5
            val count = if (hitSide) cell.h else cell.l
            return TrendRowMetrics(
                count = count,
                displayPct = maxOf(rate, 1 - rate),
                sortPct = maxOf(rate, 1 - rate),
                hitSide = hitSide,
                verb = if (hitSide) "Over" else "Under",
            )
        }
        val dominant = maxOf(cell.pct, 1 - cell.pct)
        val hitSide = cell.pct >= 0.5
        val count = if (hitSide) cell.h else cell.l
        val verb = if (isRunLineMarket(market)) {
            if (hitSide) "Covered" else "Didn't cover"
        } else {
            if (hitSide) "Won" else "Lost"
        }
        return TrendRowMetrics(
            count = count,
            displayPct = dominant,
            sortPct = dominant,
            hitSide = hitSide,
            verb = verb,
        )
    }

    private fun extremeSplitRow(
        splits: NFLTrendSplits,
        market: String,
        dimension: String,
        displayContext: String,
    ): OutliersTrendsCardRow? {
        val dimBlock = splits[market]?.get(dimension) ?: return null
        val windowKeys = dimBlock.keys.sortedBy { it.toIntOrNull() ?: 0 }
        var best: Triple<NFLTrendSplitCell, String, TrendRowMetrics>? = null
        for (window in windowKeys) {
            val cell = dimBlock[window] ?: continue
            val metrics = splitCellMetrics(market, cell) ?: continue
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
            coverageNote = null,
            dominantPct = metrics.displayPct,
            sampleN = cell.n,
        )
    }

    private fun h2hRow(
        cell: NFLTrendH2HCell,
        market: String,
        opponent: String,
    ): OutliersTrendsCardRow? {
        val metrics = h2hCellMetrics(market, cell) ?: return null
        val pctText = (metrics.displayPct * 100).roundToInt()
        val oppLabel = opponent.uppercase()
        val text = "${metrics.verb} ${metrics.count} of last ${cell.n} vs $oppLabel ($pctText%)"
        val note = if (cell.n < 3) "Small sample (${cell.n} game${if (cell.n == 1) "" else "s"})" else null
        return OutliersTrendsCardRow(
            id = "$market-h2h-$oppLabel",
            text = text,
            coverageNote = note,
            dominantPct = metrics.displayPct,
            sampleN = cell.n,
        )
    }

    private fun filteredGames(
        games: List<OutliersTrendsGame>,
        filter: OutliersTrendsMatchupFilter,
    ): List<OutliersTrendsGame> = when (filter) {
        is OutliersTrendsMatchupFilter.AllGames -> games
        is OutliersTrendsMatchupFilter.Game -> games.filter { it.id == filter.id }
    }

    fun marketLabel(market: String): String = when (market) {
        "ml" -> "Moneyline"
        "rl" -> "Run Line"
        "ou" -> "Total"
        "f5_ml" -> "1st 5 Moneyline"
        "f5_rl" -> "1st 5 Run Line"
        "f5_ou" -> "1st 5 Total"
        else -> NFLTrendsEngine.capitalizedWords(market.replace("_", " "))
    }

    internal fun bettingLines(
        market: String,
        game: OutliersTrendsGame,
        teamAbbr: String,
    ): List<OutliersTrendsBettingLine> {
        val ctx = game.mlbContext ?: return emptyList()
        val isHome = teamAbbr.uppercase() == game.homeAb.uppercase()
        val prefix = "$teamAbbr-${game.id}-$market"

        return when (market) {
            "ml" -> {
                val odds = (if (isHome) ctx.homeMl else ctx.awayMl) ?: return emptyList()
                listOf(
                    OutliersTrendsBettingLine(
                        id = "$prefix-ml",
                        label = "Moneyline",
                        lineText = "ML",
                        oddsText = formatAmerican(odds),
                        teamAbbr = teamAbbr,
                    ),
                )
            }
            "rl" -> {
                val spread = (if (isHome) ctx.homeSpread else ctx.awaySpread) ?: return emptyList()
                val juice = if (isHome) ctx.homeSpreadOdds else ctx.awaySpreadOdds
                listOf(
                    OutliersTrendsBettingLine(
                        id = "$prefix-rl",
                        label = "Run Line",
                        lineText = formatSpread(spread),
                        oddsText = juice?.let(::formatAmerican),
                        teamAbbr = teamAbbr,
                    ),
                )
            }
            "ou" -> {
                val total = ctx.totalLine ?: return emptyList()
                val totalText = formattedLine(total)
                val lines = mutableListOf<OutliersTrendsBettingLine>()
                ctx.totalOverOdds?.let { overOdds ->
                    lines.add(
                        OutliersTrendsBettingLine(
                            id = "$prefix-over",
                            label = "Over",
                            lineText = "Over $totalText",
                            oddsText = formatAmerican(overOdds),
                        ),
                    )
                }
                ctx.totalUnderOdds?.let { underOdds ->
                    lines.add(
                        OutliersTrendsBettingLine(
                            id = "$prefix-under",
                            label = "Under",
                            lineText = "Under $totalText",
                            oddsText = formatAmerican(underOdds),
                        ),
                    )
                }
                if (lines.isEmpty()) {
                    lines.add(
                        OutliersTrendsBettingLine(
                            id = "$prefix-total",
                            label = "Total",
                            lineText = totalText,
                            oddsText = null,
                        ),
                    )
                }
                lines
            }
            "f5_ml" -> {
                val odds = (if (isHome) ctx.f5HomeMl else ctx.f5AwayMl) ?: return emptyList()
                listOf(
                    OutliersTrendsBettingLine(
                        id = "$prefix-f5-ml",
                        label = "1st 5 Moneyline",
                        lineText = "1st 5 ML",
                        oddsText = formatAmerican(odds),
                        teamAbbr = teamAbbr,
                    ),
                )
            }
            "f5_rl" -> {
                val spread = (if (isHome) ctx.f5HomeSpread else ctx.f5AwaySpread) ?: return emptyList()
                val juice = if (isHome) ctx.f5HomeSpreadOdds else ctx.f5AwaySpreadOdds
                listOf(
                    OutliersTrendsBettingLine(
                        id = "$prefix-f5-rl",
                        label = "1st 5 Run Line",
                        lineText = formatSpread(spread),
                        oddsText = juice?.let(::formatAmerican),
                        teamAbbr = teamAbbr,
                    ),
                )
            }
            "f5_ou" -> {
                val total = ctx.f5TotalLine ?: return emptyList()
                val totalText = formattedLine(total)
                val lines = mutableListOf<OutliersTrendsBettingLine>()
                ctx.f5TotalOverOdds?.let { overOdds ->
                    lines.add(
                        OutliersTrendsBettingLine(
                            id = "$prefix-f5-over",
                            label = "Over",
                            lineText = "Over $totalText",
                            oddsText = formatAmerican(overOdds),
                        ),
                    )
                }
                ctx.f5TotalUnderOdds?.let { underOdds ->
                    lines.add(
                        OutliersTrendsBettingLine(
                            id = "$prefix-f5-under",
                            label = "Under",
                            lineText = "Under $totalText",
                            oddsText = formatAmerican(underOdds),
                        ),
                    )
                }
                if (lines.isEmpty()) {
                    lines.add(
                        OutliersTrendsBettingLine(
                            id = "$prefix-f5-total",
                            label = "1st 5 Total",
                            lineText = totalText,
                            oddsText = null,
                        ),
                    )
                }
                lines
            }
            else -> emptyList()
        }
    }

    private fun formatSpread(value: Double): String {
        if (value == Math.round(value).toDouble()) {
            return if (value > 0) "+${value.toInt()}" else "${value.toInt()}"
        }
        val body = String.format(Locale.US, "%.1f", value)
        return if (value > 0) "+$body" else body
    }

    // Swift `Int(value.rounded())` rounds half AWAY from zero (Math.round would pull -110.5 up).
    private fun formatAmerican(value: Double): String {
        val iv = (kotlin.math.sign(value) * kotlin.math.floor(kotlin.math.abs(value) + 0.5)).toInt()
        return if (iv > 0) "+$iv" else "$iv"
    }

    private fun formattedLine(value: Double): String {
        if (value == Math.round(value).toDouble()) return String.format(Locale.US, "%.0f", value)
        return String.format(Locale.US, "%.1f", value)
    }
}
