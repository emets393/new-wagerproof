package com.wagerproof.core.services

import com.wagerproof.core.models.SignalPerformance
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

enum class SignalSport(val raw: String) {
    NFL("nfl"),
    CFB("cfb"),
}

/**
 * Loads season-to-date signal records from `signal_performance` (CFB Supabase).
 * Refreshed weekly server-side via `refresh_all_signal_performance(season)`.
 * Season-to-date only — the all-time record lives in `*_signal_defs.typical_hit`
 * and must stay separate (see memory: signal ROI season vs all-time).
 */
class SignalPerformanceService {

    private val mutex = Mutex()
    private val cache = mutableMapOf<String, Map<String, SignalPerformance>>()

    /** All performance rows for a sport + season, keyed by `signal_key`. */
    suspend fun performances(sport: SignalSport, season: Int): Map<String, SignalPerformance> {
        val cacheKey = "${sport.raw}|$season"
        mutex.withLock {
            cache[cacheKey]?.let { return it }

            // Errors cache empty — signal cards render without the record line.
            val rows = runCatching {
                SupabaseClients.cfb
                    .from("signal_performance")
                    .select {
                        filter {
                            eq("sport", sport.raw)
                            eq("season", season)
                        }
                    }
                    .decodeList<SignalPerformance>()
            }.getOrNull() ?: run {
                cache[cacheKey] = emptyMap()
                return emptyMap()
            }

            val indexed = rows.associateBy { it.signalKey }
            cache[cacheKey] = indexed
            return indexed
        }
    }

    companion object {
        val shared = SignalPerformanceService()
    }
}
