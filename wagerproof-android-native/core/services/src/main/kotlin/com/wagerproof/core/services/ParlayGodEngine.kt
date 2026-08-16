package com.wagerproof.core.services

import com.wagerproof.core.models.MLBPlayerProps
import com.wagerproof.core.models.MLBPropMatchup
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.models.MLBTrendsSlateBundle
import com.wagerproof.core.models.NFLPlayerProps
import com.wagerproof.core.models.NFLPropPlayer
import com.wagerproof.core.models.NFLTeams
import com.wagerproof.core.models.NFLTrendMatchupRecord
import com.wagerproof.core.models.NFLTrendSplitCell
import com.wagerproof.core.models.NFLTrendsSlateBundle
import com.wagerproof.core.models.OutliersTrendsGame
import com.wagerproof.core.models.ParlayGodCategory
import com.wagerproof.core.models.ParlayGodNFLContext
import com.wagerproof.core.models.ParlayLeg
import com.wagerproof.core.models.ParlaySport
import com.wagerproof.core.models.ParlayTicket
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.Locale
import kotlin.math.abs
import kotlin.math.floor

/**
 * Builds Parlay God legs + tickets from the MLB/NFL trends bundles and the
 * player-props slates. Pure functions — the store feeds it data and caches the
 * output. Port of iOS `WagerproofServices/ParlayGodEngine.swift`; the rules
 * were validated against live data in `.context/parlay_god_demo.py` before that
 * port, so keep all three in sync if tuning constants.
 *
 * No Android APIs here on purpose: [ParlayGodEngineTest] exercises the whole
 * file as a plain JVM unit test.
 */
object ParlayGodEngine {
    // MARK: - Tuning

    /** A streak qualifies at N of N with N >= this. */
    const val MIN_SAMPLE = 3

    /** Steepest juice allowed on a leg (american odds). */
    const val ODDS_FLOOR = -350

    /**
     * Alternate-line legs need a deeper current streak than the base gate —
     * otherwise every heavy alt line qualifies and the category is all chalk.
     */
    const val ALT_LINE_MIN_STREAK = 7

    /** Rail tickets aim for 5 legs; anything under [MIN_LEGS] doesn't render. */
    const val MAX_LEGS = 5
    const val MIN_LEGS = 3

    /**
     * Same-game (matchup widget) tickets are smaller — one game rarely has five
     * independent perfect streaks.
     */
    const val SAME_GAME_MAX_LEGS = 4

    /** Max legs per market per ticket, so a card isn't five "1+ Hits". */
    const val MARKET_CAP = 2

    /**
     * FG spread/total juice isn't stored on `nfl_dryrun_games` — legs on those
     * markets price at the book-standard -110. ML and all H1 markets use real closes.
     */
    const val NFL_DEFAULT_JUICE = -110.0

    // MARK: - Odds math

    fun decimalOdds(american: Int): Double =
        if (american > 0) 1 + american / 100.0 else 1 + 100.0 / -american

    fun americanText(fromDecimal: Double): String {
        if (fromDecimal <= 1) return "-"
        if (fromDecimal >= 2) return "+${roundAwayFromZero((fromDecimal - 1) * 100).toInt()}"
        return "${roundAwayFromZero(-100 / (fromDecimal - 1)).toInt()}"
    }

    fun combinedOddsText(legs: List<ParlayLeg>): String =
        americanText(legs.fold(1.0) { acc, leg -> acc * decimalOdds(leg.odds) })

    private fun oddsOk(odds: Int?): Boolean = odds != null && odds >= ODDS_FLOOR

    // MARK: - Team legs (mlb_team_trends splits + matchups via the Outliers bundle)

    fun teamLegs(bundle: MLBTrendsSlateBundle): List<ParlayLeg> {
        val teamByAbbr = bundle.teams.associateBy { it.teamAbbr }
        val legs = mutableListOf<ParlayLeg>()

        for (game in bundle.games) {
            val ctx = MLBTrendsEngine.gameContext(game)
            val sides = listOf(
                SideSpec("home", game.homeAb, game.awayAb, ctx.homeFavDog),
                SideSpec("away", game.awayAb, game.homeAb, ctx.awayFavDog),
            )
            for ((sideKey, abbr, oppAbbr, roleRaw) in sides) {
                val record = teamByAbbr[abbr] ?: continue

                // Dimension → category, only where today's game matches the context.
                val dims = mutableListOf(
                    DimSpec("overall", ParlayGodCategory.TEAM_FORM, "games"),
                    DimSpec(
                        sideKey,
                        ParlayGodCategory.HOME_AWAY,
                        if (sideKey == "home") "at home" else "on the road",
                    ),
                    DimSpec(
                        ctx.dayNightScope,
                        ParlayGodCategory.DAY_NIGHT,
                        if (ctx.dayNightScope == "day") "day games" else "night games",
                    ),
                )
                if (roleRaw != null) {
                    dims.add(
                        DimSpec(
                            roleRaw,
                            ParlayGodCategory.FAV_DOG,
                            if (roleRaw == "favorite") "as favorite" else "as underdog",
                        ),
                    )
                }

                for (market in MLB_MARKETS) {
                    val marketBlock = record.splits[market] ?: continue
                    for ((dim, category, ctxText) in dims) {
                        val isF5 = market.startsWith("f5_")
                        // F5 is its own category, anchored to overall form only.
                        if (isF5 && dim != "overall") continue
                        val cat = if (isF5) ParlayGodCategory.FIRST_FIVE else category
                        val block = marketBlock[dim] ?: continue
                        val (cell, hitSide) = bestPerfectCell(block) ?: continue
                        makeTeamLeg(
                            game = game,
                            sideKey = sideKey,
                            abbr = abbr,
                            oppAbbr = oppAbbr,
                            market = market,
                            n = cell.n,
                            hits = if (hitSide) cell.h else cell.l,
                            hitSide = hitSide,
                            contextText = ctxText,
                            category = cat,
                        )?.let { legs.add(it) }
                    }
                }

                // H2H record vs today's opponent → Versus Opponent.
                val h2h = matchupRecord(record.matchups, oppAbbr)
                if (h2h != null) {
                    for (market in MLB_H2H_MARKETS) {
                        val cell = h2h.markets[market] ?: continue
                        if (cell.n < MIN_SAMPLE) continue
                        val pct = cell.pct ?: if (cell.n > 0) cell.h.toDouble() / cell.n else 0.0
                        if (pct != 1.0 && pct != 0.0) continue
                        val hitSide = pct == 1.0
                        makeTeamLeg(
                            game = game,
                            sideKey = sideKey,
                            abbr = abbr,
                            oppAbbr = oppAbbr,
                            market = market,
                            n = cell.n,
                            hits = if (hitSide) cell.h else cell.l,
                            hitSide = hitSide,
                            contextText = "vs ${oppAbbr.uppercase()}",
                            category = ParlayGodCategory.VERSUS_OPPONENT,
                        )?.let { legs.add(it) }
                    }
                }
            }
        }
        return legs
    }

    private val MLB_MARKETS = listOf("ml", "rl", "ou", "f5_ml", "f5_rl", "f5_ou")
    private val MLB_H2H_MARKETS = listOf("ml", "rl", "ou")
    private val NFL_MARKETS = listOf("moneyline", "spread", "total", "h1_spread", "h1_total")
    private val NFL_H2H_MARKETS = listOf("moneyline", "spread", "total")

    private data class SideSpec(
        val sideKey: String,
        val abbr: String,
        val oppAbbr: String,
        val role: String?,
    )

    private data class DimSpec(
        val dim: String,
        val category: ParlayGodCategory,
        val contextText: String,
    )

    /** Largest-sample window that went 100% one way (no pushes on the miss side). */
    internal fun bestPerfectCell(block: Map<String, NFLTrendSplitCell>): Pair<NFLTrendSplitCell, Boolean>? {
        var best: Pair<NFLTrendSplitCell, Boolean>? = null
        for (cell in block.values) {
            if (cell.n < MIN_SAMPLE) continue
            val perfectWin = cell.pct == 1.0
            // A perfect LOSING window only counts with zero pushes — a pushed
            // leg would break the "N of N" claim the card makes.
            val perfectLoss = cell.pct == 0.0 && (cell.p ?: 0) == 0
            if (!perfectWin && !perfectLoss) continue
            val side = perfectWin
            val current = best
            if (current == null || cell.n > current.first.n) best = cell to side
        }
        return best
    }

    private fun matchupRecord(
        matchups: Map<String, NFLTrendMatchupRecord>,
        opponent: String,
    ): NFLTrendMatchupRecord? {
        val keys = listOf(opponent.uppercase(), MLBTrendsEngine.trendsAbbr(opponent))
        for (key in keys) matchups[key]?.let { return it }
        return null
    }

    private fun makeTeamLeg(
        game: OutliersTrendsGame,
        sideKey: String,
        abbr: String,
        oppAbbr: String,
        market: String,
        n: Int,
        hits: Int,
        hitSide: Boolean,
        contextText: String,
        category: ParlayGodCategory,
    ): ParlayLeg? {
        val ctx = game.mlbContext ?: return null
        val isHome = sideKey == "home"
        val isF5 = market.startsWith("f5_")
        val base = if (isF5) market.drop(3) else market
        val pfx = if (isF5) "F5 " else ""
        val teamNick = MLBTeams.nickname(if (isHome) game.homeTeam else game.awayTeam)
        val oppNick = MLBTeams.nickname(if (isHome) game.awayTeam else game.homeTeam)

        fun build(
            subject: String,
            subjectAbbr: String,
            bet: String,
            odds: Double?,
            evidence: String,
            backed: String?,
            totalsFam: String? = null,
            totalsSide: String? = null,
        ): ParlayLeg? {
            if (odds == null) return null
            val rounded = roundAwayFromZero(odds).toInt()
            if (!oddsOk(rounded)) return null
            return ParlayLeg(
                kind = ParlayLeg.Kind.TEAM,
                category = category,
                gameKey = game.id,
                matchupLabel = game.label,
                gameTimeEt = game.kickoff,
                subject = subject,
                teamAbbr = subjectAbbr,
                playerId = null,
                betText = bet,
                odds = rounded,
                evidence = evidence,
                streakN = n,
                marketKey = market,
                backedTeamAbbr = backed,
                totalsFamily = totalsFam,
                totalsSide = totalsSide,
            )
        }

        return when (base) {
            "ml" -> {
                val teamOdds = when {
                    isF5 && isHome -> ctx.f5HomeMl
                    isF5 -> ctx.f5AwayMl
                    isHome -> ctx.homeMl
                    else -> ctx.awayMl
                }
                val oppOdds = when {
                    isF5 && isHome -> ctx.f5AwayMl
                    isF5 -> ctx.f5HomeMl
                    isHome -> ctx.awayMl
                    else -> ctx.homeMl
                }
                if (hitSide) {
                    build(
                        subject = teamNick, subjectAbbr = abbr, bet = "$pfx$abbr ML", odds = teamOdds,
                        evidence = "Won $hits straight $contextText", backed = abbr,
                    )
                } else {
                    // Perfect losing streak → back the opponent.
                    build(
                        subject = oppNick, subjectAbbr = oppAbbr, bet = "$pfx$oppAbbr ML", odds = oppOdds,
                        evidence = "$abbr lost $hits straight $contextText", backed = oppAbbr,
                    )
                }
            }

            "rl" -> {
                if (hitSide) {
                    val spread = when {
                        isF5 && isHome -> ctx.f5HomeSpread
                        isF5 -> ctx.f5AwaySpread
                        isHome -> ctx.homeSpread
                        else -> ctx.awaySpread
                    }
                    val juice = when {
                        isF5 && isHome -> ctx.f5HomeSpreadOdds
                        isF5 -> ctx.f5AwaySpreadOdds
                        isHome -> ctx.homeSpreadOdds
                        else -> ctx.awaySpreadOdds
                    }
                    if (spread == null) return null
                    build(
                        subject = teamNick, subjectAbbr = abbr,
                        bet = "$pfx$abbr ${spreadText(spread)}", odds = juice,
                        evidence = "Covered $hits straight $contextText", backed = abbr,
                    )
                } else {
                    val spread = when {
                        isF5 && isHome -> ctx.f5AwaySpread
                        isF5 -> ctx.f5HomeSpread
                        isHome -> ctx.awaySpread
                        else -> ctx.homeSpread
                    }
                    val juice = when {
                        isF5 && isHome -> ctx.f5AwaySpreadOdds
                        isF5 -> ctx.f5HomeSpreadOdds
                        isHome -> ctx.awaySpreadOdds
                        else -> ctx.homeSpreadOdds
                    }
                    if (spread == null) return null
                    build(
                        subject = oppNick, subjectAbbr = oppAbbr,
                        bet = "$pfx$oppAbbr ${spreadText(spread)}", odds = juice,
                        evidence = "$abbr failed to cover $hits straight $contextText", backed = oppAbbr,
                    )
                }
            }

            "ou" -> {
                val total = (if (isF5) ctx.f5TotalLine else ctx.totalLine) ?: return null
                val family = if (isF5) "f5_ou" else "ou"
                if (hitSide) {
                    build(
                        subject = teamNick, subjectAbbr = abbr,
                        bet = "${pfx}Over ${lineText(total)}",
                        odds = if (isF5) ctx.f5TotalOverOdds else ctx.totalOverOdds,
                        evidence = "Over hit $hits straight $abbr $contextText", backed = null,
                        totalsFam = family, totalsSide = "over",
                    )
                } else {
                    build(
                        subject = teamNick, subjectAbbr = abbr,
                        bet = "${pfx}Under ${lineText(total)}",
                        odds = if (isF5) ctx.f5TotalUnderOdds else ctx.totalUnderOdds,
                        evidence = "Under hit $hits straight $abbr $contextText", backed = null,
                        totalsFam = family, totalsSide = "under",
                    )
                }
            }

            else -> null
        }
    }

    private fun spreadText(value: Double): String {
        val body = if (isWhole(value)) value.toInt().toString() else String.format(Locale.US, "%.1f", value)
        return if (value > 0) "+$body" else body
    }

    private fun lineText(value: Double): String =
        if (isWhole(value)) value.toInt().toString() else String.format(Locale.US, "%.1f", value)

    private fun isWhole(value: Double): Boolean = value == floor(value)

    /** Swift's `Double.rounded()` — ties away from zero, not Kotlin's ties-up. */
    internal fun roundAwayFromZero(value: Double): Double =
        if (value < 0) -floor(abs(value) + 0.5) else floor(value + 0.5)

    // MARK: - NFL team legs (nfl_team_trends splits + matchups via the Outliers NFL bundle)

    /**
     * Mirrors [teamLegs] for the NFL slate. Market keys differ from MLB's
     * (moneyline/spread/total vs ml/rl/ou) and H1 replaces F5 as the
     * partial-game category (anchored to overall form, like F5).
     *
     * [nflOdds] is `game_id` → ML/H1 closes; iOS reads the same values off
     * `OutliersTrendsGame.nflContext`, which Android's slate fetch doesn't
     * populate. See [ParlayGodNFLContext].
     */
    fun nflTeamLegs(
        bundle: NFLTrendsSlateBundle,
        nflOdds: Map<String, ParlayGodNFLContext> = emptyMap(),
    ): List<ParlayLeg> {
        val teamByAbbr = bundle.teams.associateBy { it.teamAbbr.uppercase() }
        val legs = mutableListOf<ParlayLeg>()

        for (game in bundle.games) {
            // iOS guards on a non-nil `nflContext`, but its NFL slate decode
            // always builds one (fields just come back null), so a missing
            // lookup here means "no closes", not "skip the game".
            val ctx = nflOdds[game.id] ?: ParlayGodNFLContext.EMPTY
            val homeRole = nflHomeRole(game, ctx)

            val sides = listOf(
                SideSpec("home", game.homeAb, game.awayAb, null),
                SideSpec("away", game.awayAb, game.homeAb, null),
            )
            for ((sideKey, abbr, oppAbbr, _) in sides) {
                val record = teamByAbbr[abbr.uppercase()] ?: continue
                val role = homeRole?.let { home ->
                    if (sideKey == "home") home else if (home == "favorite") "underdog" else "favorite"
                }

                val dims = mutableListOf(
                    DimSpec("overall", ParlayGodCategory.TEAM_FORM, "games"),
                    DimSpec(
                        sideKey,
                        ParlayGodCategory.HOME_AWAY,
                        if (sideKey == "home") "at home" else "on the road",
                    ),
                )
                if (role != null) {
                    dims.add(
                        DimSpec(
                            role,
                            ParlayGodCategory.FAV_DOG,
                            if (role == "favorite") "as favorite" else "as underdog",
                        ),
                    )
                }

                for (market in NFL_MARKETS) {
                    val marketBlock = record.splits[market] ?: continue
                    for ((dim, category, ctxText) in dims) {
                        val isH1 = market.startsWith("h1_")
                        // H1 is its own category, anchored to overall form only.
                        if (isH1 && dim != "overall") continue
                        val cat = if (isH1) ParlayGodCategory.FIRST_HALF else category
                        val block = marketBlock[dim] ?: continue
                        val (cell, hitSide) = bestPerfectCell(block) ?: continue
                        makeNFLTeamLeg(
                            game = game,
                            ctx = ctx,
                            sideKey = sideKey,
                            abbr = abbr,
                            oppAbbr = oppAbbr,
                            market = market,
                            n = cell.n,
                            hits = if (hitSide) cell.h else cell.l,
                            hitSide = hitSide,
                            contextText = ctxText,
                            category = cat,
                        )?.let { legs.add(it) }
                    }
                }

                // H2H record vs today's opponent → Versus Opponent.
                val h2h = record.matchups[oppAbbr.uppercase()]
                if (h2h != null) {
                    for (market in NFL_H2H_MARKETS) {
                        val cell = h2h.markets[market] ?: continue
                        if (cell.n < MIN_SAMPLE) continue
                        val pct = cell.pct ?: if (cell.n > 0) cell.h.toDouble() / cell.n else 0.0
                        if (pct != 1.0 && pct != 0.0) continue
                        val hitSide = pct == 1.0
                        makeNFLTeamLeg(
                            game = game,
                            ctx = ctx,
                            sideKey = sideKey,
                            abbr = abbr,
                            oppAbbr = oppAbbr,
                            market = market,
                            n = cell.n,
                            hits = if (hitSide) cell.h else cell.l,
                            hitSide = hitSide,
                            contextText = "vs ${oppAbbr.uppercase()}",
                            category = ParlayGodCategory.VERSUS_OPPONENT,
                        )?.let { legs.add(it) }
                    }
                }
            }
        }
        return legs
    }

    /**
     * Favorite/underdog from ML closes, falling back to the spread sign
     * (`fg_spread_close` is home-relative: negative = home favored).
     */
    private fun nflHomeRole(game: OutliersTrendsGame, ctx: ParlayGodNFLContext): String? {
        val home = ctx.homeMl
        val away = ctx.awayMl
        if (home != null && away != null && home != away) {
            return if (home < away) "favorite" else "underdog"
        }
        val spread = game.fgSpreadClose
        if (spread != null && spread != 0.0) {
            return if (spread < 0) "favorite" else "underdog"
        }
        return null
    }

    private fun makeNFLTeamLeg(
        game: OutliersTrendsGame,
        ctx: ParlayGodNFLContext,
        sideKey: String,
        abbr: String,
        oppAbbr: String,
        market: String,
        n: Int,
        hits: Int,
        hitSide: Boolean,
        contextText: String,
        category: ParlayGodCategory,
    ): ParlayLeg? {
        val isHome = sideKey == "home"
        val isH1 = market.startsWith("h1_")
        val pfx = if (isH1) "1H " else ""
        val teamNick = NFLTeams.nickname(if (isHome) game.homeTeam else game.awayTeam)
        val oppNick = NFLTeams.nickname(if (isHome) game.awayTeam else game.homeTeam)

        fun build(
            subject: String,
            subjectAbbr: String,
            bet: String,
            odds: Double?,
            evidence: String,
            backed: String?,
            totalsFam: String? = null,
            totalsSide: String? = null,
        ): ParlayLeg? {
            if (odds == null) return null
            val rounded = roundAwayFromZero(odds).toInt()
            if (!oddsOk(rounded)) return null
            return ParlayLeg(
                kind = ParlayLeg.Kind.TEAM,
                sport = ParlaySport.NFL,
                category = category,
                gameKey = game.id,
                matchupLabel = game.label,
                gameTimeEt = game.kickoff,
                subject = subject,
                teamAbbr = subjectAbbr,
                playerId = null,
                betText = bet,
                odds = rounded,
                evidence = evidence,
                streakN = n,
                marketKey = market,
                backedTeamAbbr = backed,
                totalsFamily = totalsFam,
                totalsSide = totalsSide,
            )
        }

        return when (market) {
            "moneyline" -> {
                val teamOdds = if (isHome) ctx.homeMl else ctx.awayMl
                val oppOdds = if (isHome) ctx.awayMl else ctx.homeMl
                if (hitSide) {
                    build(
                        subject = teamNick, subjectAbbr = abbr, bet = "$abbr ML", odds = teamOdds,
                        evidence = "Won $hits straight $contextText", backed = abbr,
                    )
                } else {
                    // Perfect losing streak → back the opponent.
                    build(
                        subject = oppNick, subjectAbbr = oppAbbr, bet = "$oppAbbr ML", odds = oppOdds,
                        evidence = "$abbr lost $hits straight $contextText", backed = oppAbbr,
                    )
                }
            }

            "spread", "h1_spread" -> {
                // Close is home-relative; flip for the away side.
                val close = (if (isH1) ctx.h1SpreadClose else game.fgSpreadClose) ?: return null
                if (hitSide) {
                    val spread = if (isHome) close else -close
                    val juice = when {
                        !isH1 -> NFL_DEFAULT_JUICE
                        isHome -> ctx.h1SpreadHomePrice
                        else -> ctx.h1SpreadAwayPrice
                    }
                    build(
                        subject = teamNick, subjectAbbr = abbr,
                        bet = "$pfx$abbr ${spreadText(spread)}", odds = juice,
                        evidence = "Covered $hits straight $contextText", backed = abbr,
                    )
                } else {
                    val spread = if (isHome) -close else close
                    val juice = when {
                        !isH1 -> NFL_DEFAULT_JUICE
                        isHome -> ctx.h1SpreadAwayPrice
                        else -> ctx.h1SpreadHomePrice
                    }
                    build(
                        subject = oppNick, subjectAbbr = oppAbbr,
                        bet = "$pfx$oppAbbr ${spreadText(spread)}", odds = juice,
                        evidence = "$abbr failed to cover $hits straight $contextText", backed = oppAbbr,
                    )
                }
            }

            "total", "h1_total" -> {
                val total = (if (isH1) ctx.h1TotalClose else game.fgTotalClose) ?: return null
                val family = if (isH1) "h1_total" else "total"
                if (hitSide) {
                    build(
                        subject = teamNick, subjectAbbr = abbr,
                        bet = "${pfx}Over ${lineText(total)}",
                        odds = if (isH1) ctx.h1TotalOverPrice else NFL_DEFAULT_JUICE,
                        evidence = "Over hit $hits straight $abbr $contextText", backed = null,
                        totalsFam = family, totalsSide = "over",
                    )
                } else {
                    build(
                        subject = teamNick, subjectAbbr = abbr,
                        bet = "${pfx}Under ${lineText(total)}",
                        odds = if (isH1) ctx.h1TotalUnderPrice else NFL_DEFAULT_JUICE,
                        evidence = "Under hit $hits straight $abbr $contextText", backed = null,
                        totalsFam = family, totalsSide = "under",
                    )
                }
            }

            else -> null
        }
    }

    // MARK: - Prop legs (props slate via get_mlb_player_props_l10)

    fun propLegs(matchups: List<MLBPropMatchup>): List<ParlayLeg> {
        val legs = mutableListOf<ParlayLeg>()
        for (matchup in matchups) {
            val gameKey = matchup.gamePk.toString()
            val label = "${matchup.awayAbbr} @ ${matchup.homeAbbr}"
            val teamByPlayer = mutableMapOf<Int, String>()
            for (row in matchup.homeLineup) teamByPlayer[row.playerId] = matchup.homeAbbr
            for (row in matchup.awayLineup) teamByPlayer[row.playerId] = matchup.awayAbbr
            teamByPlayer[matchup.homeStarter.pitcherId] = matchup.homeAbbr
            teamByPlayer[matchup.awayStarter.pitcherId] = matchup.awayAbbr

            for (row in matchup.props) {
                val name = shortName(row.playerName)
                val teamAbbr = teamByPlayer[row.playerId]

                fun propLeg(
                    category: ParlayGodCategory,
                    line: Double,
                    over: Boolean,
                    odds: Int?,
                    evidence: String,
                    n: Int,
                ): ParlayLeg? {
                    val price = odds ?: return null
                    if (!oddsOk(price)) return null
                    return ParlayLeg(
                        kind = ParlayLeg.Kind.PROP,
                        category = category,
                        gameKey = gameKey,
                        matchupLabel = label,
                        gameTimeEt = matchup.gameTimeEt,
                        subject = name,
                        teamAbbr = teamAbbr,
                        playerId = row.playerId,
                        betText = propBetText(row.market, line, over),
                        odds = price,
                        evidence = evidence,
                        streakN = n,
                        marketKey = row.market,
                    )
                }

                val defaultLine = MLBPlayerProps.defaultLine(row.lines) ?: continue
                val entry = row.lines.firstOrNull { it.line == defaultLine } ?: continue

                // Recent Form — every one of the last (up to) 10 on one side of the line.
                val recent = row.games.take(10)
                if (recent.size >= MIN_SAMPLE) {
                    if (recent.all { it.v > defaultLine }) {
                        propLeg(
                            category = ParlayGodCategory.RECENT_FORM, line = defaultLine, over = true,
                            odds = entry.over, evidence = "Hit in ${recent.size} straight games",
                            n = recent.size,
                        )?.let { legs.add(it) }
                    } else if (recent.all { it.v < defaultLine }) {
                        propLeg(
                            category = ParlayGodCategory.RECENT_FORM, line = defaultLine, over = false,
                            odds = entry.under, evidence = "Stayed under in ${recent.size} straight",
                            n = recent.size,
                        )?.let { legs.add(it) }
                    }
                }

                // Day/Night — perfect in today's slot.
                val dayFlag = if (row.gameIsDay) 1 else 0
                val slotGames = row.games.filter { it.d == dayFlag }.take(10)
                if (slotGames.size >= MIN_SAMPLE && slotGames.all { it.v > defaultLine }) {
                    val slot = if (row.gameIsDay) "day" else "night"
                    propLeg(
                        category = ParlayGodCategory.DAY_NIGHT, line = defaultLine, over = true,
                        odds = entry.over, evidence = "Hit in all ${slotGames.size} $slot games",
                        n = slotGames.size,
                    )?.let { legs.add(it) }
                }

                // vs Arm Type — perfect against today's opposing-starter archetype.
                val arch = row.oppArchetypeToday
                if (!row.isPitcher && arch != null) {
                    val archGames = row.games.filter { it.a == arch }.take(10)
                    if (archGames.size >= MIN_SAMPLE && archGames.all { it.v > defaultLine }) {
                        propLeg(
                            category = ParlayGodCategory.ARM_TYPE, line = defaultLine, over = true,
                            odds = entry.over,
                            evidence = "Hit in all ${archGames.size} vs ${arch.lowercase()} arms",
                            n = archGames.size,
                        )?.let { legs.add(it) }
                    }
                }

                // Alternate Lines — a non-default ladder line riding a deep live streak.
                for (alt in row.lines) {
                    if (alt.line == defaultLine) continue
                    if (!oddsOk(alt.over)) continue
                    var streak = 0
                    for (g in row.games) {
                        if (g.v > alt.line) streak += 1 else break
                    }
                    if (streak >= ALT_LINE_MIN_STREAK) {
                        propLeg(
                            category = ParlayGodCategory.ALTERNATE_LINES, line = alt.line, over = true,
                            odds = alt.over, evidence = "Hit in $streak straight games", n = streak,
                        )?.let { legs.add(it) }
                    }
                }
            }
        }
        return legs
    }

    // MARK: - NFL prop legs (nfl_dryrun_props via PropsStore)

    /**
     * Legs for one NFL matchup's props. NFL legs are built per-game for the
     * matchup widget only — the dry-run slate's dates would pollute the live
     * cross-game rails until the in-season cutover.
     */
    fun nflPropLegs(players: List<NFLPropPlayer>): List<ParlayLeg> {
        val legs = mutableListOf<ParlayLeg>()
        for (player in players) {
            val team = player.team ?: continue
            val opponent = player.opponent ?: continue
            val label = if (player.isHome == true) "$opponent @ $team" else "$team @ $opponent"
            val name = shortName(player.playerName)

            for (market in player.markets) {
                val line = market.closeLine ?: continue // ATD yes-markets have no line
                val games = market.recentGames.mapNotNull { it.actual } // oldest → newest
                val recent = games.takeLast(10)
                val marketLabel = NFLPlayerProps.marketLabel(market.market)

                fun nflLeg(
                    category: ParlayGodCategory,
                    over: Boolean,
                    odds: Int?,
                    evidence: String,
                    n: Int,
                ): ParlayLeg? {
                    val price = odds ?: return null
                    if (!oddsOk(price)) return null
                    return ParlayLeg(
                        kind = ParlayLeg.Kind.PROP,
                        sport = ParlaySport.NFL,
                        category = category,
                        gameKey = player.gameId,
                        matchupLabel = label,
                        gameTimeEt = player.kickoff ?: player.gameDate.takeIf { it.isNotEmpty() },
                        subject = name,
                        teamAbbr = team,
                        playerId = null,
                        headshotUrl = player.headshotUrl,
                        betText = "${if (over) "Over" else "Under"} ${lineText(line)} $marketLabel",
                        odds = price,
                        evidence = evidence,
                        streakN = n,
                        marketKey = market.market,
                    )
                }

                if (recent.size >= MIN_SAMPLE) {
                    if (recent.all { it > line }) {
                        nflLeg(
                            category = ParlayGodCategory.RECENT_FORM, over = true, odds = market.overPrice,
                            evidence = "Hit in ${recent.size} straight games", n = recent.size,
                        )?.let { legs.add(it) }
                    } else if (recent.all { it < line }) {
                        nflLeg(
                            category = ParlayGodCategory.RECENT_FORM, over = false, odds = market.underPrice,
                            evidence = "Stayed under in ${recent.size} straight", n = recent.size,
                        )?.let { legs.add(it) }
                    }
                }

                val vsOpp = market.recentGames
                    .filter { it.opp?.uppercase() == opponent.uppercase() }
                    .mapNotNull { it.actual }
                if (vsOpp.size >= MIN_SAMPLE && vsOpp.all { it > line }) {
                    nflLeg(
                        category = ParlayGodCategory.VERSUS_OPPONENT, over = true, odds = market.overPrice,
                        evidence = "Hit in all ${vsOpp.size} vs ${opponent.uppercase()}", n = vsOpp.size,
                    )?.let { legs.add(it) }
                }
            }
        }
        return legs
    }

    internal fun shortName(full: String): String {
        val parts = full.split(" ").filter { it.isNotEmpty() }
        if (parts.size <= 1) return full
        val first = parts.first().firstOrNull() ?: return full
        return "$first. ${parts.drop(1).joinToString(" ")}"
    }

    internal fun propBetText(market: String, line: Double, over: Boolean): String {
        val label = MLBPlayerProps.marketLabel(market)
        if (over) {
            // ".5" lines read as thresholds: Over 0.5 Hits → "1+ Hits".
            if (!isWhole(line)) return "${line.toInt() + 1}+ $label"
            return "Over ${lineText(line)} $label"
        }
        return "Under ${lineText(line)} $label"
    }

    // MARK: - Assembly

    /**
     * Greedy best-first fill honoring: unique subject, unique (game, subject, bet),
     * optional one-leg-per-game, market diversity cap, and conflict rules
     * (opposite totals sides, same-game legs backing different teams).
     * `uniqueSubjects = false` for same-game tickets — a game only has two team
     * subjects, and "NYY ML + F5 NYY ML + Over 8.5" is a legitimate SGP.
     */
    fun assemble(
        pool: List<ParlayLeg>,
        maxLegs: Int = MAX_LEGS,
        onePerGame: Boolean,
        uniqueSubjects: Boolean = true,
        excluding: Set<String> = emptySet(),
    ): List<ParlayLeg> {
        val sorted = pool.sortedWith(
            compareByDescending<ParlayLeg> { it.streakN }
                .thenByDescending { it.odds }
                .thenBy { it.id },
        )
        val chosen = mutableListOf<ParlayLeg>()
        val subjects = mutableSetOf<String>()
        val gamesUsed = mutableSetOf<String>()
        val betsSeen = mutableSetOf<String>()
        val marketCounts = mutableMapOf<String, Int>()

        for (leg in sorted) {
            val betKey = exclusionKey(leg)
            if (betKey in excluding) continue
            if (betKey in betsSeen) continue
            if (uniqueSubjects && leg.subject in subjects) continue
            if (onePerGame && leg.gameKey in gamesUsed) continue
            if ((marketCounts[leg.marketKey] ?: 0) >= MARKET_CAP) continue
            if (chosen.any { conflicts(it, leg) }) continue
            chosen.add(leg)
            subjects.add(leg.subject)
            gamesUsed.add(leg.gameKey)
            betsSeen.add(betKey)
            marketCounts[leg.marketKey] = (marketCounts[leg.marketKey] ?: 0) + 1
            if (chosen.size == maxLegs) break
        }
        return chosen
    }

    internal fun conflicts(a: ParlayLeg, b: ParlayLeg): Boolean {
        if (a.gameKey != b.gameKey) return false
        val fa = a.totalsFamily
        if (fa != null && fa == b.totalsFamily && a.totalsSide != b.totalsSide) return true
        val ta = a.backedTeamAbbr
        val tb = b.backedTeamAbbr
        if (ta != null && tb != null && ta != tb) return true
        return false
    }

    fun exclusionKey(leg: ParlayLeg): String = "${leg.gameKey}|${leg.subject}|${leg.betText}"

    // MARK: - Ticket building

    /**
     * One themed 5-leg ticket per category — cross-game, game markets ONLY:
     * Parlay God mirrors the Outliers page's markets (MLB ML/RL/totals/F5,
     * NFL ML/spread/totals/H1); player props are Props Cheats territory on the
     * Props tab. Sports whose slates are concurrently LIVE merge into one
     * cross-sport card per category (cross-sport parlays are placeable); stale
     * slates — e.g. the NFL dry-run's past dates — keep their own per-sport card
     * so a merged ticket is never a fictional bet. Categories that can't field
     * [MIN_LEGS] today are dropped — thin days shrink the rail.
     */
    fun slateTickets(pool: List<ParlayLeg>, now: Instant = Instant.now()): List<ParlayTicket> =
        buildCategoryTickets(
            pool = pool.filter { it.kind == ParlayLeg.Kind.TEAM },
            idPrefix = "slate",
            onePerGame = true,
            now = now,
        )

    /** Player-prop legs only — the "Props Cheats" rail. */
    fun propsTickets(pool: List<ParlayLeg>, now: Instant = Instant.now()): List<ParlayTicket> =
        buildCategoryTickets(
            pool = pool.filter { it.kind == ParlayLeg.Kind.PROP },
            idPrefix = "props",
            onePerGame = false,
            now = now,
        )

    /**
     * Sports that currently field at least one ticket — drives the rail
     * header's "Supports" icon cluster.
     */
    fun sports(tickets: List<ParlayTicket>): List<ParlaySport> {
        val present = tickets.flatMap { it.sports }.toSet()
        return ParlaySport.displayOrder.filter { it in present }
    }

    // MARK: - Slate liveness

    /**
     * A sport's slate is live when any of its legs' games hasn't long started
     * (6h grace keeps the day's slate merged through the last first pitch).
     * Dry-run slates — entirely past dates — fail, as do legs with no parseable
     * kickoff.
     */
    internal fun liveSports(pool: List<ParlayLeg>, now: Instant): Set<ParlaySport> {
        val cutoff = now.minusSeconds(6 * 3600)
        val live = mutableSetOf<ParlaySport>()
        for (leg in pool) {
            if (leg.sport in live) continue
            val start = kickoffDate(leg.gameTimeEt) ?: continue
            if (!start.isBefore(cutoff)) live.add(leg.sport)
        }
        return live
    }

    internal fun kickoffDate(raw: String?): Instant? {
        if (raw.isNullOrEmpty()) return null
        // ISO_OFFSET_DATE_TIME covers fractional + non-fractional seconds (Swift
        // tried both ISO8601DateFormatter option sets). Pure parsing, no
        // suspension — plain try/catch is safe here.
        try {
            return OffsetDateTime.parse(raw).toInstant()
        } catch (_: Exception) {
            // fall through to the date-only form
        }
        // Date-only fallback ("2026-07-20") → noon ET that day.
        return try {
            LocalDate.parse(raw).atStartOfDay(ServiceDates.ET).plusHours(12).toInstant()
        } catch (_: Exception) {
            null
        }
    }

    private fun buildCategoryTickets(
        pool: List<ParlayLeg>,
        idPrefix: String,
        onePerGame: Boolean,
        now: Instant,
    ): List<ParlayTicket> {
        // Liveness is per sport over the WHOLE pool (not per category) so a
        // sport can't be merged in one card and separate in the next.
        val live = liveSports(pool, now)
        val byCategory = pool.groupBy { it.category }
        val tickets = mutableListOf<ParlayTicket>()
        for (category in ParlayGodCategory.displayOrder) {
            val categoryLegs = byCategory[category] ?: continue
            // Merged live pool first, then one pool per stale sport.
            val pools = mutableListOf<List<ParlayLeg>>()
            val liveLegs = categoryLegs.filter { it.sport in live }
            if (liveLegs.isNotEmpty()) pools.add(liveLegs)
            for (sport in ParlaySport.displayOrder) {
                if (sport in live) continue
                val sportLegs = categoryLegs.filter { it.sport == sport }
                if (sportLegs.isNotEmpty()) pools.add(sportLegs)
            }
            for (legPool in pools) {
                val chosen = assemble(legPool, maxLegs = MAX_LEGS, onePerGame = onePerGame)
                if (chosen.size < MIN_LEGS) continue
                val sports = ParlaySport.displayOrder.filter { sport -> chosen.any { it.sport == sport } }
                tickets.add(
                    ParlayTicket(
                        id = "$idPrefix-${sports.joinToString("+") { it.raw }}-${category.raw}",
                        sports = sports,
                        category = category,
                        legs = chosen,
                        combinedOddsText = combinedOddsText(chosen),
                    ),
                )
            }
        }
        return tickets
    }

    /**
     * Up to [maxCards] same-game tickets for one matchup, mixing team + prop
     * legs across categories. Later cards exclude earlier cards' bets.
     */
    fun gameTickets(
        pool: List<ParlayLeg>,
        gameKey: String,
        maxCards: Int = 3,
    ): List<ParlayTicket> {
        val gamePool = pool.filter { it.gameKey == gameKey }
        val used = mutableSetOf<String>()
        val tickets = mutableListOf<ParlayTicket>()
        for (index in 0 until maxCards) {
            val chosen = assemble(
                gamePool,
                maxLegs = SAME_GAME_MAX_LEGS,
                onePerGame = false,
                uniqueSubjects = false,
                excluding = used,
            )
            if (chosen.size < MIN_LEGS) break
            tickets.add(
                ParlayTicket(
                    id = "game-$gameKey-$index",
                    sports = listOf(chosen[0].sport),
                    category = chosen[0].category,
                    legs = chosen,
                    combinedOddsText = combinedOddsText(chosen),
                ),
            )
            used.addAll(chosen.map { exclusionKey(it) })
        }
        return tickets
    }
}
