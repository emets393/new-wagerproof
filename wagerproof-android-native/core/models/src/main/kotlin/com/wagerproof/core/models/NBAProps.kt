package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FlexibleDoubleSerializer
import com.wagerproof.core.models.serialization.FlexibleStringSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull

@Serializable
data class NbaSlateProp(
    @SerialName("game_date") val gameDate: String? = null,
    @SerialName("commence_time") val commenceTime: String? = null,
    val game: String? = null,
    @SerialName("home_abbr") val homeAbbr: String? = null,
    @SerialName("away_abbr") val awayAbbr: String? = null,
    @Serializable(with = FlexibleStringSerializer::class)
    @SerialName("athlete_id") val athleteId: String? = null,
    @SerialName("player_name") val playerName: String? = null,
    val position: String? = null,
    val team: String? = null,
    val opponent: String? = null,
    @SerialName("headshot_url") val headshotUrl: String? = null,
    val market: String? = null,
    @SerialName("market_label") val marketLabel: String? = null,
    val line: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("over_price") val overPrice: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("under_price") val underPrice: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("open_line") val openLine: Double? = null,
    @SerialName("last_game") val lastGame: Double? = null,
    @SerialName("l3_avg") val l3Avg: Double? = null,
    @SerialName("l5_avg") val l5Avg: Double? = null,
    @SerialName("l10_avg") val l10Avg: Double? = null,
    @SerialName("szn_avg") val sznAvg: Double? = null,
    @SerialName("prior_szn_avg") val priorSznAvg: Double? = null,
    @SerialName("prior_szn_gp") val priorSznGp: Double? = null,
    @SerialName("gp_prior") val gpPrior: Double? = null,
    @SerialName("min_l5") val minL5: Double? = null,
    @SerialName("over_rate_l5") val overRateL5: Double? = null,
    @SerialName("over_rate_l10") val overRateL10: Double? = null,
    @SerialName("over_rate_szn") val overRateSzn: Double? = null,
    @SerialName("recent_games") val recentGames: JsonElement? = null,
    val baseline: Double? = null,
    @SerialName("baseline_gap") val baselineGap: Double? = null,
    @SerialName("rank_pos") val rankPos: Double? = null,
    val flags: JsonElement? = null,
    @SerialName("flag_detail") val flagDetail: JsonElement? = null,
    @SerialName("report_status") val reportStatus: String? = null,
) {
    val id: String get() = "${gameDate.orEmpty()}|${athleteId.orEmpty()}|${market.orEmpty()}"
    val isOut: Boolean get() = reportStatus?.trim()?.equals("out", ignoreCase = true) == true
    val gameKey: String
        get() = if (!awayAbbr.isNullOrBlank() && !homeAbbr.isNullOrBlank()) {
            "${gameDate.orEmpty()}:$awayAbbr:$homeAbbr"
        } else {
            "${gameDate.orEmpty()}:${game.orEmpty()}"
        }
    val matchupLabel: String
        get() = if (!awayAbbr.isNullOrBlank() && !homeAbbr.isNullOrBlank()) "$awayAbbr @ $homeAbbr" else game ?: "Game"

    fun flagKeys(): List<String> {
        val array = flags as? JsonArray ?: return emptyList()
        return array.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }.filter { it.isNotEmpty() }
    }

    fun recentRows(): List<NbaRecentGame> {
        val array = recentGames as? JsonArray ?: return emptyList()
        return array.mapNotNull { element ->
            val obj = element as? JsonObject ?: return@mapNotNull null
            NbaRecentGame(
                date = (obj["date"] as? JsonPrimitive)?.contentOrNull,
                opp = (obj["opp"] as? JsonPrimitive)?.contentOrNull,
                value = (obj["value"] as? JsonPrimitive)?.let { it.doubleOrNull ?: it.contentOrNull?.toDoubleOrNull() },
                line = (obj["line"] as? JsonPrimitive)?.doubleOrNull,
            )
        }
    }
}

data class NbaRecentGame(val date: String?, val opp: String?, val value: Double?, val line: Double?)

@Serializable
data class NbaPropDef(
    @SerialName("signal_key") val signalKey: String,
    @SerialName("display_name") val displayName: String? = null,
    @SerialName("one_liner") val oneLiner: String? = null,
    val definition: String? = null,
    @SerialName("why_it_works") val whyItWorks: String? = null,
    @SerialName("bet_direction") val betDirection: String? = null,
    @SerialName("record_text") val recordText: String? = null,
    @SerialName("season_record_text") val seasonRecordText: String? = null,
)

@Serializable
data class NbaBookQuote(
    val bookmaker: String? = null,
    val line: Double? = null,
    @SerialName("over_odds") val overOdds: Double? = null,
    @SerialName("under_odds") val underOdds: Double? = null,
    @SerialName("snapshot_time") val snapshotTime: String? = null,
)

data class NBASlateSignal(
    val id: String,
    val title: String,
    val side: String?,
    val definition: String?,
    val recordText: String?,
    val seasonRecordText: String?,
    /** Canonical market this flag belongs under: spread, total, moneyline, h1_spread, h1_total. */
    val market: String = "",
)

/** Which betting card a basketball slate flag belongs on, and whether it
 *  takes the same side as the model. A mismatch is the amber contradict pill. */
object BasketballSignalMarket {
    fun canonical(raw: String?): String? {
        val key = raw?.trim()?.lowercase().orEmpty()
        if (key.isEmpty()) return null
        return when (key) {
            "spread", "fg_spread" -> "spread"
            "total", "fg_total", "ou", "over_under" -> "total"
            "moneyline", "ml", "money_line", "fg_ml" -> "moneyline"
            "h1_spread" -> "h1_spread"
            "h1_total", "h1_ou", "h1_over_under" -> "h1_total"
            "h1_ml", "h1_moneyline" -> "h1_ml"
            "tt" -> "team_total"
            else -> if (key.startsWith("team_total")) "team_total" else key
        }
    }

    fun isTotal(market: String): Boolean =
        market == "total" || market == "h1_total" || market == "team_total"

    fun contradicts(
        side: String?,
        market: String,
        modelLikesHome: Boolean?,
        modelLikesOver: Boolean?,
        homeName: String,
        awayName: String,
        homeAbbr: String,
        awayAbbr: String,
    ): Boolean {
        val hay = side?.uppercase().orEmpty()
        if (hay.isEmpty()) return false
        if (isTotal(market)) {
            if (modelLikesOver == true) return hay.contains("UNDER")
            if (modelLikesOver == false && hay.contains("OVER") && !hay.contains("UNDER")) return true
            return false
        }
        if (modelLikesHome == null) return false
        if (hay.contains("FADE HOME") && modelLikesHome) return true
        if (hay.contains("FADE AWAY") && !modelLikesHome) return true
        val flagHome = likesHome(hay, homeName, awayName, homeAbbr, awayAbbr) ?: return false
        return flagHome != modelLikesHome
    }

    fun <T> supportingFirst(items: List<T>, contradicts: (T) -> Boolean): List<T> =
        items.filter { !contradicts(it) } + items.filter { contradicts(it) }

    private fun likesHome(hay: String, homeName: String, awayName: String, homeAbbr: String, awayAbbr: String): Boolean? {
        if (hay.contains("HOME") && !hay.contains("FADE HOME")) return true
        if (hay.contains("AWAY") && !hay.contains("FADE AWAY")) return false
        val mentionsHome = mentions(homeAbbr, hay) || mentions(homeName, hay)
        val mentionsAway = mentions(awayAbbr, hay) || mentions(awayName, hay)
        if (mentionsHome && !mentionsAway) return true
        if (mentionsAway && !mentionsHome) return false
        return null
    }

    private fun mentions(token: String, hay: String): Boolean {
        val trimmed = token.trim().uppercase()
        if (trimmed.length < 2) return false
        if (trimmed.length >= 4) return hay.contains(trimmed)
        return Regex("\\b${Regex.escape(trimmed)}\\b").containsMatchIn(hay)
    }
}

data class NBAFirstHalfMarket(
    val id: String,
    val title: String,
    val modelNumber: Double?,
    val marketNumber: Double?,
    val disagreement: Double?,
    val tier: String?,
    val trackingOnly: Boolean,
    val homeAbbr: String? = null,
    val awayAbbr: String? = null,
)

fun nbaOneDecimal(value: Double?): String = if (value == null) "—" else String.format("%.1f", value)

enum class NbaPickSide { OVER, UNDER }

data class NbaRecentBar(val value: Double, val cleared: Boolean, val opponent: String?, val date: String?)
data class NbaRecentForm(val bars: List<NbaRecentBar>, val hits: Int, val games: Int, val pct: Double?)
data class NbaLineStamp(val at: Double, val line: Double)
data class NbaLineMovement(val moves: List<NbaLineStamp>, val open: NbaLineStamp?, val mid: NbaLineStamp?, val current: NbaLineStamp?)
data class NbaPropGameOption(val key: String, val label: String, val away: String?, val home: String?)
data class NbaPropMarketOption(val key: String, val label: String)
data class NbaBookPrice(val book: String, val price: Double)
data class NbaPropFeedFilters(val gameKey: String? = null, val market: String? = null, val signalsOnly: Boolean = false) {
    val isActive: Boolean get() = gameKey != null || market != null || signalsOnly
}

private val NBA_MARKET_ORDER = listOf(
    "player_points", "player_rebounds", "player_assists", "player_threes",
    "player_blocks", "player_steals", "player_points_rebounds_assists",
    "player_points_rebounds", "player_points_assists", "player_rebounds_assists",
)

fun nbaFormatNumber(value: Double?): String {
    if (value == null || !value.isFinite()) return "—"
    return if (value % 1.0 == 0.0) value.toInt().toString() else String.format("%.1f", value)
}

fun nbaFormatAmerican(value: Double?): String {
    if (value == null || !value.isFinite()) return "—"
    val rounded = kotlin.math.round(value).toInt()
    return if (rounded > 0) "+$rounded" else "$rounded"
}

fun nbaBetterAmerican(candidate: Double, current: Double): Boolean = candidate > current

fun nbaPickSide(row: NbaSlateProp, defs: Map<String, NbaPropDef>): NbaPickSide? {
    for (key in row.flagKeys()) {
        val direction = defs[key]?.betDirection?.trim()?.lowercase().orEmpty()
        if (direction == "over" || direction == "o") return NbaPickSide.OVER
        if (direction == "under" || direction == "u") return NbaPickSide.UNDER
        if (key == "nba_player_ref_over" || key.endsWith("_over")) return NbaPickSide.OVER
        if (key == "nba_player_ref_under" || key.endsWith("_under")) return NbaPickSide.UNDER
    }
    return null
}

fun nbaPickLabel(row: NbaSlateProp, defs: Map<String, NbaPropDef>): String {
    val label = row.marketLabel ?: row.market ?: "Prop"
    val line = nbaFormatNumber(row.line)
    return when (nbaPickSide(row, defs)) {
        NbaPickSide.OVER -> "$label O$line"
        NbaPickSide.UNDER -> "$label U$line"
        null -> "$label $line"
    }
}

fun nbaSignalSentence(key: String, detail: JsonElement?, playerName: ((String) -> String?)? = null): String? {
    val row = (detail as? JsonObject)?.get(key) as? JsonObject ?: return null
    if (key == "nba_player_ref_over" || key == "nba_player_ref_under") {
        val games = jsonInt(row, "games") ?: return null
        val chief = jsonString(row, "chief")?.trim().orEmpty()
        if (chief.isEmpty()) return null
        if (key.endsWith("_under")) {
            val below = jsonInt(row, "below") ?: return null
            return "$below of $games games below his norm with $chief"
        }
        val above = jsonInt(row, "above") ?: return null
        return "$above of $games games above his norm with $chief"
    }
    if (key == "nba_hot_shooter_under") {
        val heat = jsonDouble(row, "heat_l5") ?: return null
        return "Last 5 games he scored ${String.format("%.1f", heat)} points a night more than his own finishing"
    }
    if (key == "nba_backup_same_pos_under") {
        val mpg = jsonDouble(row, "out_mpg")
        val minutes = if (mpg == null) "" else "${kotlin.math.round(mpg).toInt()}-minute "
        val position = jsonString(row, "position")?.trim()?.takeIf { it.isNotEmpty() }?.let { "$it " }.orEmpty()
        val missed = jsonInt(row, "games_missed_before")
        val which = when (missed) {
            0 -> " for the first game"
            1 -> " for the second game"
            else -> ""
        }
        val starter = "a $minutes${position}starter"
        val id = jsonString(row, "out_player") ?: jsonInt(row, "out_player")?.toString()
        val name = id?.let { playerName?.invoke(it) }
        val who = if (name != null) "$name, $starter," else "A $minutes${position}starter"
        return "$who is out$which and this player is still on the bench"
    }
    return null
}

fun nbaRefSentence(key: String, detail: JsonElement?): String? = nbaSignalSentence(key, detail)

fun nbaSignalLines(row: NbaSlateProp, defs: Map<String, NbaPropDef>, names: Map<String, String>): List<String> =
    row.flagKeys().mapNotNull { key ->
        nbaSignalSentence(key, row.flagDetail) { names[it] }?.takeIf { it.isNotBlank() }
            ?: defs[key]?.oneLiner?.trim()?.takeIf { it.isNotEmpty() }
            ?: defs[key]?.displayName?.trim()?.takeIf { it.isNotEmpty() }
    }

fun nbaRecentForm(row: NbaSlateProp, limit: Int = 10): NbaRecentForm {
    val line = row.line
    val ordered = row.recentRows()
        .mapNotNull { game -> game.value?.let { game to it } }
        .sortedWith(compareBy { it.first.date ?: "" })
        .takeLast(limit)
    val bars = ordered.map { (game, value) ->
        NbaRecentBar(value, line != null && value > line, game.opp?.trim()?.takeIf { it.isNotEmpty() }, game.date)
    }
    val hits = bars.count { it.cleared }
    return NbaRecentForm(bars, hits, bars.size, if (bars.isEmpty() || line == null) null else hits * 100.0 / bars.size)
}

fun nbaClearedCount(rate: Double?, games: Double?): Int? {
    if (rate == null || games == null || games <= 0) return null
    val share = if (rate > 1) rate / 100 else rate
    if (share < 0 || share > 1) return null
    return kotlin.math.round(share * games).toInt()
}

fun nbaBestQuote(quotes: List<NbaBookQuote>, side: NbaPickSide): NbaBookPrice? {
    var best: NbaBookPrice? = null
    for (quote in quotes) {
        val price = if (side == NbaPickSide.OVER) quote.overOdds else quote.underOdds
        val book = quote.bookmaker.orEmpty()
        if (price == null || book.isEmpty()) continue
        if (best == null || nbaBetterAmerican(price, best.price)) best = NbaBookPrice(book, price)
    }
    return best
}

fun nbaLineMovement(quotes: List<NbaBookQuote>): NbaLineMovement {
    val buckets = linkedMapOf<Double, MutableList<Double>>()
    for (quote in quotes) {
        val line = quote.line ?: continue
        val at = quote.snapshotTime?.let { runCatching { java.time.Instant.parse(it).toEpochMilli().toDouble() }.getOrNull() } ?: continue
        val minute = kotlin.math.floor(at / 60000.0) * 60000.0
        buckets.getOrPut(minute) { mutableListOf() }.add(line)
    }
    val samples = buckets.entries.map { NbaLineStamp(it.key, median(it.value)) }.sortedBy { it.at }
    if (samples.isEmpty()) return NbaLineMovement(emptyList(), null, null, null)
    val moves = mutableListOf<NbaLineStamp>()
    for (sample in samples) {
        val last = moves.lastOrNull()
        if (last == null || kotlin.math.abs(last.line - sample.line) >= 0.05) moves.add(sample)
    }
    val open = moves.first()
    val end = samples.last().at
    val current = NbaLineStamp(end, moves.last().line)
    val mid = if (moves.size > 1 && end > open.at) {
        val at = open.at + (end - open.at) / 2
        var line = open.line
        for (move in moves) if (move.at <= at) line = move.line
        NbaLineStamp(at, line)
    } else null
    return NbaLineMovement(moves, open, mid, current)
}

fun nbaGames(rows: List<NbaSlateProp>): List<NbaPropGameOption> {
    val first = linkedMapOf<String, NbaSlateProp>()
    for (row in rows) if (row.gameKey !in first) first[row.gameKey] = row
    val ordered = first.values.sortedBy { it.commenceTime ?: it.gameDate ?: "" }
    val labels = ordered.map { it.matchupLabel }
    val duplicated = labels.groupingBy { it }.eachCount().filterValues { it > 1 }.keys
    return ordered.map { row ->
        val dated = if (row.matchupLabel in duplicated && (row.gameDate?.length ?: 0) >= 10) {
            "${row.matchupLabel} · ${row.gameDate!!.drop(5)}"
        } else row.matchupLabel
        NbaPropGameOption(row.gameKey, dated, row.awayAbbr, row.homeAbbr)
    }
}

fun nbaMarkets(rows: List<NbaSlateProp>): List<NbaPropMarketOption> {
    val labels = linkedMapOf<String, String>()
    for (row in rows) {
        val market = row.market ?: continue
        if (market !in labels) labels[market] = row.marketLabel ?: market
    }
    return labels.map { NbaPropMarketOption(it.key, it.value) }.sortedBy { it.label.lowercase() }
}

/** One list row per player-game. The sparkline is points unless a market filter is on. */
data class NbaPropListCard(
    val id: String,
    val chart: NbaSlateProp,
    val featured: NbaSlateProp,
) {
    val highlighted: Boolean get() = featured.flagKeys().isNotEmpty()
}

fun nbaFilter(rows: List<NbaSlateProp>, filters: NbaPropFeedFilters, query: String): List<NbaPropListCard> {
    val needle = query.trim().lowercase()
    val groups = linkedMapOf<String, MutableList<NbaSlateProp>>()
    for (row in rows) groups.getOrPut(nbaPlayerGameId(row)) { mutableListOf() }.add(row)
    return groups.mapNotNull { (id, group) ->
        val sample = group.first()
        if (filters.gameKey != null && sample.gameKey != filters.gameKey) return@mapNotNull null
        if (filters.market != null && group.none { it.market == filters.market }) return@mapNotNull null
        if (filters.signalsOnly) {
            val pool = if (filters.market == null) group else group.filter { it.market == filters.market }
            if (pool.none { it.flagKeys().isNotEmpty() }) return@mapNotNull null
        }
        if (needle.isNotEmpty() && !"${sample.playerName.orEmpty()} ${sample.team.orEmpty()} ${sample.opponent.orEmpty()}".lowercase().contains(needle)) {
            return@mapNotNull null
        }
        val featured = nbaFeaturedRow(group, filters.market)
        NbaPropListCard(id, nbaChartRow(group, filters.market, featured), featured)
    }
}

private fun nbaChartRow(group: List<NbaSlateProp>, market: String?, featured: NbaSlateProp): NbaSlateProp {
    if (market != null) return featured
    return group.firstOrNull { it.market == "player_points" } ?: featured
}

private fun nbaFeaturedRow(group: List<NbaSlateProp>, market: String?): NbaSlateProp {
    if (market != null) group.firstOrNull { it.market == market }?.let { return it }
    val signaled = group.filter { it.flagKeys().isNotEmpty() }.sortedBy { nbaMarketRank(it.market) }
    if (signaled.isNotEmpty()) return signaled.first()
    return group.firstOrNull { it.market == "player_points" } ?: group.sortedBy { nbaMarketRank(it.market) }.first()
}

private fun nbaMarketRank(market: String?): Int {
    val index = NBA_MARKET_ORDER.indexOf(market)
    return if (index < 0) NBA_MARKET_ORDER.size else index
}

fun nbaSignalPlayerCount(rows: List<NbaSlateProp>): Int =
    rows.filter { it.flagKeys().isNotEmpty() }.map { nbaPlayerGameId(it) }.toSet().size

fun nbaPlayerSignalCount(rows: List<NbaSlateProp>, row: NbaSlateProp): Int {
    val id = nbaPlayerGameId(row)
    return rows.filter { nbaPlayerGameId(it) == id }.sumOf { it.flagKeys().size }
}

fun nbaSiblings(rows: List<NbaSlateProp>, row: NbaSlateProp): List<NbaSlateProp> =
    rows.filter { it.athleteId == row.athleteId && it.gameDate == row.gameDate }
        .sortedBy { NBA_MARKET_ORDER.indexOf(it.market).let { index -> if (index < 0) NBA_MARKET_ORDER.size else index } }

fun nbaAthleteNames(rows: List<NbaSlateProp>): Map<String, String> {
    val names = linkedMapOf<String, String>()
    for (row in rows) {
        val id = row.athleteId ?: continue
        val name = row.playerName ?: continue
        if (id.isNotEmpty() && name.isNotEmpty()) names[id] = name
    }
    return names
}

private fun nbaPlayerGameId(row: NbaSlateProp) = "${row.gameDate.orEmpty()}:${row.athleteId.orEmpty()}"

private fun median(values: List<Double>): Double {
    val sorted = values.sorted()
    val mid = sorted.size / 2
    return if (sorted.size % 2 == 0) (sorted[mid - 1] + sorted[mid]) / 2 else sorted[mid]
}

private fun jsonObjectNumber(value: JsonElement?): Double? {
    val primitive = value as? JsonPrimitive ?: return null
    return primitive.doubleOrNull ?: primitive.contentOrNull?.toDoubleOrNull()
}

private fun jsonDouble(obj: JsonObject, key: String): Double? = jsonObjectNumber(obj[key])

private fun jsonInt(obj: JsonObject, key: String): Int? = jsonDouble(obj, key)?.toInt()

private fun jsonString(obj: JsonObject, key: String): String? {
    val primitive = obj[key] as? JsonPrimitive ?: return null
    return primitive.contentOrNull ?: primitive.intOrNull?.toString()
}

fun nbaSample(value: Double?, noun: String): String =
    if (value == null) "sample size not posted" else "${value.toInt()} $noun"
