package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FlexibleDoubleSerializer
import com.wagerproof.core.models.serialization.FlexibleIntOrZeroSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

/** Action Network public-betting read. Port of `src/features/publicBetting/signals.ts`. */
enum class PublicMarket(val label: String, val noun: String, val confirmMove: Double, val strongMove: Double) {
    spread("Spread", "spread", 0.5, 1.5),
    total("Total", "total", 0.5, 1.5),
    ml("Moneyline", "moneyline", 0.02, 0.05),
}

enum class PublicSide { away, home }

enum class PublicCategory(val rank: Int, val emphasis: PublicEmphasis) {
    sharpMoney(0, PublicEmphasis.loud),
    moneyNoMove(1, PublicEmphasis.medium),
    hammered(2, PublicEmphasis.medium),
    lineFightsMoney(3, PublicEmphasis.quiet),
    publicLoading(4, PublicEmphasis.quiet),
    consensus(5, PublicEmphasis.quiet),
    linePushesBack(6, PublicEmphasis.quiet),
    `public`(7, PublicEmphasis.quiet),
    split(8, PublicEmphasis.none),
}

enum class PublicEmphasis { loud, medium, quiet, none }

data class PublicLineQuote(
    val movedToward: PublicSide?,
    val moveSize: Double?,
    val open: Double?,
    val current: Double?,
    val homeOpen: Double?,
    val homeCurrent: Double?,
)

data class PublicMarketInput(
    val market: PublicMarket,
    val awayName: String,
    val homeName: String,
    val awayOpen: Double?,
    val homeOpen: Double?,
    val awayCons: Double?,
    val homeCons: Double?,
    val betsAway: Double?,
    val betsHome: Double?,
    val moneyAway: Double?,
    val moneyHome: Double?,
    val tickets: Double?,
    val hasSplit: Boolean,
)

data class PublicMarketRead(
    val market: PublicMarket,
    val ticketSide: PublicSide?,
    val ticketLead: Double,
    val moneyTiltSide: PublicSide?,
    val tiltPp: Double,
    val movedToward: PublicSide?,
    val moveSize: Double?,
    val open: Double?,
    val current: Double?,
    val homeOpen: Double?,
    val homeCurrent: Double?,
    val betsAway: Double,
    val betsHome: Double,
    val moneyAway: Double,
    val moneyHome: Double,
    val category: PublicCategory?,
    val emphasis: PublicEmphasis,
    val strong: Boolean,
    val chip: String,
    val sentence: String,
    val excluded: Boolean,
    val awaySideName: String,
    val homeSideName: String,
    /** Absolute ticket count on this market. Blank while Action omits volume. */
    val tickets: Double? = null,
)

enum class PublicBoardSort(val label: String) {
    sharp("Sharp"),
    time("Time"),
    money("Money %"),
    diff("Difference"),
}

data class PublicMoneyGap(val side: PublicSide, val points: Int, val name: String)

data class PublicLineCaption(
    val mark: String,
    val text: String,
    val flat: Boolean,
    val openerMissing: Boolean,
)

data class PublicBettingGame(
    val gameId: Int,
    val sport: String,
    val away: String,
    val home: String,
    val startTime: String?,
    val capturedAt: Long?,
    val tickets: Int?,
    val reads: Map<PublicMarket, PublicMarketRead>,
) {
    val id: String get() = "$sport-$gameId"
}

@Serializable
data class PublicBoardRow(
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    @SerialName("game_id") val gameId: Int = 0,
    val market: String = "",
    val sport: String = "",
    @SerialName("start_time") val startTime: String? = null,
    val away: String = "",
    val home: String = "",
    @SerialName("snap_ts") val snapTs: String? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("away_open") val awayOpen: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("home_open") val homeOpen: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("away_cons") val awayCons: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("home_cons") val homeCons: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("bets_away") val betsAway: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("bets_home") val betsHome: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("money_away") val moneyAway: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("money_home") val moneyHome: Double? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val tickets: Double? = null,
    @SerialName("has_split") val hasSplit: Boolean? = null,
)

object PublicBetting {
    const val divergeTilt = 10.0
    const val strongTilt = 20.0
    const val heavyTickets = 60.0
    const val minTickets = 200.0
    const val leanTickets = 55.0
    const val mlMinMinority = 15.0

    fun impliedProbability(american: Double): Double {
        if (american < 0) return -american / (-american + 100)
        return 100 / (american + 100)
    }

    fun formatLine(market: PublicMarket, value: Double): String {
        if (market == PublicMarket.ml) {
            val rounded = value.roundToInt()
            return if (rounded > 0) "+$rounded" else rounded.toString()
        }
        val rounded = (value * 100).roundToInt() / 100.0
        if (market == PublicMarket.spread && rounded == 0.0) return "PK"
        val text = plain(rounded)
        if (market == PublicMarket.spread && rounded > 0) return "+$text"
        return text
    }

    fun lineDirection(input: PublicMarketInput): PublicLineQuote {
        val awayOpen = finite(input.awayOpen)
        val homeOpen = finite(input.homeOpen)
        val awayCons = finite(input.awayCons)
        val homeCons = finite(input.homeCons)

        if (input.market == PublicMarket.total) {
            if (awayOpen == null || awayCons == null) {
                return PublicLineQuote(null, null, awayOpen, null, null, null)
            }
            val move = awayCons - awayOpen
            return PublicLineQuote(
                if (move == 0.0) null else if (move > 0) PublicSide.away else PublicSide.home,
                abs(move), awayOpen, awayCons, null, null,
            )
        }

        if (input.market == PublicMarket.spread) {
            if (awayOpen == null || awayCons == null) {
                return PublicLineQuote(null, null, awayOpen, null, homeOpen, null)
            }
            val move = awayCons - awayOpen
            return PublicLineQuote(
                if (move == 0.0) null else if (move < 0) PublicSide.away else PublicSide.home,
                abs(move), awayOpen, awayCons, homeOpen, homeCons,
            )
        }

        if (awayOpen == null || homeOpen == null || awayCons == null || homeCons == null) {
            return PublicLineQuote(null, null, awayOpen, awayCons, homeOpen, homeCons)
        }
        val move = deviggedAway(awayCons, homeCons) - deviggedAway(awayOpen, homeOpen)
        return PublicLineQuote(
            if (move == 0.0) null else if (move > 0) PublicSide.away else PublicSide.home,
            abs(move), awayOpen, awayCons, homeOpen, homeCons,
        )
    }

    fun quoteLine(market: PublicMarket, awayName: String, homeName: String, quote: PublicLineQuote): String {
        if (market == PublicMarket.total) {
            val open = quote.open
            val current = quote.current
            if (open == null && current == null) return "Line unavailable"
            if (open == null || current == null) {
                val only = current ?: open ?: return "Line unavailable"
                return formatLine(PublicMarket.total, only)
            }
            return "${formatLine(PublicMarket.total, open)} → ${formatLine(PublicMarket.total, current)}"
        }
        fun side(name: String, open: Double?, current: Double?): String {
            if (open != null && current != null) return "$name ${formatLine(market, open)} → ${formatLine(market, current)}"
            if (current != null) return "$name ${formatLine(market, current)}"
            if (open != null) return "$name ${formatLine(market, open)}"
            return ""
        }
        val joined = listOf(
            side(awayName, quote.open, quote.current),
            side(homeName, quote.homeOpen, quote.homeCurrent),
        ).filter { it.isNotEmpty() }.joinToString(" · ")
        return joined.ifEmpty { "Line unavailable" }
    }

    fun read(input: PublicMarketInput): PublicMarketRead {
        val awaySide = sideName(input.market, PublicSide.away, input.awayName, input.homeName)
        val homeSide = sideName(input.market, PublicSide.home, input.awayName, input.homeName)
        val betsAway = input.betsAway
        val betsHome = input.betsHome
        val moneyKnown = input.moneyAway != null && input.moneyHome != null
        val moneyAway = input.moneyAway ?: 0.0
        val moneyHome = input.moneyHome ?: 0.0
        val direction = lineDirection(input)

        fun blank(excluded: Boolean) = PublicMarketRead(
            input.market, null, 0.0, null, 0.0,
            direction.movedToward, direction.moveSize, direction.open, direction.current,
            direction.homeOpen, direction.homeCurrent,
            betsAway ?: 0.0, betsHome ?: 0.0, moneyAway, moneyHome,
            null, PublicEmphasis.none, false, "", "", excluded, awaySide, homeSide,
            tickets = input.tickets,
        )

        val awayTickets = betsAway
        val homeTickets = betsHome
        val noSplit = !input.hasSplit || awayTickets == null || homeTickets == null ||
            awayTickets == 0.0 || homeTickets == 0.0 || awayTickets == 100.0 || homeTickets == 100.0
        if (noSplit || awayTickets == null || homeTickets == null) return blank(true)
        // A missing count is not a thin market. The latest snap leaves tickets blank while the
        // split itself is present; only a known count under the floor stays off.
        if (input.tickets != null && input.tickets < minTickets) return blank(true)
        if (input.market == PublicMarket.ml && minOf(awayTickets, homeTickets) < mlMinMinority) return blank(true)

        val popular = if (awayTickets >= homeTickets) PublicSide.away else PublicSide.home
        val quiet = if (popular == PublicSide.away) PublicSide.home else PublicSide.away
        val ticketSide = if (awayTickets == homeTickets) null else popular
        val ticketLead = maxOf(awayTickets, homeTickets)
        val moneyTiltSide = if (!moneyKnown || moneyAway == awayTickets) null
        else if (moneyAway > awayTickets) PublicSide.away else PublicSide.home
        val tiltPp = if (moneyKnown) abs(moneyAway - awayTickets) else 0.0
        val confirmed = direction.movedToward != null && direction.moveSize != null &&
            direction.moveSize >= input.market.confirmMove
        val effectiveMove = if (confirmed) direction.movedToward else null

        fun name(side: PublicSide) = if (side == PublicSide.away) awaySide else homeSide
        fun onSide(side: PublicSide, away: Double, home: Double) = if (side == PublicSide.away) away else home
        val moveText = if (direction.open != null && direction.current != null) {
            if (input.market == PublicMarket.spread) {
                "${input.awayName} ${formatLine(PublicMarket.spread, direction.open)} → ${formatLine(PublicMarket.spread, direction.current)}"
            } else {
                "${formatLine(input.market, direction.open)} → ${formatLine(input.market, direction.current)}"
            }
        } else ""

        fun finish(category: PublicCategory?, chip: String, sentence: String, strong: Boolean = false) = PublicMarketRead(
            input.market, ticketSide, ticketLead, moneyTiltSide, tiltPp,
            direction.movedToward, direction.moveSize, direction.open, direction.current,
            direction.homeOpen, direction.homeCurrent,
            awayTickets, homeTickets, moneyAway, moneyHome,
            category, category?.emphasis ?: PublicEmphasis.none, strong, chip, sentence, false, awaySide, homeSide,
            tickets = input.tickets,
        )

        val diverging = moneyTiltSide == quiet && tiltPp >= divergeTilt
        val piling = moneyTiltSide == popular && tiltPp >= divergeTilt
        val betsOnQuiet = onSide(quiet, awayTickets, homeTickets)
        val moneyOnQuiet = onSide(quiet, moneyAway, moneyHome)
        val moneyOnPopular = onSide(popular, moneyAway, moneyHome)
        val crowdText = "${pct(ticketLead)}% of bets are on ${name(popular)}"

        if (input.market != PublicMarket.ml && diverging) {
            if (effectiveMove == quiet) {
                val strong = tiltPp >= strongTilt && direction.moveSize != null &&
                    direction.moveSize >= input.market.strongMove
                return finish(
                    PublicCategory.sharpMoney,
                    "Sharp Money on ${name(quiet)}",
                    "$crowdText, but ${name(quiet)} is taking ${pct(moneyOnQuiet)}% of the money on ${pct(betsOnQuiet)}% of the tickets — and the ${input.market.noun} has moved $moveText. The line is following the money, not the tickets.",
                    strong,
                )
            }
            if (effectiveMove == null) {
                return finish(
                    PublicCategory.moneyNoMove,
                    "Money on ${name(quiet)}",
                    "${name(quiet)} has ${pct(moneyOnQuiet)}% of the money on ${pct(betsOnQuiet)}% of the tickets. The line hasn't moved for it yet.",
                )
            }
            return finish(
                PublicCategory.lineFightsMoney,
                "Line fighting the money",
                "The money leans ${name(quiet)}, but the ${input.market.noun} has moved toward ${name(popular)}, $moveText.",
            )
        }

        if (input.market != PublicMarket.ml && piling && effectiveMove == popular) {
            return finish(
                PublicCategory.hammered,
                "Hammered on ${name(popular)}",
                "${name(popular)} is taking ${pct(ticketLead)}% of the bets and an even bigger ${pct(moneyOnPopular)}% of the money, and the line has moved with it. That is the public with real volume behind it, not sharp action.",
            )
        }

        if (input.market != PublicMarket.ml && piling && effectiveMove != quiet) {
            return finish(
                PublicCategory.publicLoading,
                "Public loading up on ${name(popular)}",
                "${name(popular)} has ${pct(ticketLead)}% of the bets and ${pct(moneyOnPopular)}% of the money. The line hasn't followed.",
            )
        }

        if (!diverging && effectiveMove == quiet && (ticketLead >= heavyTickets || piling)) {
            return finish(
                PublicCategory.linePushesBack,
                "Line pushing back",
                "${pct(ticketLead)}% of bets and ${pct(moneyOnPopular)}% of the money are on ${name(popular)}, but the line moved toward ${name(quiet)}.",
            )
        }

        if (ticketLead >= heavyTickets && effectiveMove == popular) {
            return finish(
                PublicCategory.consensus,
                "Everyone on ${name(popular)}",
                "Bets and money are both on ${name(popular)} (${pct(ticketLead)}% / ${pct(moneyOnPopular)}%), and the line moved with them, $moveText.",
            )
        }

        if (ticketLead >= heavyTickets) {
            return finish(
                PublicCategory.`public`,
                "Public on ${name(popular)}",
                "${pct(ticketLead)}% of bets are on ${name(popular)}.",
            )
        }

        if (ticketLead > leanTickets) {
            return finish(
                PublicCategory.split,
                "Leaning ${name(popular)}",
                "Bets lean ${name(popular)} (${pct(ticketLead)}%) and the money agrees. Nothing unusual.",
            )
        }

        return finish(PublicCategory.split, "Split", "The money and the tickets are split.")
    }

    /** Rounded money share minus rounded ticket share on the side the dollars favor. */
    fun moneyGap(read: PublicMarketRead): PublicMoneyGap? {
        val side = read.moneyTiltSide ?: return null
        val tickets = (if (side == PublicSide.away) read.betsAway else read.betsHome).roundToInt()
        val money = (if (side == PublicSide.away) read.moneyAway else read.moneyHome).roundToInt()
        val points = money - tickets
        if (points < 1) return null
        val name = if (side == PublicSide.away) read.awaySideName else read.homeSideName
        return PublicMoneyGap(side, points, name)
    }

    /** Open-to-now caption. Null when the market has no number at all. */
    fun lineCaption(market: PublicMarket, read: PublicMarketRead): PublicLineCaption? {
        if (read.open == null && read.current == null && read.homeOpen == null && read.homeCurrent == null) return null
        val flat = read.movedToward == null || read.moveSize == null || read.moveSize == 0.0
        val toward = when (read.movedToward) {
            PublicSide.away -> read.awaySideName
            PublicSide.home -> read.homeSideName
            null -> null
        }
        val text = when {
            flat -> if (read.current == null) "Opener only" else "Unchanged"
            market == PublicMarket.ml -> "Toward ${toward.orEmpty()}"
            else -> "${pointPhrase(read.moveSize ?: 0.0)} toward ${toward.orEmpty()}"
        }
        val mark = when {
            flat || read.current == null -> "⏸️"
            market == PublicMarket.total -> if (read.movedToward == PublicSide.away) "📈" else "📉"
            else -> "👉"
        }
        return PublicLineCaption(mark, text, flat, read.open == null && read.current != null)
    }

    /** Same order as the website feed. */
    fun ordered(
        games: List<PublicBettingGame>,
        sport: String,
        market: PublicMarket,
        sharpOnly: Boolean,
        query: String,
        sort: PublicBoardSort,
    ): List<PublicBettingGame> {
        val needle = query.trim().lowercase(Locale.US)
        return games.filter { game ->
            val read = game.reads[market] ?: return@filter false
            if (game.sport != sport) return@filter false
            if (sharpOnly && read.category != PublicCategory.sharpMoney) return@filter false
            needle.isEmpty() || haystack(game).contains(needle)
        }.sortedWith { a, b ->
            val readA = a.reads[market]
            val readB = b.reads[market]
            if (readA == null || readB == null) return@sortedWith a.id.compareTo(b.id)
            val primary = when (sort) {
                PublicBoardSort.time -> 0
                PublicBoardSort.money ->
                    maxOf(readB.moneyAway, readB.moneyHome).compareTo(maxOf(readA.moneyAway, readA.moneyHome))
                PublicBoardSort.diff -> splitGap(readB).compareTo(splitGap(readA))
                PublicBoardSort.sharp -> when {
                    comesBefore(readA, readB) -> -1
                    comesBefore(readB, readA) -> 1
                    else -> 0
                }
            }
            if (primary != 0) primary else {
                val byStart = startMs(a).compareTo(startMs(b))
                if (byStart != 0) byStart else a.id.compareTo(b.id)
            }
        }
    }

    fun comesBefore(a: PublicMarketRead, b: PublicMarketRead): Boolean {
        val rankA = a.category?.rank ?: 99
        val rankB = b.category?.rank ?: 99
        if (rankA != rankB) return rankA < rankB
        if (a.tiltPp != b.tiltPp) return a.tiltPp > b.tiltPp
        return (a.moveSize ?: -1.0) > (b.moveSize ?: -1.0)
    }

    fun games(rows: List<PublicBoardRow>): List<PublicBettingGame> {
        val order = mutableListOf<String>()
        val buckets = linkedMapOf<String, Bucket>()
        for (row in rows) {
            val market = runCatching { PublicMarket.valueOf(row.market) }.getOrNull() ?: continue
            if (row.gameId == 0 || row.sport.isEmpty()) continue
            val read = read(
                PublicMarketInput(
                    market, row.away, row.home, row.awayOpen, row.homeOpen, row.awayCons, row.homeCons,
                    row.betsAway, row.betsHome, row.moneyAway, row.moneyHome, row.tickets, row.hasSplit == true,
                ),
            )
            if (read.excluded) continue
            val key = "${row.sport}-${row.gameId}"
            val snap = row.snapTs?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }
            val existing = buckets[key]
            if (existing == null) {
                order += key
                buckets[key] = Bucket(row, mutableMapOf(market to read), snap, row.tickets)
            } else {
                existing.reads[market] = read
                if (snap != null && (existing.captured == null || snap > existing.captured!!)) existing.captured = snap
                if (row.tickets != null && row.tickets > (existing.tickets ?: 0.0)) existing.tickets = row.tickets
            }
        }
        return order.mapNotNull { key ->
            val bucket = buckets[key] ?: return@mapNotNull null
            PublicBettingGame(
                bucket.row.gameId, bucket.row.sport, bucket.row.away, bucket.row.home, bucket.row.startTime,
                bucket.captured, bucket.tickets?.roundToInt(), bucket.reads,
            )
        }
    }

    private fun sideName(market: PublicMarket, side: PublicSide, away: String, home: String): String {
        if (market == PublicMarket.total) return if (side == PublicSide.away) "the Over" else "the Under"
        return if (side == PublicSide.away) away else home
    }

    private fun pct(value: Double) = value.roundToInt().toString()

    private fun finite(value: Double?) = value?.takeIf { it.isFinite() }

    private fun deviggedAway(awayPrice: Double, homePrice: Double): Double {
        val away = impliedProbability(awayPrice)
        val home = impliedProbability(homePrice)
        return away / (away + home)
    }

    private fun splitGap(read: PublicMarketRead): Double =
        maxOf(abs(read.moneyAway - read.betsAway), abs(read.moneyHome - read.betsHome))

    private fun haystack(game: PublicBettingGame): String {
        val parts = mutableListOf(game.away, game.home)
        if (game.sport == "nfl") {
            parts += NFLTeams.abbr(game.away)
            parts += NFLTeams.abbr(game.home)
        }
        return parts.joinToString(" ").lowercase(Locale.US)
    }

    private fun startMs(game: PublicBettingGame): Long {
        val raw = game.startTime ?: return Long.MAX_VALUE
        return runCatching { Instant.parse(raw).toEpochMilli() }
            .recoverCatching { Instant.parse(raw.replace(" ", "T")).toEpochMilli() }
            .getOrDefault(Long.MAX_VALUE)
    }

    private fun pointPhrase(size: Double): String {
        val rounded = (size * 100).roundToInt() / 100.0
        val unit = if (rounded == 1.0) "point" else "points"
        return "${plain(rounded)} $unit"
    }

    private fun plain(value: Double): String {
        if (value == value.roundToInt().toDouble()) return value.roundToInt().toString()
        val tenths = (value * 10).roundToInt() / 10.0
        if (abs(value - tenths) < 0.001) return String.format(Locale.US, "%.1f", tenths)
        return String.format(Locale.US, "%.2f", value)
    }

    private class Bucket(
        val row: PublicBoardRow,
        val reads: MutableMap<PublicMarket, PublicMarketRead>,
        var captured: Long?,
        var tickets: Double?,
    )
}
