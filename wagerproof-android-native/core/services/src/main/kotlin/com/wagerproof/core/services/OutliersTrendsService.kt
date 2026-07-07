package com.wagerproof.core.services

import com.wagerproof.core.models.MLBTeamMapping
import com.wagerproof.core.models.MLBTeamTrendRecord
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.models.MLBTrendsSlateBundle
import com.wagerproof.core.models.NFLCoachTrendRecord
import com.wagerproof.core.models.NFLPlayerPropTrendRecord
import com.wagerproof.core.models.NFLRefereeTrendRecord
import com.wagerproof.core.models.NFLTeamTrendRecord
import com.wagerproof.core.models.NFLTrendH2HCell
import com.wagerproof.core.models.NFLTrendMatchupRecord
import com.wagerproof.core.models.NFLTrendSplitCell
import com.wagerproof.core.models.NFLTrendSplits
import com.wagerproof.core.models.NFLTrendsSlateBundle
import com.wagerproof.core.models.OutliersTrendsBettingLine
import com.wagerproof.core.models.OutliersTrendsCard
import com.wagerproof.core.models.OutliersTrendsCardRow
import com.wagerproof.core.models.OutliersTrendsGame
import com.wagerproof.core.models.OutliersTrendsMLBContext
import com.wagerproof.core.models.OutliersTrendsSport
import com.wagerproof.core.models.OutliersTrendsSubjectKind
import com.wagerproof.core.models.objectValue
import com.wagerproof.core.models.serialization.FlexibleDoubleSerializer
import com.wagerproof.core.models.serialization.FlexibleIntSerializer
import com.wagerproof.core.models.serialization.FlexibleStringSerializer
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import java.time.ZonedDateTime
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

/**
 * Fetches NFL trend snapshots + dry-run slate from CFB Supabase.
 * Queries are scoped to the current slate and slim columns only — full-table
 * coach/ref pulls were ~4MB and timed out on device.
 */
class OutliersTrendsService {

    /** Pre-rendered trend cards for the active sport. */
    suspend fun fetchPrecomputedCards(
        sport: OutliersTrendsSport,
        season: Int,
        week: Int,
    ): List<OutliersTrendsCard> {
        val table = if (sport == OutliersTrendsSport.NCAAF) {
            "cfb_outliers_trend_cards"
        } else {
            "nfl_outliers_trend_cards"
        }
        val rows = SupabaseClients.cfb.from(table)
            .select(Columns.raw(TREND_CARD_COLUMNS)) {
                filter {
                    eq("season", season)
                    eq("week", week)
                }
                order("sort_rank", Order.DESCENDING)
            }
            .decodeList<TrendCardRow>()
        return rows.map { it.model() }
    }

    /** Current dry-run slate — latest season/week for the sport. */
    suspend fun fetchSlateGames(sport: OutliersTrendsSport): List<OutliersTrendsGame> =
        when (sport) {
            OutliersTrendsSport.NFL -> fetchNFLSlateGames()
            OutliersTrendsSport.NCAAF -> fetchCFBSlateGames()
            OutliersTrendsSport.MLB -> fetchMLBSlateGames()
            else -> emptyList()
        }

    /** Pre-rendered trend cards from `nfl_outliers_trend_cards`. */
    suspend fun fetchPrecomputedCards(season: Int, week: Int): List<OutliersTrendsCard> =
        fetchPrecomputedCards(OutliersTrendsSport.NFL, season, week)

    /** Current NFL dry-run slate — latest season/week only. */
    suspend fun fetchSlateGames(): List<OutliersTrendsGame> = fetchNFLSlateGames()

    private suspend fun fetchNFLSlateGames(): List<OutliersTrendsGame> {
        val cfb = SupabaseClients.cfb
        val anchor = cfb.from("nfl_dryrun_games")
            .select(Columns.raw("season,week")) {
                order("season", Order.DESCENDING)
                order("week", Order.DESCENDING)
                limit(1)
            }
            .decodeList<SlateWeekRow>()
        val slate = anchor.firstOrNull() ?: return emptyList()
        val rows = cfb.from("nfl_dryrun_games")
            .select(Columns.raw(GAME_COLUMNS)) {
                filter {
                    eq("season", slate.season)
                    eq("week", slate.week)
                }
                order("kickoff", Order.ASCENDING)
            }
            .decodeList<GameRow>()
        return rows.map { it.model() }
    }

    private suspend fun fetchCFBSlateGames(): List<OutliersTrendsGame> {
        val cfb = SupabaseClients.cfb
        val anchor = cfb.from("cfb_dryrun_games")
            .select(Columns.raw("season,week")) {
                order("season", Order.DESCENDING)
                order("week", Order.DESCENDING)
                limit(1)
            }
            .decodeList<SlateWeekRow>()
        val slate = anchor.firstOrNull() ?: return emptyList()
        val rows = cfb.from("cfb_dryrun_games")
            .select(Columns.raw(CFB_GAME_COLUMNS)) {
                filter {
                    eq("season", slate.season)
                    eq("week", slate.week)
                }
                order("kickoff", Order.ASCENDING)
            }
            .decodeList<CFBGameRow>()
        return rows.map { it.model() }
    }

    suspend fun fetchMLBBundle(): MLBTrendsSlateBundle {
        val games = fetchMLBSlateGames()
        val first = games.firstOrNull()
            ?: return MLBTrendsSlateBundle(
                games = emptyList(),
                season = currentMLBSeason(),
                throughDate = null,
                teams = emptyList(),
            )
        val teamAbbrs = games.flatMap { listOf(it.homeAb, it.awayAb) }.toSet().sorted()
        val trendsAbbrs = teamAbbrs.map { MLBTrendsEngine.trendsAbbr(it) }.toSet().sorted()
        val teamsRaw = fetchMLBTeamTrends(season = first.season, teamAbbrs = trendsAbbrs)
        val appAbbrByTrends = teamAbbrs.associateBy { MLBTrendsEngine.trendsAbbr(it) }
        val teams = teamsRaw.map { record ->
            MLBTrendsEngine.remapTeamRecord(record, appAbbrByTrends[record.teamAbbr.uppercase()])
        }
        val throughDate = teams.mapNotNull { it.throughDate }.maxOrNull()
        return MLBTrendsSlateBundle(
            games = games,
            season = first.season,
            throughDate = throughDate,
            teams = teams,
        )
    }

    private fun currentMLBSeason(): Int {
        val nowET = ZonedDateTime.now(ServiceDates.ET)
        return if (nowET.monthValue >= 3) nowET.year else nowET.year - 1
    }

    /**
     * Today's MLB slate only (`official_date` in ET). The nightly render job
     * repopulates `mlb_games_today` each morning; we keep showing this slate all day.
     */
    private suspend fun fetchMLBSlateGames(): List<OutliersTrendsGame> {
        val cfb = SupabaseClients.cfb
        val todayDate = ServiceDates.todayET()

        val rows = cfb.from("mlb_games_today")
            .select(Columns.raw(MLB_GAME_COLUMNS)) {
                filter { eq("official_date", todayDate) }
                order("game_time_et", Order.ASCENDING)
            }
            .decodeList<MLBGameRow>()

        val active = rows.filter { it.isPostponed != true }
        if (active.isEmpty()) return emptyList()

        val pks = active.mapNotNull { it.gamePk }
        val scheduleMeta = fetchMLBScheduleMeta(gamePks = pks, client = cfb)
        val oddsMeta = fetchMLBOddsSnapshots(gamePks = pks, client = cfb)
        val teamMaps = fetchMLBTeamAbbrMaps(client = cfb)
        val season = currentMLBSeason()

        return active.mapNotNull { row ->
            row.model(
                season = season,
                mapping = teamMaps.byName,
                mappingById = teamMaps.byId,
                schedule = scheduleMeta[row.gamePk ?: -1],
                odds = oddsMeta[row.gamePk ?: -1],
            )
        }
    }

    private suspend fun fetchMLBTeamTrends(
        season: Int,
        teamAbbrs: List<String>,
    ): List<MLBTeamTrendRecord> {
        if (teamAbbrs.isEmpty()) return emptyList()
        val rows = SupabaseClients.cfb.from("mlb_team_trends")
            .select(Columns.raw(MLB_TEAM_TREND_COLUMNS)) {
                filter {
                    eq("season", season)
                    isIn("team_abbr", teamAbbrs)
                }
            }
            .decodeList<MLBTeamTrendRow>()
        return rows.map { it.model() }
    }

    /**
     * Series game number lives on `mlb_signal_features_pregame`, not `mlb_schedule`.
     * Best-effort only — cards still build without series context if unavailable.
     */
    private suspend fun fetchMLBScheduleMeta(
        gamePks: List<Int>,
        client: SupabaseClient,
    ): Map<Int, MLBScheduleMetaRow> {
        if (gamePks.isEmpty()) return emptyMap()
        val rows = runCatching {
            client.from("mlb_signal_features_pregame")
                .select(Columns.raw("game_pk,series_game_number")) {
                    filter {
                        isIn("game_pk", gamePks)
                        eq("home_away", "home")
                    }
                }
                .decodeList<MLBScheduleMetaRow>()
        }.getOrDefault(emptyList())
        val byPk = mutableMapOf<Int, MLBScheduleMetaRow>()
        for (row in rows) {
            row.gamePk?.let { byPk[it] = row }
        }
        // Some slates lack home rows — backfill missing pks from either side.
        if (byPk.size < gamePks.size) {
            val fallback = runCatching {
                client.from("mlb_signal_features_pregame")
                    .select(Columns.raw("game_pk,series_game_number")) {
                        filter { isIn("game_pk", gamePks) }
                    }
                    .decodeList<MLBScheduleMetaRow>()
            }.getOrDefault(emptyList())
            for (row in fallback) {
                val pk = row.gamePk ?: continue
                if (byPk[pk] == null) byPk[pk] = row
            }
        }
        return byPk
    }

    private suspend fun fetchMLBOddsSnapshots(
        gamePks: List<Int>,
        client: SupabaseClient,
    ): Map<Int, MLBOddsSnapshotRow> {
        if (gamePks.isEmpty()) return emptyMap()
        val rows = runCatching {
            client.from("mlb_odds_snapshots")
                .select(Columns.raw(MLB_ODDS_SNAPSHOT_COLUMNS)) {
                    filter { isIn("game_pk", gamePks) }
                    order("fetched_at", Order.DESCENDING)
                }
                .decodeList<MLBOddsSnapshotRow>()
        }.getOrDefault(emptyList())
        // Ordered fetched_at desc, so first row per pk = latest snapshot.
        val byPk = mutableMapOf<Int, MLBOddsSnapshotRow>()
        for (row in rows) {
            val pk = row.gamePk ?: continue
            if (byPk[pk] == null) byPk[pk] = row
        }
        return byPk
    }

    private class MLBTeamAbbrMaps(
        val byName: Map<String, String>,
        val byId: Map<Int, String>,
    )

    private suspend fun fetchMLBTeamAbbrMaps(client: SupabaseClient): MLBTeamAbbrMaps {
        val rows = runCatching {
            client.from("mlb_team_mapping")
                .select(Columns.raw("mlb_api_id,team_name,team"))
                .decodeList<MLBTeamMapping>()
        }.getOrDefault(emptyList())
        val byName = mutableMapOf<String, String>()
        val byId = mutableMapOf<Int, String>()
        for (row in rows) {
            if (row.team.isEmpty()) continue
            byName[MLBTeams.normalize(row.teamName)] = row.team
            byId[row.mlbApiId] = row.team
        }
        return MLBTeamAbbrMaps(byName = byName, byId = byId)
    }

    suspend fun fetchNFLBundle(): NFLTrendsSlateBundle {
        val games = fetchSlateGames()
        val first = games.firstOrNull()
            ?: return NFLTrendsSlateBundle(
                games = emptyList(),
                season = 2025,
                throughWeek = 11,
                teams = emptyList(),
                coaches = emptyList(),
                referees = emptyList(),
                players = emptyList(),
            )
        return fetchTrendData(
            games = games,
            season = first.season,
            throughWeek = maxOf(1, first.week - 1),
        )
    }

    suspend fun fetchTrendData(
        games: List<OutliersTrendsGame>,
        season: Int,
        throughWeek: Int,
    ): NFLTrendsSlateBundle = coroutineScope {
        val cfb = SupabaseClients.cfb
        val teamAbbrs = games.flatMap { listOf(it.homeAb, it.awayAb) }.toSet().sorted()
        val refereeNames = games.mapNotNull { it.assignedReferee }
            .filter { it.isNotEmpty() }
            .toSet()
            .sorted()

        // Four parallel selects, all slate-scoped `in` lists — never full-table.
        val teamRows = async {
            cfb.from("nfl_team_trends")
                .select(Columns.raw(TEAM_COLUMNS)) {
                    filter {
                        eq("season", season)
                        eq("through_week", throughWeek)
                        isIn("team_abbr", teamAbbrs)
                    }
                }
                .decodeList<TeamRow>()
        }

        val coachRows = async {
            cfb.from("nfl_coach_trends")
                .select(Columns.raw(COACH_COLUMNS)) {
                    filter {
                        eq("through_season", season)
                        eq("through_week", throughWeek)
                        eq("last_season", season)
                        isIn("current_team", teamAbbrs)
                    }
                }
                .decodeList<CoachRow>()
        }

        val refRows = async {
            fetchRefereeRows(
                client = cfb,
                season = season,
                throughWeek = throughWeek,
                names = refereeNames,
            )
        }

        val playerRows = async {
            cfb.from("nfl_player_prop_trends")
                .select(Columns.raw(PLAYER_COLUMNS)) {
                    filter {
                        eq("through_season", season)
                        eq("through_week", throughWeek)
                        isIn("current_team", teamAbbrs)
                    }
                }
                .decodeList<PlayerRow>()
        }

        NFLTrendsSlateBundle(
            games = games,
            season = season,
            throughWeek = throughWeek,
            teams = teamRows.await().map { it.model() },
            coaches = coachRows.await().map { it.model() },
            referees = refRows.await().map { it.model() },
            players = playerRows.await().map { it.model() },
        )
    }

    private suspend fun fetchRefereeRows(
        client: SupabaseClient,
        season: Int,
        throughWeek: Int,
        names: List<String>,
    ): List<RefRow> {
        if (names.isEmpty()) return emptyList()
        return client.from("nfl_referee_trends")
            .select(Columns.raw(REF_COLUMNS)) {
                filter {
                    eq("through_season", season)
                    eq("through_week", throughWeek)
                    isIn("referee", names)
                }
            }
            .decodeList<RefRow>()
    }

    // MARK: - Row decoders

    @Serializable
    private data class TrendCardRow(
        @SerialName("card_id") val cardId: String,
        @SerialName("game_id") val gameId: String,
        @SerialName("matchup_label") val matchupLabel: String,
        @SerialName("subject_kind") val subjectKind: String,
        @SerialName("subject_name") val subjectName: String,
        @SerialName("subject_detail") val subjectDetail: String? = null,
        @SerialName("team_abbr") val teamAbbr: String? = null,
        @SerialName("player_id") val playerId: String? = null,
        @SerialName("market_key") val marketKey: String,
        @SerialName("bet_type_label") val betTypeLabel: String,
        @SerialName("trend_value") val trendValue: Double,
        @SerialName("trend_sample_n") val trendSampleN: Int,
        @SerialName("headshot_url") val headshotUrl: String? = null,
        val rows: List<TrendCardRowLine> = emptyList(),
        @SerialName("betting_lines") val bettingLines: List<TrendCardBettingLine> = emptyList(),
        @SerialName("is_player_overflow") val isPlayerOverflow: Boolean = false,
    ) {
        fun model(): OutliersTrendsCard = OutliersTrendsCard(
            id = cardId,
            gameId = gameId,
            matchupLabel = matchupLabel,
            subjectKind = OutliersTrendsSubjectKind.entries.firstOrNull { it.raw == subjectKind }
                ?: OutliersTrendsSubjectKind.TEAM,
            subjectName = subjectName,
            subjectDetail = subjectDetail,
            teamAbbr = teamAbbr,
            playerId = playerId,
            marketKey = marketKey,
            betTypeLabel = betTypeLabel,
            trendValue = trendValue,
            trendSampleN = trendSampleN,
            lineContext = null,
            headshotUrl = headshotUrl,
            bettingLines = bettingLines.map { it.model() },
            rows = rows.map { it.model() },
            isPlayerOverflow = isPlayerOverflow,
        )
    }

    @Serializable
    private data class TrendCardRowLine(
        val id: String,
        val text: String,
        @SerialName("coverage_note") val coverageNote: String? = null,
        @SerialName("dominant_pct") val dominantPct: Double,
        @SerialName("sample_n") val sampleN: Int,
    ) {
        fun model(): OutliersTrendsCardRow = OutliersTrendsCardRow(
            id = id,
            text = text,
            coverageNote = coverageNote,
            dominantPct = dominantPct,
            sampleN = sampleN,
        )
    }

    @Serializable
    private data class TrendCardBettingLine(
        val id: String,
        val label: String,
        @SerialName("line_text") val lineText: String,
        @SerialName("odds_text") val oddsText: String? = null,
        @SerialName("book_name") val bookName: String? = null,
        @SerialName("book_logo_url") val bookLogoUrl: String? = null,
        @SerialName("team_abbr") val teamAbbr: String? = null,
    ) {
        fun model(): OutliersTrendsBettingLine = OutliersTrendsBettingLine(
            id = id,
            label = label,
            lineText = lineText,
            oddsText = oddsText,
            bookName = bookName,
            bookLogoUrl = bookLogoUrl,
            teamAbbr = teamAbbr,
        )
    }

    @Serializable
    private data class SlateWeekRow(
        val season: Int,
        val week: Int,
    )

    @Serializable
    private data class GameRow(
        @SerialName("game_id") val gameId: String,
        val season: Int? = null,
        val week: Int? = null,
        @SerialName("home_ab") val homeAb: String? = null,
        @SerialName("away_ab") val awayAb: String? = null,
        @SerialName("home_team") val homeTeam: String? = null,
        @SerialName("away_team") val awayTeam: String? = null,
        @SerialName("fg_spread_close") val fgSpreadClose: Double? = null,
        @SerialName("fg_total_close") val fgTotalClose: Double? = null,
        val kickoff: String? = null,
        val slot: String? = null,
        @SerialName("assigned_referee") val assignedReferee: String? = null,
    ) {
        fun model(): OutliersTrendsGame = OutliersTrendsGame(
            id = gameId,
            season = season ?: 2025,
            week = week ?: 1,
            awayAb = awayAb ?: "???",
            homeAb = homeAb ?: "???",
            awayTeam = awayTeam ?: awayAb ?: "Away",
            homeTeam = homeTeam ?: homeAb ?: "Home",
            fgSpreadClose = fgSpreadClose,
            fgTotalClose = fgTotalClose,
            kickoff = kickoff,
            slot = slot,
            assignedReferee = assignedReferee,
        )
    }

    @Serializable
    private data class CFBGameRow(
        // game_id arrives as int OR string depending on the builder run.
        @Serializable(with = FlexibleStringSerializer::class)
        @SerialName("game_id") val gameId: String? = null,
        val season: Int? = null,
        val week: Int? = null,
        @SerialName("home_team") val homeTeam: String? = null,
        @SerialName("away_team") val awayTeam: String? = null,
        @SerialName("fg_spread_close") val fgSpreadClose: Double? = null,
        @SerialName("fg_total_close") val fgTotalClose: Double? = null,
        val kickoff: String? = null,
    ) {
        // CFB slate has no abbr columns — full names double as abbrs (matches Swift).
        fun model(): OutliersTrendsGame {
            val home = homeTeam ?: "Home"
            val away = awayTeam ?: "Away"
            return OutliersTrendsGame(
                id = gameId ?: "",
                season = season ?: 2025,
                week = week ?: 1,
                awayAb = away,
                homeAb = home,
                awayTeam = away,
                homeTeam = home,
                fgSpreadClose = fgSpreadClose,
                fgTotalClose = fgTotalClose,
                kickoff = kickoff,
                slot = null,
                assignedReferee = null,
            )
        }
    }

    @Serializable
    private data class MLBScheduleMetaRow(
        @SerialName("game_pk") val gamePk: Int? = null,
        @SerialName("series_game_number") val seriesGameNumber: Int? = null,
    )

    @Serializable
    private data class MLBOddsSnapshotRow(
        @Serializable(with = FlexibleIntSerializer::class)
        @SerialName("game_pk") val gamePk: Int? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("home_spread_odds") val homeSpreadOdds: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("away_spread_odds") val awaySpreadOdds: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("total_over_odds") val totalOverOdds: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("total_under_odds") val totalUnderOdds: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("f5_home_spread_odds") val f5HomeSpreadOdds: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("f5_away_spread_odds") val f5AwaySpreadOdds: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("f5_total_over_odds") val f5TotalOverOdds: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("f5_total_under_odds") val f5TotalUnderOdds: Double? = null,
    )

    @Serializable
    private data class MLBGameRow(
        @Serializable(with = FlexibleIntSerializer::class)
        @SerialName("game_pk") val gamePk: Int? = null,
        @SerialName("official_date") val officialDate: String? = null,
        @SerialName("game_time_et") val gameTimeEt: String? = null,
        @SerialName("away_team_name") val awayTeamName: String? = null,
        @SerialName("home_team_name") val homeTeamName: String? = null,
        @Serializable(with = FlexibleIntSerializer::class)
        @SerialName("away_team_id") val awayTeamId: Int? = null,
        @Serializable(with = FlexibleIntSerializer::class)
        @SerialName("home_team_id") val homeTeamId: Int? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("away_ml") val awayMl: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("home_ml") val homeMl: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("away_spread") val awaySpread: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("home_spread") val homeSpread: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("total_line") val totalLine: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("f5_away_ml") val f5AwayMl: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("f5_home_ml") val f5HomeMl: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("f5_away_spread") val f5AwaySpread: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("f5_home_spread") val f5HomeSpread: Double? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("f5_total_line") val f5TotalLine: Double? = null,
        @SerialName("is_postponed") val isPostponed: Boolean? = null,
    ) {
        fun model(
            season: Int,
            mapping: Map<String, String>,
            mappingById: Map<Int, String>,
            schedule: MLBScheduleMetaRow?,
            odds: MLBOddsSnapshotRow?,
        ): OutliersTrendsGame? {
            val pk = gamePk ?: return null
            val awayName = awayTeamName ?: "Away"
            val homeName = homeTeamName ?: "Home"
            // Abbr resolution chain: team_id map → name map → static brand map → prefix.
            val awayAb = awayTeamId?.let { mappingById[it] }
                ?: mapping[MLBTeams.normalize(awayName)]
                ?: MLBTeams.info(awayName)?.team
                ?: awayName.take(3).uppercase()
            val homeAb = homeTeamId?.let { mappingById[it] }
                ?: mapping[MLBTeams.normalize(homeName)]
                ?: MLBTeams.info(homeName)?.team
                ?: homeName.take(3).uppercase()
            val kickoff = gameTimeEt ?: officialDate
            val mlbContext = OutliersTrendsMLBContext(
                homeMl = homeMl,
                awayMl = awayMl,
                homeSpread = homeSpread,
                awaySpread = awaySpread,
                totalLine = totalLine,
                f5HomeMl = f5HomeMl,
                f5AwayMl = f5AwayMl,
                f5HomeSpread = f5HomeSpread,
                f5AwaySpread = f5AwaySpread,
                f5TotalLine = f5TotalLine,
                homeSpreadOdds = odds?.homeSpreadOdds,
                awaySpreadOdds = odds?.awaySpreadOdds,
                totalOverOdds = odds?.totalOverOdds,
                totalUnderOdds = odds?.totalUnderOdds,
                f5HomeSpreadOdds = odds?.f5HomeSpreadOdds,
                f5AwaySpreadOdds = odds?.f5AwaySpreadOdds,
                f5TotalOverOdds = odds?.f5TotalOverOdds,
                f5TotalUnderOdds = odds?.f5TotalUnderOdds,
                isDivisional = MLBTrendsEngine.isDivisionGame(homeAb, awayAb),
                isDayGame = MLBTrendsEngine.isDayGame(kickoff),
                seriesGameNumber = schedule?.seriesGameNumber,
            )
            return OutliersTrendsGame(
                id = pk.toString(),
                season = season,
                week = 0,
                awayAb = awayAb,
                homeAb = homeAb,
                awayTeam = awayName,
                homeTeam = homeName,
                fgSpreadClose = homeSpread,
                fgTotalClose = totalLine,
                kickoff = kickoff,
                slot = null,
                assignedReferee = null,
                mlbContext = mlbContext,
            )
        }
    }

    @Serializable
    private data class MLBTeamTrendRow(
        @SerialName("team_abbr") val teamAbbr: String? = null,
        // Legacy column name fallback — some builder runs wrote `team`.
        val team: String? = null,
        @SerialName("team_name") val teamName: String? = null,
        val season: Int = 2026,
        @SerialName("through_date") val throughDate: String? = null,
        val splits: JsonElement? = null,
        val matchups: JsonElement? = null,
    ) {
        fun model(): MLBTeamTrendRecord = MLBTeamTrendRecord(
            teamAbbr = teamAbbr ?: team ?: error("mlb_team_trends row missing team_abbr"),
            teamName = teamName,
            season = season,
            throughDate = throughDate,
            splits = decodeSplits(splits),
            matchups = decodeMatchups(matchups),
        )
    }

    @Serializable
    private data class TeamRow(
        @SerialName("team_abbr") val teamAbbr: String,
        @SerialName("team_name") val teamName: String? = null,
        val season: Int,
        @SerialName("through_week") val throughWeek: Int,
        val splits: JsonElement? = null,
        val matchups: JsonElement? = null,
    ) {
        fun model(): NFLTeamTrendRecord = NFLTeamTrendRecord(
            teamAbbr = teamAbbr,
            teamName = teamName,
            season = season,
            throughWeek = throughWeek,
            splits = decodeSplits(splits),
            matchups = decodeMatchups(matchups),
        )
    }

    @Serializable
    private data class CoachRow(
        val coach: String,
        @SerialName("current_team") val currentTeam: String? = null,
        @SerialName("career_games") val careerGames: Int? = null,
        @SerialName("last_season") val lastSeason: Int? = null,
        @SerialName("through_season") val throughSeason: Int,
        @SerialName("through_week") val throughWeek: Int,
        val splits: JsonElement? = null,
        val matchups: JsonElement? = null,
        @SerialName("market_coverage") val marketCoverage: Map<String, String>? = null,
    ) {
        fun model(): NFLCoachTrendRecord = NFLCoachTrendRecord(
            coach = coach,
            currentTeam = currentTeam,
            careerGames = careerGames,
            lastSeason = lastSeason,
            throughSeason = throughSeason,
            throughWeek = throughWeek,
            splits = decodeSplits(splits),
            matchups = decodeMatchups(matchups),
            marketCoverage = marketCoverage,
        )
    }

    @Serializable
    private data class RefRow(
        val referee: String,
        @SerialName("career_games") val careerGames: Int? = null,
        @SerialName("through_season") val throughSeason: Int,
        @SerialName("through_week") val throughWeek: Int,
        val splits: JsonElement? = null,
        @SerialName("market_coverage") val marketCoverage: Map<String, String>? = null,
    ) {
        fun model(): NFLRefereeTrendRecord = NFLRefereeTrendRecord(
            referee = referee,
            careerGames = careerGames,
            throughSeason = throughSeason,
            throughWeek = throughWeek,
            splits = decodeSplits(splits),
            marketCoverage = marketCoverage,
        )
    }

    @Serializable
    private data class PlayerRow(
        @SerialName("player_id") val playerId: String,
        @SerialName("player_name") val playerName: String? = null,
        val position: String? = null,
        @SerialName("current_team") val currentTeam: String? = null,
        val markets: List<String>? = null,
        val coverage: String? = null,
        @SerialName("through_season") val throughSeason: Int,
        @SerialName("through_week") val throughWeek: Int,
        val splits: JsonElement? = null,
        val matchups: JsonElement? = null,
    ) {
        fun model(): NFLPlayerPropTrendRecord = NFLPlayerPropTrendRecord(
            playerId = playerId,
            playerName = playerName,
            position = position,
            currentTeam = currentTeam,
            markets = markets ?: emptyList(),
            coverage = coverage,
            throughSeason = throughSeason,
            throughWeek = throughWeek,
            splits = decodeSplits(splits),
            matchups = decodeMatchups(matchups),
        )
    }

    companion object {
        val shared = OutliersTrendsService()

        private const val CFB_GAME_COLUMNS =
            "game_id,season,week,home_team,away_team,fg_spread_close,fg_total_close,kickoff"

        private const val GAME_COLUMNS =
            "game_id,season,week,home_ab,away_ab,home_team,away_team," +
                "fg_spread_close,fg_total_close,kickoff,slot,assigned_referee"

        private const val TEAM_COLUMNS = "team_abbr,team_name,season,through_week,splits,matchups"

        private const val COACH_COLUMNS =
            "coach,current_team,career_games,last_season,through_season,through_week," +
                "splits,matchups,market_coverage"

        private const val REF_COLUMNS =
            "referee,career_games,through_season,through_week,splits,market_coverage"

        private const val PLAYER_COLUMNS =
            "player_id,player_name,position,current_team,markets,coverage," +
                "through_season,through_week,splits,matchups"

        private const val TREND_CARD_COLUMNS =
            "card_id,game_id,matchup_label,subject_kind,subject_name,subject_detail," +
                "team_abbr,player_id,market_key,bet_type_label,trend_value,trend_sample_n," +
                "headshot_url,rows,betting_lines,is_player_overflow"

        private const val MLB_TEAM_TREND_COLUMNS =
            "team_abbr,team_name,season,through_date,splits,matchups"

        private const val MLB_GAME_COLUMNS =
            "game_pk,official_date,game_time_et,away_team_name,home_team_name," +
                "away_team_id,home_team_id,away_ml,home_ml,away_spread,home_spread,total_line," +
                "f5_away_ml,f5_home_ml,f5_away_spread,f5_home_spread,f5_total_line,is_postponed"

        private const val MLB_ODDS_SNAPSHOT_COLUMNS =
            "game_pk,home_spread_odds,away_spread_odds,total_over_odds,total_under_odds," +
                "f5_home_spread_odds,f5_away_spread_odds,f5_total_over_odds,f5_total_under_odds"

        // MARK: - Splits/matchups JSONB decoding
        // Shape: splits = {market: {dimension: {window: {h,l,p?,n,pct?}}}},
        // matchups = {opponentAbbr: {meetings?, <marketKey>: {h,n,pct?}}}.
        // pct defaults to h/n when the builder omitted it. String-typed numbers
        // are rejected, matching the Swift JSONValue decode order.

        private val JsonElement?.trendNumber: Double?
            get() = (this as? JsonPrimitive)?.takeUnless { it.isString }?.doubleOrNull

        private fun decodeSplits(value: JsonElement?): NFLTrendSplits {
            val root = value.objectValue ?: return emptyMap()
            val out = mutableMapOf<String, Map<String, Map<String, NFLTrendSplitCell>>>()
            for ((market, marketVal) in root) {
                val dims = marketVal.objectValue ?: continue
                val dimMap = mutableMapOf<String, Map<String, NFLTrendSplitCell>>()
                for ((dim, dimVal) in dims) {
                    val windows = dimVal.objectValue ?: continue
                    val winMap = mutableMapOf<String, NFLTrendSplitCell>()
                    for ((window, winVal) in windows) {
                        decodeSplitCell(winVal)?.let { winMap[window] = it }
                    }
                    if (winMap.isNotEmpty()) dimMap[dim] = winMap
                }
                if (dimMap.isNotEmpty()) out[market] = dimMap
            }
            return out
        }

        private fun decodeSplitCell(value: JsonElement): NFLTrendSplitCell? {
            val obj = value.objectValue ?: return null
            val h = obj["h"].trendNumber ?: return null
            val l = obj["l"].trendNumber ?: return null
            val n = obj["n"].trendNumber ?: return null
            val pct = obj["pct"].trendNumber ?: if (n > 0) h / n else 0.0
            val p = obj["p"].trendNumber?.toInt()
            return NFLTrendSplitCell(h = h.toInt(), l = l.toInt(), p = p, n = n.toInt(), pct = pct)
        }

        private fun decodeMatchups(value: JsonElement?): Map<String, NFLTrendMatchupRecord> {
            val root = value.objectValue ?: return emptyMap()
            val out = mutableMapOf<String, NFLTrendMatchupRecord>()
            for ((opp, oppVal) in root) {
                val obj = oppVal.objectValue ?: continue
                val markets = mutableMapOf<String, NFLTrendH2HCell>()
                for ((key, cellVal) in obj) {
                    if (key == "meetings") continue
                    decodeH2HCell(cellVal)?.let { markets[key] = it }
                }
                val meetings = obj["meetings"].trendNumber?.toInt()
                out[opp] = NFLTrendMatchupRecord(meetings = meetings, markets = markets)
            }
            return out
        }

        private fun decodeH2HCell(value: JsonElement): NFLTrendH2HCell? {
            val obj = value.objectValue ?: return null
            val h = obj["h"].trendNumber ?: return null
            val n = obj["n"].trendNumber ?: return null
            val pct = obj["pct"].trendNumber ?: if (n > 0) h / n else null
            return NFLTrendH2HCell(h = h.toInt(), n = n.toInt(), pct = pct)
        }
    }
}
