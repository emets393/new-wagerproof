package com.wagerproof.core.services

import com.wagerproof.core.models.MLBLineupRow
import com.wagerproof.core.models.MLBPitcherArchetypeProfile
import com.wagerproof.core.models.MLBPlayerPropRow
import com.wagerproof.core.models.MLBPropMatchup
import com.wagerproof.core.models.MLBPropStarter
import com.wagerproof.core.models.MLBTeamMapping
import com.wagerproof.core.models.MLBTeams
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.rpc
import java.time.LocalDate
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Fetches and assembles the MLB player-props matchups feed from the CFB
 * (sports) Supabase project. Ports the RN `useMLBPitcherMatchups` +
 * `useMLBPlayerPropsL10` data flow:
 *
 *   1. `mlb_games_today`          schedule + starting pitchers (today..+2 ET)
 *   2. `mlb_game_lineups`         batting orders for those games
 *   3. `v_mlb_pitcher_archetypes` season archetype per starter
 *   4. `mlb_team_mapping`         abbreviation + logo
 *   5. `get_mlb_player_props_l10(p_game_pk)` RPC — prop ladder + game log,
 *      fetched per game in parallel (the slate is ~15 games).
 *
 * No auth needed — RLS on the CFB project exposes these to the anon role,
 * same as the games feed.
 */
class MLBPlayerPropsService {

    /**
     * Assemble every prop matchup for the current slate. Games without both
     * starters posted, or that are postponed, are dropped (matches RN).
     */
    suspend fun fetchMatchups(): List<MLBPropMatchup> = coroutineScope {
        val cfb = SupabaseClients.cfb

        // Step 1 — schedule window (today through +2 days, ET). Same window
        // the games feed uses so the two surfaces stay in sync.
        val startDate = ServiceDates.todayET()
        val endDate = ServiceDates.etDate(2)

        val gameRows = runCatching {
            cfb.from("mlb_games_today")
                .select {
                    filter {
                        gte("official_date", startDate)
                        lte("official_date", endDate)
                    }
                    order("official_date", Order.ASCENDING)
                    order("game_time_et", Order.ASCENDING)
                }
                .decodeList<GamesTodayRow>()
        }.getOrDefault(emptyList())

        // Only games with both starters posted and not postponed get props.
        val eligible = gameRows.filter { row ->
            row.isPostponed != true && row.awaySpId != null && row.homeSpId != null && row.gamePk != null
        }
        if (eligible.isEmpty()) return@coroutineScope emptyList()

        val gamePks = eligible.mapNotNull { it.gamePk }
        val pitcherIds = eligible.flatMap { listOfNotNull(it.awaySpId, it.homeSpId) }.distinct()
        val season = startDate.take(4).toIntOrNull() ?: LocalDate.now().year

        // Steps 2-4 + props (step 5) run concurrently.
        val lineupsDeferred = async { fetchLineups(gamePks) }
        val archetypesDeferred = async { fetchArchetypes(pitcherIds, season) }
        val mappingDeferred = async { fetchTeamMapping() }
        val propsDeferred = async { fetchAllProps(gamePks) }

        val lineups = lineupsDeferred.await()
        val archetypes = archetypesDeferred.await()
        val mapping = mappingDeferred.await()
        val propsByGame = propsDeferred.await()

        val lineupsByGame = lineups.groupBy { it.gamePk }
        val archetypeById = firstWins(archetypes) { it.pitcherId }
        val mappingByName = firstWins(mapping) { MLBTeams.normalize(it.teamName) }
        val mappingById = firstWins(mapping) { it.mlbApiId }

        eligible.mapNotNull { row ->
            val pk = row.gamePk ?: return@mapNotNull null
            val awaySpId = row.awaySpId ?: return@mapNotNull null
            val homeSpId = row.homeSpId ?: return@mapNotNull null

            val awayName = row.awayTeamName ?: row.awayTeam ?: "Away"
            val homeName = row.homeTeamName ?: row.homeTeam ?: "Home"

            // Resolve abbreviation + logo: mapping by id, then by name, then
            // the static team table (mirrors the games feed).
            val awayMapping = row.awayTeamId?.let { mappingById[it] } ?: mappingByName[MLBTeams.normalize(awayName)]
            val homeMapping = row.homeTeamId?.let { mappingById[it] } ?: mappingByName[MLBTeams.normalize(homeName)]
            val awayFallback = MLBTeams.info(awayName)
            val homeFallback = MLBTeams.info(homeName)
            val awayAbbr = awayMapping?.team ?: awayFallback?.team ?: fallbackAbbrev(awayName)
            val homeAbbr = homeMapping?.team ?: homeFallback?.team ?: fallbackAbbrev(homeName)

            val gameLineups = lineupsByGame[pk] ?: emptyList()
            val awayLineup = gameLineups
                .filter { row.awayTeamId != null && it.teamId == row.awayTeamId }
                .sortedBy { it.battingOrder ?: 999 }
            val homeLineup = gameLineups
                .filter { row.homeTeamId != null && it.teamId == row.homeTeamId }
                .sortedBy { it.battingOrder ?: 999 }

            val awayStarter = MLBPropStarter(
                pitcherId = awaySpId,
                name = row.awaySpName ?: "Away SP",
                teamLabel = awayName,
                hand = row.awaySpHand ?: "R",
                archetype = archetypeById[awaySpId],
            )
            val homeStarter = MLBPropStarter(
                pitcherId = homeSpId,
                name = row.homeSpName ?: "Home SP",
                teamLabel = homeName,
                hand = row.homeSpHand ?: "R",
                archetype = archetypeById[homeSpId],
            )

            MLBPropMatchup(
                gamePk = pk,
                officialDate = row.officialDate ?: startDate,
                gameTimeEt = row.gameTimeEt,
                awayTeamName = awayName,
                homeTeamName = homeName,
                awayAbbr = awayAbbr,
                homeAbbr = homeAbbr,
                awayLogoUrl = awayMapping?.logoUrl ?: awayFallback?.logoUrl,
                homeLogoUrl = homeMapping?.logoUrl ?: homeFallback?.logoUrl,
                awayStarter = awayStarter,
                homeStarter = homeStarter,
                awayLineup = awayLineup,
                homeLineup = homeLineup,
                props = propsByGame[pk] ?: emptyList(),
            )
        }
    }

    /**
     * Fetch the prop ladder + game log for a single game. Exposed for
     * callers that want to refresh one card. Throws on failure.
     */
    suspend fun fetchProps(gamePk: Int): List<MLBPlayerPropRow> =
        SupabaseClients.cfb.postgrest
            .rpc("get_mlb_player_props_l10", buildJsonObject { put("p_game_pk", gamePk) })
            .decodeList<MLBPlayerPropRow>()

    // MARK: - Sub-fetches (each swallows errors — one miss degrades, never fails the feed)

    private suspend fun fetchLineups(gamePks: List<Int>): List<MLBLineupRow> = runCatching {
        SupabaseClients.cfb
            .from("mlb_game_lineups")
            .select {
                filter { isIn("game_pk", gamePks) }
                order("batting_order", Order.ASCENDING)
            }
            .decodeList<MLBLineupRow>()
    }.getOrDefault(emptyList())

    private suspend fun fetchArchetypes(pitcherIds: List<Int>, season: Int): List<MLBPitcherArchetypeProfile> {
        if (pitcherIds.isEmpty()) return emptyList()
        return runCatching {
            SupabaseClients.cfb
                .from("v_mlb_pitcher_archetypes")
                .select(columns = Columns.raw("pitcher_id, archetype, k_pct, gb_pct, fb_pct, bb_pct, max_fb_velo")) {
                    filter {
                        eq("season", season)
                        isIn("pitcher_id", pitcherIds)
                    }
                }
                .decodeList<MLBPitcherArchetypeProfile>()
        }.getOrDefault(emptyList())
    }

    private suspend fun fetchTeamMapping(): List<MLBTeamMapping> = runCatching {
        SupabaseClients.cfb
            .from("mlb_team_mapping")
            .select()
            .decodeList<MLBTeamMapping>()
    }.getOrDefault(emptyList())

    /** Fan the RPC out per game; a failed game yields no props rather than failing the feed. */
    private suspend fun fetchAllProps(gamePks: List<Int>): Map<Int, List<MLBPlayerPropRow>> =
        coroutineScope {
            gamePks
                .map { pk ->
                    async { pk to runCatching { fetchProps(pk) }.getOrDefault(emptyList()) }
                }
                .awaitAll()
                .toMap()
        }

    companion object {
        val shared = MLBPlayerPropsService()

        /** Swift `Dictionary(_:uniquingKeysWith: { a, _ in a })` — first entry wins. */
        private fun <K, V> firstWins(items: List<V>, key: (V) -> K): Map<K, V> {
            val out = LinkedHashMap<K, V>()
            for (item in items) out.putIfAbsent(key(item), item)
            return out
        }

        /** Up to 3 word initials, uppercased ("San Diego Padres" → "SDP"). */
        private fun fallbackAbbrev(teamName: String): String {
            val trimmed = teamName.trim()
            if (trimmed.isEmpty()) return "MLB"
            return trimmed.split(" ")
                .filter { it.isNotEmpty() }
                .mapNotNull { it.firstOrNull() }
                .take(3)
                .joinToString("") { it.uppercase() }
        }
    }

    // MARK: - Schedule decode

    /**
     * Subset of `mlb_games_today` the props feed needs. Adds the starting
     * pitcher id/hand columns the games feed doesn't decode.
     */
    @Serializable
    private data class GamesTodayRow(
        @SerialName("game_pk") val gamePk: Int? = null,
        @SerialName("official_date") val officialDate: String? = null,
        @SerialName("game_time_et") val gameTimeEt: String? = null,
        @SerialName("away_team_name") val awayTeamName: String? = null,
        @SerialName("home_team_name") val homeTeamName: String? = null,
        @SerialName("away_team") val awayTeam: String? = null,
        @SerialName("home_team") val homeTeam: String? = null,
        @SerialName("away_team_id") val awayTeamId: Int? = null,
        @SerialName("home_team_id") val homeTeamId: Int? = null,
        @SerialName("is_postponed") val isPostponed: Boolean? = null,
        @SerialName("away_sp_id") val awaySpId: Int? = null,
        @SerialName("home_sp_id") val homeSpId: Int? = null,
        @SerialName("away_sp_name") val awaySpName: String? = null,
        @SerialName("home_sp_name") val homeSpName: String? = null,
        @SerialName("away_sp_hand") val awaySpHand: String? = null,
        @SerialName("home_sp_hand") val homeSpHand: String? = null,
    )
}
