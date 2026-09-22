package com.wagerproof.core.services

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.Serializable
import java.time.Instant

/**
 * Which (season, week) of a week-keyed football table a surface should show.
 *
 * ONE rule everywhere: the soonest UPCOMING kickoff, with a 6-hour grace so a game stays
 * selected while it is being played, falling back to the latest week only when nothing is
 * upcoming (end of season).
 *
 * Why not "latest season desc, week desc": that was safe only while the pipeline wrote one
 * week at a time. The Monday preview build (owner 2026-09-21) publishes NEXT week's slate on
 * Monday morning while the current week's Monday-night game is still pending — a max-week
 * anchor would jump the scoreboard, Outliers and the props surfaces to next week and drop
 * that game, which is still live and still bettable.
 *
 * Mirrors iOS `FootballSlateAnchor` and web `src/features/games/api/footballSlate.ts`.
 * Tables: `nfl_slate_feed`, `cfb_slate_feed`, `nfl_prop_player_pages` (all carry `kickoff`).
 */
object FootballSlateAnchor {

    @Serializable
    data class Week(val season: Int, val week: Int)

    suspend fun currentWeek(client: SupabaseClient, table: String): Week? {
        val graceIso = Instant.now().minusSeconds(6 * 60 * 60).toString()
        val upcoming = runCatching {
            client.from(table)
                .select(columns = Columns.raw("season,week")) {
                    filter { gte("kickoff", graceIso) }
                    order("kickoff", Order.ASCENDING)
                    limit(1)
                }
                .decodeList<Week>()
        }.getOrDefault(emptyList())
        upcoming.firstOrNull()?.let { return it }

        return runCatching {
            client.from(table)
                .select(columns = Columns.raw("season,week")) {
                    order("season", Order.DESCENDING)
                    order("week", Order.DESCENDING)
                    limit(1)
                }
                .decodeList<Week>()
        }.getOrDefault(emptyList()).firstOrNull()
    }
}
