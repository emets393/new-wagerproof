package com.wagerproof.core.models

import kotlin.math.roundToInt

/** One sportsbook's price on one side of one market. Port of iOS `SportsbookQuote`. */
data class SportsbookQuote(
    val bookKey: String,
    val bookName: String,
    val line: Double?,
    val price: Int?,
)

/** Every book's quote on one market, ordered best-first. */
data class SportsbookMarketQuotes(
    val quotes: List<SportsbookQuote>,
    val capturedAt: String?,
) {
    val best: SportsbookQuote? get() = quotes.firstOrNull()

    fun quote(forBookKey: String?): SportsbookQuote? {
        val key = forBookKey ?: return null
        return quotes.firstOrNull { it.bookKey == key }
    }

    /**
     * The book a card should lead with: the BEST number among the books the
     * user actually holds, or the best overall when they haven't narrowed it.
     */
    fun preferred(bookKeys: Set<String>): SportsbookQuote? {
        if (bookKeys.isEmpty()) return best
        return quotes.firstOrNull { it.bookKey in bookKeys } ?: best
    }

    fun isFromSelection(bookKeys: Set<String>): Boolean {
        if (bookKeys.isEmpty()) return false
        val shown = preferred(bookKeys) ?: return false
        return shown.bookKey in bookKeys
    }
}

sealed class SportsbookMarket {
    data class Spread(val isHome: Boolean) : SportsbookMarket()
    data class Total(val isOver: Boolean) : SportsbookMarket()
    data class Moneyline(val isHome: Boolean) : SportsbookMarket()
    data class FirstHalfSpread(val isHome: Boolean) : SportsbookMarket()
    data class FirstHalfTotal(val isOver: Boolean) : SportsbookMarket()
    data class FirstFiveMoneyline(val isHome: Boolean) : SportsbookMarket()
    data class FirstFiveSpread(val isHome: Boolean) : SportsbookMarket()
    data class FirstFiveTotal(val isOver: Boolean) : SportsbookMarket()
}

object SportsbookCatalog {
    val names: Map<String, String> = mapOf(
        "draftkings" to "DraftKings",
        "fanduel" to "FanDuel",
        "betmgm" to "BetMGM",
        "betrivers" to "BetRivers",
        "williamhill_us" to "Caesars",
        "bovada" to "Bovada",
        "betus" to "BetUS",
        "betonlineag" to "BetOnline",
        "lowvig" to "LowVig",
        "mybookieag" to "MyBookie",
        "fanatics" to "Fanatics",
    )

    val selectable: List<String> = listOf(
        "draftkings", "fanduel", "betmgm", "betrivers", "williamhill_us",
        "fanatics", "bovada", "betus", "betonlineag", "lowvig", "mybookieag",
    )

    fun name(key: String): String = names[key] ?: key.replaceFirstChar { it.uppercase() }
}

object SportsbookPreference {
    const val DEFAULTS_KEY = "sportsbook.preferred"

    fun decode(raw: String?): Set<String> {
        if (raw.isNullOrEmpty()) return emptySet()
        return raw.split(",")
            .map { it.trim() }
            .filter { it in SportsbookCatalog.names }
            .toSet()
    }

    fun encode(keys: Set<String>): String = keys.sorted().joinToString(",")

    fun summary(keys: Set<String>): String = when (keys.size) {
        0 -> "Showing the best number from any book"
        1 -> "${SportsbookCatalog.name(keys.first())} — best number from your book"
        2, 3 -> "Best of ${keys.sorted().joinToString(", ") { SportsbookCatalog.name(it) }}"
        else -> "Best of your ${keys.size} books"
    }
}

data class SportsbookBookRow(
    val bookKey: String,
    val spreadHome: Double? = null,
    val spreadHomePrice: Double? = null,
    val spreadAway: Double? = null,
    val spreadAwayPrice: Double? = null,
    val totalPoint: Double? = null,
    val totalOverPrice: Double? = null,
    val totalUnderPrice: Double? = null,
    val mlHome: Double? = null,
    val mlAway: Double? = null,
    val h1SpreadHome: Double? = null,
    val h1SpreadHomePrice: Double? = null,
    val h1SpreadAway: Double? = null,
    val h1SpreadAwayPrice: Double? = null,
    val h1TotalPoint: Double? = null,
    val h1TotalOverPrice: Double? = null,
    val h1TotalUnderPrice: Double? = null,
    val f5SpreadHome: Double? = null,
    val f5SpreadHomePrice: Double? = null,
    val f5SpreadAway: Double? = null,
    val f5SpreadAwayPrice: Double? = null,
    val f5TotalPoint: Double? = null,
    val f5TotalOverPrice: Double? = null,
    val f5TotalUnderPrice: Double? = null,
    val f5MlHome: Double? = null,
    val f5MlAway: Double? = null,
)

data class SportsbookGameOdds(
    val rows: List<SportsbookBookRow>,
    val capturedAt: String?,
) {
    fun quotes(forMarket: SportsbookMarket): SportsbookMarketQuotes {
        val quotes = rows.mapNotNull { row ->
            val (line, price) = lineAndPrice(row, forMarket)
            if (line == null && price == null) null
            else SportsbookQuote(
                bookKey = row.bookKey,
                bookName = SportsbookCatalog.name(row.bookKey),
                line = line,
                price = price?.roundToInt(),
            )
        }.toMutableList()

        val low = wantsLowLine(forMarket)
        quotes.sortWith { lhs, rhs ->
            val l = lhs.line
            val r = rhs.line
            if (l != null && r != null && l != r) {
                if (low) l.compareTo(r) else r.compareTo(l)
            } else {
                (rhs.price ?: Int.MIN_VALUE).compareTo(lhs.price ?: Int.MIN_VALUE)
            }
        }
        return SportsbookMarketQuotes(quotes, capturedAt)
    }
}

private fun wantsLowLine(market: SportsbookMarket): Boolean = when (market) {
    is SportsbookMarket.Total -> market.isOver
    is SportsbookMarket.FirstHalfTotal -> market.isOver
    is SportsbookMarket.FirstFiveTotal -> market.isOver
    else -> false
}

private fun lineAndPrice(
    row: SportsbookBookRow,
    market: SportsbookMarket,
): Pair<Double?, Double?> = when (market) {
    is SportsbookMarket.Spread ->
        (if (market.isHome) row.spreadHome else row.spreadAway) to
            (if (market.isHome) row.spreadHomePrice else row.spreadAwayPrice)
    is SportsbookMarket.Total ->
        row.totalPoint to (if (market.isOver) row.totalOverPrice else row.totalUnderPrice)
    is SportsbookMarket.Moneyline ->
        null to (if (market.isHome) row.mlHome else row.mlAway)
    is SportsbookMarket.FirstHalfSpread ->
        (if (market.isHome) row.h1SpreadHome else row.h1SpreadAway) to
            (if (market.isHome) row.h1SpreadHomePrice else row.h1SpreadAwayPrice)
    is SportsbookMarket.FirstHalfTotal ->
        row.h1TotalPoint to (if (market.isOver) row.h1TotalOverPrice else row.h1TotalUnderPrice)
    is SportsbookMarket.FirstFiveMoneyline ->
        null to (if (market.isHome) row.f5MlHome else row.f5MlAway)
    is SportsbookMarket.FirstFiveSpread ->
        (if (market.isHome) row.f5SpreadHome else row.f5SpreadAway) to
            (if (market.isHome) row.f5SpreadHomePrice else row.f5SpreadAwayPrice)
    is SportsbookMarket.FirstFiveTotal ->
        row.f5TotalPoint to (if (market.isOver) row.f5TotalOverPrice else row.f5TotalUnderPrice)
}

object NflSportsbookCityNames {
    fun cityName(fullName: String): String = when (fullName) {
        "Los Angeles Chargers" -> "LA Chargers"
        "Los Angeles Rams" -> "LA Rams"
        "New York Giants" -> "NY Giants"
        "New York Jets" -> "NY Jets"
        else -> {
            val parts = fullName.trim().split(Regex("\\s+"))
            if (parts.size <= 1) fullName else parts.dropLast(1).joinToString(" ")
        }
    }
}

fun footballSportsbookMarket(
    cardGroup: String?,
    pickSide: String?,
    sport: String,
): SportsbookMarket? {
    val side = (pickSide ?: "").uppercase()
    val isHome = side.contains("HOME")
    return when (cardGroup?.lowercase()) {
        "spread" -> SportsbookMarket.Spread(isHome)
        "h1_spread" -> if (sport == "nfl") SportsbookMarket.FirstHalfSpread(isHome) else null
        "total" -> SportsbookMarket.Total(isOver = side != "UNDER")
        "h1_total" -> if (sport == "nfl") SportsbookMarket.FirstHalfTotal(isOver = side != "UNDER") else null
        "moneyline", "ml" -> SportsbookMarket.Moneyline(isHome)
        else -> null
    }
}
