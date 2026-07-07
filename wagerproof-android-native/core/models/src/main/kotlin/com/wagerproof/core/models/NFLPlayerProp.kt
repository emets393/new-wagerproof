package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.Locale
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.round
import kotlin.math.sign

// MARK: - Raw table rows (NFL dry-run data contract)

/**
 * One entry of a prop row's `recent_games` JSON array — the player's actual
 * stat in one prior game this season (walk-forward, point-in-time).
 * camelCase wire keys on purpose (opp/week/actual).
 */
@Serializable
data class NFLPropRecentGame(
    val opp: String? = null,
    val week: Int? = null,
    val actual: Double? = null,
)

/** Precomputed best-shop quote for one side (over, under, or yes-ATD). Client-only, not serialized. */
data class NFLPropBestQuote(
    val bookKey: String? = null,
    val bookName: String? = null,
    val bookLogoUrl: String? = null,
    val line: Double? = null,
    val price: Int? = null,
) {
    val isEmpty: Boolean
        get() = bookKey == null && bookName == null && bookLogoUrl == null && line == null && price == null
}

/**
 * One row of `nfl_dryrun_props` (CFB/research Supabase): a single
 * player × market with the consensus close line/prices (median across books),
 * season game-log trends, defense-matchup context, and fired P-flags.
 * See the "NFL Week 12 2025 Dry Run — App Data Contract" doc — the 2026
 * in-season tables will follow this same shape. Non-tolerant on purpose,
 * matching Swift's synthesized Decodable.
 */
@Serializable
data class NFLDryrunPropRow(
    @SerialName("game_id") val gameId: String,
    @SerialName("event_id") val eventId: String? = null,
    val season: Int? = null,
    val week: Int? = null,
    @SerialName("player_id") val playerId: String? = null,
    @SerialName("player_name") val playerName: String,
    val position: String? = null,
    val team: String? = null,
    val opponent: String? = null,
    @SerialName("is_home") val isHome: Boolean? = null,
    val market: String,
    @SerialName("close_line") val closeLine: Double? = null,
    /** American odds; consensus medians can land on half-cents (e.g. -112.5). */
    @SerialName("over_price") val overPrice: Double? = null,
    @SerialName("under_price") val underPrice: Double? = null,
    @SerialName("open_line") val openLine: Double? = null,
    @SerialName("line_delta") val lineDelta: Double? = null,
    @SerialName("line_range") val lineRange: Double? = null,
    @SerialName("n_books") val nBooks: Int? = null,
    /** Yes/no markets (anytime TD): implied probability at close / open. */
    @SerialName("close_yes_prob") val closeYesProb: Double? = null,
    @SerialName("open_yes_prob") val openYesProb: Double? = null,
    @SerialName("gp_prior") val gpPrior: Int? = null,
    @SerialName("last_game") val lastGame: Double? = null,
    @SerialName("l3_avg") val l3Avg: Double? = null,
    @SerialName("l5_avg") val l5Avg: Double? = null,
    @SerialName("l10_avg") val l10Avg: Double? = null,
    @SerialName("szn_avg") val sznAvg: Double? = null,
    @SerialName("szn_max") val sznMax: Double? = null,
    @SerialName("szn_min") val sznMin: Double? = null,
    @SerialName("over_rate_l5") val overRateL5: Double? = null,
    @SerialName("over_rate_l10") val overRateL10: Double? = null,
    @SerialName("recent_games") val recentGames: List<NFLPropRecentGame>? = null,
    @SerialName("def_allowed_pos") val defAllowedPos: Double? = null,
    @SerialName("lg_allowed_pos") val lgAllowedPos: Double? = null,
    @SerialName("def_matchup_idx") val defMatchupIdx: Double? = null,
    @SerialName("report_status") val reportStatus: String? = null,
    @SerialName("practice_status") val practiceStatus: String? = null,
    val flags: List<String>? = null,
    @SerialName("headshot_url") val headshotUrl: String? = null,
    @SerialName("best_over_book") val bestOverBook: String? = null,
    @SerialName("best_over_book_name") val bestOverBookName: String? = null,
    @SerialName("best_over_book_logo") val bestOverBookLogo: String? = null,
    @SerialName("best_over_line") val bestOverLine: Double? = null,
    @SerialName("best_over_price") val bestOverPrice: Double? = null,
    @SerialName("best_under_book") val bestUnderBook: String? = null,
    @SerialName("best_under_book_name") val bestUnderBookName: String? = null,
    @SerialName("best_under_book_logo") val bestUnderBookLogo: String? = null,
    @SerialName("best_under_line") val bestUnderLine: Double? = null,
    @SerialName("best_under_price") val bestUnderPrice: Double? = null,
)

/**
 * Matchup context joined from `nfl_dryrun_games` (kickoff day + slot) —
 * props rows only carry the `game_id`.
 */
data class NFLPropGameContext(
    val gameDate: String,
    val slot: String?,
)

// MARK: - Grouped models

/**
 * One market for a player: consensus close line + prices, the season trend
 * behind it, and any fired P-flags. Yes/no markets (anytime TD) carry an
 * implied probability instead of a line. Client-built, not serialized.
 */
data class NFLPropMarket(
    val market: String,
    val closeLine: Double?,
    val openLine: Double?,
    val lineDelta: Double?,
    val lineRange: Double?,
    val overPrice: Int?,
    val underPrice: Int?,
    val nBooks: Int?,
    val closeYesProb: Double?,
    val openYesProb: Double?,
    val lastGame: Double?,
    val l3Avg: Double?,
    val l5Avg: Double?,
    val l10Avg: Double?,
    val sznAvg: Double?,
    val sznMax: Double?,
    val sznMin: Double?,
    val overRateL5: Double?,
    val overRateL10: Double?,
    val defMatchupIdx: Double?,
    val flags: List<String>,
    /** Oldest → newest (as stored). */
    val recentGames: List<NFLPropRecentGame>,
    /** Precomputed best-shop over (or yes-ATD) and under quotes from the loader. */
    val bestOver: NFLPropBestQuote = NFLPropBestQuote(),
    val bestUnder: NFLPropBestQuote = NFLPropBestQuote(),
) {
    data class MiniStripEntry(val cleared: Boolean, val value: Double)

    data class L10Hits(val hits: Int, val n: Int)

    val id: String get() = market
    val label: String get() = NFLPlayerProps.marketLabel(market)

    /** Anytime-TD-style market: no posted line, the price is a yes-price. */
    val isYesNo: Boolean get() = closeLine == null

    val hasBestBooks: Boolean get() = !bestOver.isEmpty || !bestUnder.isEmpty

    /** The threshold a game "clears": the posted line, or ≥1 for yes/no markets (scored a TD). */
    val clearThreshold: Double get() = closeLine ?: 0.5

    /** Last-10 strip for the feed card, oldest → newest. */
    val miniStrip: List<MiniStripEntry>
        get() = recentGames.takeLast(10).mapNotNull { g ->
            g.actual?.let { MiniStripEntry(cleared = it > clearThreshold, value = it) }
        }

    /**
     * L10 hit count vs the close line, computed from the game log so the
     * fraction always matches the strip (the server's `over_rate_l10` is
     * line-at-snapshot and can drift from the close).
     */
    val l10Hits: L10Hits
        get() {
            val games = recentGames.takeLast(10).mapNotNull { it.actual }
            return L10Hits(games.count { it > clearThreshold }, games.size)
        }

    val l10HitRate: Double?
        get() {
            val (hits, n) = l10Hits
            if (n <= 0) return null
            return hits.toDouble() / n.toDouble()
        }
}

/**
 * One player's full prop slate for one game — the Tier-1 entity behind the
 * NFL props feed card and detail page. Client-built, not serialized.
 */
data class NFLPropPlayer(
    val playerName: String,
    val playerId: String?,
    /** Official NFL CDN photo, baked onto every props row. */
    val headshotUrl: String?,
    /** Team / opponent abbreviations ("SEA", "TEN"). */
    val team: String?,
    val opponent: String?,
    val isHome: Boolean?,
    val position: String?,
    val gameId: String,
    val eventId: String?,
    /** `gameday` from `nfl_dryrun_games`; empty when the join misses. */
    val gameDate: String,
    /** Schedule slot key (thu_fri / sun_early / sun_late_sat / snf / monday). */
    val slot: String?,
    val week: Int?,
    /** Slate season from `nfl_dryrun_props` (e.g. 2025 dry-run week). */
    val season: Int? = null,
    val reportStatus: String?,
    val practiceStatus: String?,
    /** Markets ordered by `NFLPlayerProps.marketOrder` (then alphabetically). */
    val markets: List<NFLPropMarket>,
) {
    val id: String get() = "$gameId-${playerId ?: playerName}"

    /**
     * Headline market for the feed card — a flagged market wins, otherwise
     * the first in priority order (flags are the contract's badge layer).
     */
    val headlineMarket: NFLPropMarket?
        get() = markets.firstOrNull { it.flags.isNotEmpty() } ?: markets.firstOrNull()

    /** All fired P-flags across this player's markets. */
    val allFlags: List<String>
        get() = markets.flatMap { it.flags }

    /** "vs BUF" / "@ KC". */
    val opponentLabel: String
        get() {
            val opp = opponent
            if (opp.isNullOrEmpty()) return ""
            return if (isHome == true) "vs $opp" else "@ $opp"
        }

    val slotLabel: String? get() = NFLPlayerProps.slotLabel(slot)

    /** Chronological key: gameday first, then schedule-slot order within it. */
    val sortKey: String
        get() = "$gameDate-${NFLPlayerProps.slotOrder(slot)}"
}

// MARK: - Helpers

object NFLPlayerProps {
    /**
     * Display order for the markets the dry-run publishes; unknown keys sort
     * after, alphabetically, so new server-side markets degrade gracefully.
     */
    internal val marketOrder: List<String> = listOf(
        "player_pass_yds", "player_pass_tds", "player_pass_attempts", "player_pass_completions",
        "player_rush_yds", "player_rush_attempts",
        "player_reception_yds", "player_receptions", "player_anytime_td",
    )

    internal val marketLabels: Map<String, String> = mapOf(
        "player_pass_yds" to "Pass Yards",
        "player_pass_tds" to "Pass TDs",
        "player_pass_attempts" to "Pass Attempts",
        "player_pass_completions" to "Completions",
        "player_pass_interceptions" to "Interceptions",
        "player_rush_yds" to "Rush Yards",
        "player_rush_attempts" to "Rush Attempts",
        "player_rush_tds" to "Rush TDs",
        "player_reception_yds" to "Rec Yards",
        "player_receptions" to "Receptions",
        "player_reception_tds" to "Rec TDs",
        "player_anytime_td" to "Anytime TD",
        "player_kicking_points" to "Kicking Points",
        "player_field_goals" to "Field Goals",
        "player_sacks" to "Sacks",
        "player_tackles_assists" to "Tackles + Ast",
    )

    fun marketLabel(market: String): String {
        marketLabels[market]?.let { return it }
        // "player_some_stat" → "Some Stat"
        return market
            .replace("player_", "")
            .split("_")
            .filter { it.isNotEmpty() }
            .joinToString(" ") { it.take(1).uppercase() + it.drop(1) }
    }

    fun marketSortIndex(market: String): Int =
        marketOrder.indexOf(market).takeIf { it >= 0 } ?: 999

    /** Same American-odds convention as the MLB props surfaces. */
    fun formatOdds(odds: Int?): String {
        if (odds == null) return "-"
        return if (odds > 0) "+$odds" else "$odds"
    }

    fun formatLine(line: Double?): String {
        if (line == null || !line.isFinite()) return "-"
        return if (line == round(line)) line.toInt().toString()
        else String.format(Locale.US, "%.1f", line)
    }

    /** "0.62" → "62%". */
    fun formatPct(p: Double?): String {
        if (p == null || !p.isFinite()) return "-"
        return "${roundedAwayFromZero(p * 100)}%"
    }

    // MARK: Schedule slots

    internal val slotLabels: Map<String, String> = mapOf(
        "thu_fri" to "Thu/Fri",
        "sun_early" to "Sun Early",
        "sun_late_sat" to "Sun Late",
        "snf" to "SNF",
        "monday" to "MNF",
    )

    internal val slotSequence: List<String> = listOf("thu_fri", "sun_early", "sun_late_sat", "snf", "monday")

    fun slotLabel(slot: String?): String? {
        if (slot == null) return null
        slotLabels[slot]?.let { return it }
        // Swift .capitalized: each word first-uppercased, rest lowercased.
        return slot.replace("_", " ")
            .split(" ")
            .joinToString(" ") { w -> w.lowercase().replaceFirstChar { it.uppercase() } }
    }

    fun slotOrder(slot: String?): Int {
        if (slot == null) return 9
        return slotSequence.indexOf(slot).takeIf { it >= 0 } ?: 9
    }

    /** Fallback best-shop payload keyed by `player_id|market` when DB columns are absent. */
    data class NFLPropBestBooksFallback(
        val bestOverBook: String? = null,
        val bestOverBookName: String? = null,
        val bestOverBookLogo: String? = null,
        val bestOverLine: Double? = null,
        val bestOverPrice: Double? = null,
        val bestUnderBook: String? = null,
        val bestUnderBookName: String? = null,
        val bestUnderBookLogo: String? = null,
        val bestUnderLine: Double? = null,
        val bestUnderPrice: Double? = null,
    )

    // MARK: Grouping

    /**
     * Group raw (player, market) rows into per-player entities. Markets
     * follow `marketOrder`; players come back sorted by gameday → schedule
     * slot → name (feed-ready). `games` joins kickoff context by `game_id`.
     */
    fun group(
        rows: List<NFLDryrunPropRow>,
        games: Map<String, NFLPropGameContext> = emptyMap(),
        bestBooksFallback: Map<String, NFLPropBestBooksFallback> = emptyMap(),
    ): List<NFLPropPlayer> {
        val byPlayer = rows.groupBy { row ->
            row.gameId to (row.playerId ?: row.playerName.lowercase())
        }

        val players = byPlayer.values.mapNotNull { playerRows ->
            val first = playerRows.firstOrNull() ?: return@mapNotNull null
            val markets = playerRows
                .map { r ->
                    val fallbackKey = r.playerId?.let { "$it|${r.market}" }
                    val fallback = fallbackKey?.let { bestBooksFallback[it] }
                    NFLPropMarket(
                        market = r.market,
                        closeLine = r.closeLine,
                        openLine = r.openLine,
                        lineDelta = r.lineDelta,
                        lineRange = r.lineRange,
                        overPrice = r.overPrice?.let { roundedAwayFromZero(it) },
                        underPrice = r.underPrice?.let { roundedAwayFromZero(it) },
                        nBooks = r.nBooks,
                        closeYesProb = r.closeYesProb,
                        openYesProb = r.openYesProb,
                        lastGame = r.lastGame,
                        l3Avg = r.l3Avg, l5Avg = r.l5Avg, l10Avg = r.l10Avg,
                        sznAvg = r.sznAvg, sznMax = r.sznMax, sznMin = r.sznMin,
                        overRateL5 = r.overRateL5, overRateL10 = r.overRateL10,
                        defMatchupIdx = r.defMatchupIdx,
                        flags = r.flags ?: emptyList(),
                        recentGames = r.recentGames ?: emptyList(),
                        bestOver = bestQuote(
                            bookKey = r.bestOverBook ?: fallback?.bestOverBook,
                            bookName = r.bestOverBookName ?: fallback?.bestOverBookName,
                            bookLogoUrl = r.bestOverBookLogo ?: fallback?.bestOverBookLogo,
                            line = r.bestOverLine ?: fallback?.bestOverLine,
                            price = r.bestOverPrice ?: fallback?.bestOverPrice,
                        ),
                        bestUnder = bestQuote(
                            bookKey = r.bestUnderBook ?: fallback?.bestUnderBook,
                            bookName = r.bestUnderBookName ?: fallback?.bestUnderBookName,
                            bookLogoUrl = r.bestUnderBookLogo ?: fallback?.bestUnderBookLogo,
                            line = r.bestUnderLine ?: fallback?.bestUnderLine,
                            price = r.bestUnderPrice ?: fallback?.bestUnderPrice,
                        ),
                    )
                }
                .sortedWith(compareBy({ marketSortIndex(it.market) }, { it.market }))

            val context = games[first.gameId]
            NFLPropPlayer(
                playerName = first.playerName,
                playerId = first.playerId,
                headshotUrl = first.headshotUrl,
                team = first.team,
                opponent = first.opponent,
                isHome = first.isHome,
                position = first.position,
                gameId = first.gameId,
                eventId = first.eventId,
                gameDate = context?.gameDate ?: "",
                slot = context?.slot,
                week = first.week,
                season = first.season,
                reportStatus = first.reportStatus,
                practiceStatus = first.practiceStatus,
                markets = markets,
            )
        }

        return players.sortedWith(compareBy({ it.sortKey }, { it.playerName }))
    }

    private fun bestQuote(
        bookKey: String?,
        bookName: String?,
        bookLogoUrl: String?,
        line: Double?,
        price: Double?,
    ): NFLPropBestQuote = NFLPropBestQuote(
        bookKey = bookKey,
        bookName = bookName,
        bookLogoUrl = bookLogoUrl,
        line = line,
        price = price?.let { roundedAwayFromZero(it) },
    )

    // Swift `.rounded()` rounds ties away from zero; Kotlin roundToInt() rounds
    // half toward +∞ — matters for negative American odds like -112.5.
    internal fun roundedAwayFromZero(d: Double): Int =
        (sign(d) * floor(abs(d) + 0.5)).toInt()
}

// MARK: - NFL team identity

/**
 * Static NFL team identity map (abbr + city + full-name aliases → ESPN
 * slug). Team columns across feeds may carry any of those formats, so every
 * lookup normalizes through here.
 */
object NFLTeams {
    private data class TeamEntry(val slug: String, val abbr: String, val city: String, val mascot: String)

    /** slug → (abbr, city, mascot). Slug doubles as the ESPN logo key. */
    private val teams: List<TeamEntry> = listOf(
        TeamEntry("ari", "ARI", "Arizona", "Cardinals"),
        TeamEntry("atl", "ATL", "Atlanta", "Falcons"),
        TeamEntry("bal", "BAL", "Baltimore", "Ravens"),
        TeamEntry("buf", "BUF", "Buffalo", "Bills"),
        TeamEntry("car", "CAR", "Carolina", "Panthers"),
        TeamEntry("chi", "CHI", "Chicago", "Bears"),
        TeamEntry("cin", "CIN", "Cincinnati", "Bengals"),
        TeamEntry("cle", "CLE", "Cleveland", "Browns"),
        TeamEntry("dal", "DAL", "Dallas", "Cowboys"),
        TeamEntry("den", "DEN", "Denver", "Broncos"),
        TeamEntry("det", "DET", "Detroit", "Lions"),
        TeamEntry("gb", "GB", "Green Bay", "Packers"),
        TeamEntry("hou", "HOU", "Houston", "Texans"),
        TeamEntry("ind", "IND", "Indianapolis", "Colts"),
        TeamEntry("jax", "JAX", "Jacksonville", "Jaguars"),
        TeamEntry("kc", "KC", "Kansas City", "Chiefs"),
        TeamEntry("lv", "LV", "Las Vegas", "Raiders"),
        TeamEntry("lac", "LAC", "Los Angeles Chargers", "Chargers"),
        TeamEntry("lar", "LAR", "Los Angeles Rams", "Rams"),
        TeamEntry("mia", "MIA", "Miami", "Dolphins"),
        TeamEntry("min", "MIN", "Minnesota", "Vikings"),
        TeamEntry("ne", "NE", "New England", "Patriots"),
        TeamEntry("no", "NO", "New Orleans", "Saints"),
        TeamEntry("nyg", "NYG", "New York Giants", "Giants"),
        TeamEntry("nyj", "NYJ", "New York Jets", "Jets"),
        TeamEntry("phi", "PHI", "Philadelphia", "Eagles"),
        TeamEntry("pit", "PIT", "Pittsburgh", "Steelers"),
        TeamEntry("sf", "SF", "San Francisco", "49ers"),
        TeamEntry("sea", "SEA", "Seattle", "Seahawks"),
        TeamEntry("tb", "TB", "Tampa Bay", "Buccaneers"),
        TeamEntry("ten", "TEN", "Tennessee", "Titans"),
        TeamEntry("wsh", "WSH", "Washington", "Commanders"),
    )

    /**
     * Lowercased alias → slug. Built once; covers abbr ("KC"), city
     * ("Kansas City"), mascot ("Chiefs"), full name, and common alt abbrs.
     */
    private val slugByAlias: Map<String, String> = buildMap {
        for (t in teams) {
            put(t.abbr.lowercase(), t.slug)
            put(t.city.lowercase(), t.slug)
            put(t.mascot.lowercase(), t.slug)
            put("${t.city} ${t.mascot}".lowercase(), t.slug)
        }
        // Alt abbreviations seen across feeds (nflverse uses LA for the Rams).
        put("was", "wsh"); put("jac", "jax"); put("lvr", "lv")
        put("nor", "no"); put("nwe", "ne"); put("gnb", "gb")
        put("kan", "kc"); put("sfo", "sf"); put("tam", "tb")
        put("la", "lar"); put("la chargers", "lac"); put("la rams", "lar")
        put("ny giants", "nyg"); put("ny jets", "nyj")
    }

    fun slug(team: String): String? = slugByAlias[team.trim().lowercase()]

    /** "KC" — falls back to up-to-3 initials for unmapped strings. */
    fun abbr(team: String): String {
        slug(team)?.let { slug ->
            teams.firstOrNull { it.slug == slug }?.let { return it.abbr }
        }
        val trimmed = team.trim()
        if (trimmed.length <= 3) return trimmed.uppercase()
        return trimmed.split(" ")
            .mapNotNull { it.firstOrNull() }
            .take(3)
            .joinToString("")
            .uppercase()
    }

    /** "Buffalo Bills" for any alias/abbr format; null when unmapped. */
    fun fullName(team: String): String? {
        val slug = slug(team) ?: return null
        val entry = teams.firstOrNull { it.slug == slug } ?: return null
        return "${entry.city} ${entry.mascot}"
    }

    /** "Chiefs" for any alias/abbr format; null when unmapped. */
    fun mascot(team: String): String? {
        val slug = slug(team) ?: return null
        return teams.firstOrNull { it.slug == slug }?.mascot
    }

    /** Short display name for matchup labels — e.g. "Cowboys". */
    fun nickname(team: String): String {
        mascot(team)?.let { return it }
        val trimmed = team.trim()
        if (trimmed.contains(" ")) {
            trimmed.split(" ").lastOrNull { it.isNotEmpty() }?.let { return it }
        }
        return trimmed
    }

    fun logoUrl(team: String): String? {
        val slug = slug(team) ?: return null
        return "https://a.espncdn.com/i/teamlogos/nfl/500/$slug.png"
    }

    /** Two team strings refer to the same franchise (any alias format). */
    fun matches(a: String, b: String): Boolean {
        val sa = slug(a)
        val sb = slug(b)
        if (sa != null && sb != null) return sa == sb
        return a.equals(b, ignoreCase = true)
    }

    /**
     * ESPN headshot for numeric player ids; null otherwise (the card falls
     * back to an initials disc).
     */
    fun headshotUrl(playerId: String?): String? {
        if (playerId == null || playerId.toIntOrNull() == null) return null
        return "https://a.espncdn.com/i/headshots/nfl/players/full/$playerId.png"
    }
}
