package com.wagerproof.core.services

import com.wagerproof.core.models.CFBSportsbookTeamAliases
import com.wagerproof.core.models.NflSportsbookCityNames
import com.wagerproof.core.models.SportsbookBookRow
import com.wagerproof.core.models.SportsbookGameOdds
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.math.abs

/**
 * Per-book lines from `nfl_historical_odds`, `ncaaf_odds_history`, and
 * `mlb_odds_snapshots`. Port of iOS `SportsbookOddsService`.
 */
object SportsbookOddsService {
    private val mutex = Mutex()
    private val cache = mutableMapOf<String, SportsbookGameOdds>()

    @Serializable
    private data class NflOddsRow(
        @SerialName("snap_ts") val snapTs: String? = null,
        @SerialName("commence_time") val commenceTime: String? = null,
        val book: String,
        @SerialName("spread_home") val spreadHome: Double? = null,
        @SerialName("spread_home_price") val spreadHomePrice: Double? = null,
        @SerialName("spread_away") val spreadAway: Double? = null,
        @SerialName("spread_away_price") val spreadAwayPrice: Double? = null,
        @SerialName("total_point") val totalPoint: Double? = null,
        @SerialName("total_over_price") val totalOverPrice: Double? = null,
        @SerialName("total_under_price") val totalUnderPrice: Double? = null,
        @SerialName("ml_home") val mlHome: Double? = null,
        @SerialName("ml_away") val mlAway: Double? = null,
        @SerialName("h1_spread_home") val h1SpreadHome: Double? = null,
        @SerialName("h1_spread_home_price") val h1SpreadHomePrice: Double? = null,
        @SerialName("h1_spread_away") val h1SpreadAway: Double? = null,
        @SerialName("h1_spread_away_price") val h1SpreadAwayPrice: Double? = null,
        @SerialName("h1_total_point") val h1TotalPoint: Double? = null,
        @SerialName("h1_total_over_price") val h1TotalOverPrice: Double? = null,
        @SerialName("h1_total_under_price") val h1TotalUnderPrice: Double? = null,
    )

    @Serializable
    private data class CfbOddsRow(
        val snapshot: String? = null,
        @SerialName("commence_time") val commenceTime: String? = null,
        @SerialName("game_id") val oddsGameId: String,
        @SerialName("home_team") val homeTeam: String,
        @SerialName("away_team") val awayTeam: String,
        val book: String,
        @SerialName("home_ml") val homeMl: Double? = null,
        @SerialName("away_ml") val awayMl: Double? = null,
        @SerialName("spread_home") val spreadHome: Double? = null,
        @SerialName("spread_home_price") val spreadHomePrice: Double? = null,
        @SerialName("spread_away_price") val spreadAwayPrice: Double? = null,
        val total: Double? = null,
        @SerialName("over_price") val overPrice: Double? = null,
        @SerialName("under_price") val underPrice: Double? = null,
    )

    @Serializable
    private data class MlbOddsRow(
        @SerialName("fetched_at") val fetchedAt: String? = null,
        val bookmaker: String,
        @SerialName("home_ml") val homeMl: Double? = null,
        @SerialName("away_ml") val awayMl: Double? = null,
        @SerialName("home_spread") val homeSpread: Double? = null,
        @SerialName("away_spread") val awaySpread: Double? = null,
        @SerialName("home_spread_odds") val homeSpreadOdds: Double? = null,
        @SerialName("away_spread_odds") val awaySpreadOdds: Double? = null,
        @SerialName("total_line") val totalLine: Double? = null,
        @SerialName("total_over_odds") val totalOverOdds: Double? = null,
        @SerialName("total_under_odds") val totalUnderOdds: Double? = null,
        @SerialName("f5_home_ml") val f5HomeMl: Double? = null,
        @SerialName("f5_away_ml") val f5AwayMl: Double? = null,
        @SerialName("f5_home_spread") val f5HomeSpread: Double? = null,
        @SerialName("f5_away_spread") val f5AwaySpread: Double? = null,
        @SerialName("f5_home_spread_odds") val f5HomeSpreadOdds: Double? = null,
        @SerialName("f5_away_spread_odds") val f5AwaySpreadOdds: Double? = null,
        @SerialName("f5_total_line") val f5TotalLine: Double? = null,
        @SerialName("f5_total_over_odds") val f5TotalOverOdds: Double? = null,
        @SerialName("f5_total_under_odds") val f5TotalUnderOdds: Double? = null,
    )

    suspend fun odds(
        gameId: String,
        awayTeam: String,
        homeTeam: String,
        kickoff: String?,
    ): SportsbookGameOdds? {
        val cacheKey = "nfl:$gameId"
        mutex.withLock { cache[cacheKey] }?.let { return it }
        val away = NflSportsbookCityNames.cityName(awayTeam)
        val home = NflSportsbookCityNames.cityName(homeTeam)
        val rows = runCatching {
            SupabaseClients.cfb.from("nfl_historical_odds")
                .select {
                    filter {
                        eq("away_team", away)
                        eq("home_team", home)
                    }
                    order("snap_ts", Order.DESCENDING)
                    limit(400)
                }
                .decodeList<NflOddsRow>()
        }.getOrNull().orEmpty()
        if (rows.isEmpty()) return null

        val kickoffMs = parseMs(kickoff)
        val candidates = if (kickoffMs == null) {
            rows
        } else {
            rows.groupBy { it.commenceTime.orEmpty() }
                .minByOrNull { (stamp, _) ->
                    val ms = parseMs(stamp)
                    if (ms == null) Long.MAX_VALUE else abs(ms - kickoffMs)
                }
                ?.value
                ?: rows
        }
        val newest = candidates.mapNotNull { it.snapTs }.maxOrNull() ?: return null
        val result = SportsbookGameOdds(
            capturedAt = newest,
            rows = candidates.filter { it.snapTs == newest }.map { row ->
                SportsbookBookRow(
                    bookKey = row.book,
                    spreadHome = row.spreadHome,
                    spreadHomePrice = row.spreadHomePrice,
                    spreadAway = row.spreadAway,
                    spreadAwayPrice = row.spreadAwayPrice,
                    totalPoint = row.totalPoint,
                    totalOverPrice = row.totalOverPrice,
                    totalUnderPrice = row.totalUnderPrice,
                    mlHome = row.mlHome,
                    mlAway = row.mlAway,
                    h1SpreadHome = row.h1SpreadHome,
                    h1SpreadHomePrice = row.h1SpreadHomePrice,
                    h1SpreadAway = row.h1SpreadAway,
                    h1SpreadAwayPrice = row.h1SpreadAwayPrice,
                    h1TotalPoint = row.h1TotalPoint,
                    h1TotalOverPrice = row.h1TotalOverPrice,
                    h1TotalUnderPrice = row.h1TotalUnderPrice,
                )
            },
        )
        mutex.withLock { cache[cacheKey] = result }
        return result
    }

    suspend fun cfbOdds(
        gameId: String,
        awayTeam: String,
        homeTeam: String,
        kickoff: String?,
    ): SportsbookGameOdds? {
        val cacheKey = "cfb:$gameId"
        mutex.withLock { cache[cacheKey] }?.let { return it }
        val kickoffMs = parseMs(kickoff) ?: return null
        val lower = iso(kickoffMs - 4 * 60 * 60 * 1000)
        val upper = iso(kickoffMs + 4 * 60 * 60 * 1000)
        val rows = runCatching {
            SupabaseClients.cfb.from("ncaaf_odds_history")
                .select(
                    Columns.raw(
                        "snapshot,commence_time,game_id,home_team,away_team,book,home_ml,away_ml,spread_home,spread_home_price,spread_away_price,total,over_price,under_price",
                    ),
                ) {
                    filter {
                        gte("commence_time", lower)
                        lte("commence_time", upper)
                    }
                    order("snapshot", Order.DESCENDING)
                    limit(1000)
                }
                .decodeList<CfbOddsRow>()
        }.getOrNull().orEmpty()
        if (rows.isEmpty()) return null

        val matched = rows.filter {
            CFBSportsbookTeamAliases.matches(it.awayTeam, awayTeam) &&
                CFBSportsbookTeamAliases.matches(it.homeTeam, homeTeam)
        }
        if (matched.isEmpty()) return null
        val nearest = matched.groupBy { it.oddsGameId }
            .minByOrNull { (_, group) ->
                val ms = parseMs(group.firstOrNull()?.commenceTime)
                if (ms == null) Long.MAX_VALUE else abs(ms - kickoffMs)
            }
            ?.value
            ?: return null
        val newest = nearest.mapNotNull { it.snapshot }.maxOrNull() ?: return null
        val result = SportsbookGameOdds(
            capturedAt = newest,
            rows = nearest.filter { it.snapshot == newest }.map { row ->
                SportsbookBookRow(
                    bookKey = row.book,
                    spreadHome = row.spreadHome,
                    spreadHomePrice = row.spreadHomePrice,
                    spreadAway = row.spreadHome?.let { -it },
                    spreadAwayPrice = row.spreadAwayPrice,
                    totalPoint = row.total,
                    totalOverPrice = row.overPrice,
                    totalUnderPrice = row.underPrice,
                    mlHome = row.homeMl,
                    mlAway = row.awayMl,
                )
            },
        )
        mutex.withLock { cache[cacheKey] = result }
        return result
    }

    suspend fun mlbOdds(gamePk: Int): SportsbookGameOdds? {
        val cacheKey = "mlb:$gamePk"
        mutex.withLock { cache[cacheKey] }?.let { return it }
        val rows = runCatching {
            SupabaseClients.cfb.from("mlb_odds_snapshots")
                .select(
                    Columns.raw(
                        "fetched_at,bookmaker,home_ml,away_ml,home_spread,away_spread,home_spread_odds,away_spread_odds,total_line,total_over_odds,total_under_odds,f5_home_ml,f5_away_ml,f5_home_spread,f5_away_spread,f5_home_spread_odds,f5_away_spread_odds,f5_total_line,f5_total_over_odds,f5_total_under_odds",
                    ),
                ) {
                    filter { eq("game_pk", gamePk) }
                    order("fetched_at", Order.DESCENDING)
                    limit(100)
                }
                .decodeList<MlbOddsRow>()
        }.getOrNull().orEmpty()
        if (rows.isEmpty()) return null
        val newest = rows.mapNotNull { it.fetchedAt }.maxOrNull() ?: return null
        val result = SportsbookGameOdds(
            capturedAt = newest,
            rows = rows.filter { it.fetchedAt == newest }.map { row ->
                SportsbookBookRow(
                    bookKey = row.bookmaker.lowercase(),
                    spreadHome = row.homeSpread,
                    spreadHomePrice = row.homeSpreadOdds,
                    spreadAway = row.awaySpread,
                    spreadAwayPrice = row.awaySpreadOdds,
                    totalPoint = row.totalLine,
                    totalOverPrice = row.totalOverOdds,
                    totalUnderPrice = row.totalUnderOdds,
                    mlHome = row.homeMl,
                    mlAway = row.awayMl,
                    f5SpreadHome = row.f5HomeSpread,
                    f5SpreadHomePrice = row.f5HomeSpreadOdds,
                    f5SpreadAway = row.f5AwaySpread,
                    f5SpreadAwayPrice = row.f5AwaySpreadOdds,
                    f5TotalPoint = row.f5TotalLine,
                    f5TotalOverPrice = row.f5TotalOverOdds,
                    f5TotalUnderPrice = row.f5TotalUnderOdds,
                    f5MlHome = row.f5HomeMl,
                    f5MlAway = row.f5AwayMl,
                )
            },
        )
        mutex.withLock { cache[cacheKey] = result }
        return result
    }

    private fun parseMs(value: String?): Long? {
        if (value.isNullOrEmpty()) return null
        return runCatching { java.time.Instant.parse(value).toEpochMilli() }.getOrNull()
            ?: runCatching {
                java.time.OffsetDateTime.parse(value).toInstant().toEpochMilli()
            }.getOrNull()
    }

    private fun iso(epochMs: Long): String = java.time.Instant.ofEpochMilli(epochMs).toString()
}
