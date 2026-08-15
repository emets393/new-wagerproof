package com.wagerproof.core.services

import com.wagerproof.core.models.SportsbookCatalog
import com.wagerproof.core.models.SportsbookMarketQuotes
import com.wagerproof.core.models.SportsbookQuote
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.math.roundToInt

data class SportsbookPropMarketOdds(
    val over: SportsbookMarketQuotes,
    val under: SportsbookMarketQuotes,
)

/** Per-book NFL player-prop board from `nfl_player_props`. */
object SportsbookPropOddsService {
    private val mutex = Mutex()
    private val cache = mutableMapOf<String, SportsbookPropMarketOdds>()

    @Serializable
    private data class PropRow(
        val bookmaker: String,
        val line: Double? = null,
        @SerialName("over_odds") val overOdds: Double? = null,
        @SerialName("under_odds") val underOdds: Double? = null,
        @SerialName("snapshot_time") val snapshotTime: String? = null,
    )

    suspend fun odds(playerId: String, market: String): SportsbookPropMarketOdds? {
        val cacheKey = "$playerId|$market"
        mutex.withLock { cache[cacheKey] }?.let { return it }
        val rows = runCatching {
            SupabaseClients.cfb.from("nfl_player_props")
                .select(Columns.raw("bookmaker,line,over_odds,under_odds,snapshot_time")) {
                    filter {
                        eq("player_id", playerId)
                        eq("market", market)
                    }
                    order("snapshot_time", Order.DESCENDING)
                    limit(250)
                }
                .decodeList<PropRow>()
        }.getOrNull().orEmpty()
        val newest = rows.mapNotNull { it.snapshotTime }.maxOrNull() ?: return null
        val latest = rows.filter { it.snapshotTime == newest }
            .groupBy { it.bookmaker.lowercase() }
            .mapNotNull { it.value.firstOrNull() }
        if (latest.isEmpty()) return null
        val result = SportsbookPropMarketOdds(
            over = quotes(latest, isOver = true, capturedAt = newest),
            under = quotes(latest, isOver = false, capturedAt = newest),
        )
        mutex.withLock { cache[cacheKey] = result }
        return result
    }

    private fun quotes(
        rows: List<PropRow>,
        isOver: Boolean,
        capturedAt: String?,
    ): SportsbookMarketQuotes {
        val quotes = rows.mapNotNull { row ->
            val price = if (isOver) row.overOdds else row.underOdds
            if (row.line == null && price == null) return@mapNotNull null
            val key = row.bookmaker.lowercase()
            SportsbookQuote(
                bookKey = key,
                bookName = SportsbookCatalog.name(key),
                line = row.line,
                price = price?.roundToInt(),
            )
        }.toMutableList()
        quotes.sortWith { lhs, rhs ->
            val l = lhs.line
            val r = rhs.line
            if (l != null && r != null && l != r) {
                if (isOver) l.compareTo(r) else r.compareTo(l)
            } else {
                (rhs.price ?: Int.MIN_VALUE).compareTo(lhs.price ?: Int.MIN_VALUE)
            }
        }
        return SportsbookMarketQuotes(quotes, capturedAt)
    }
}
