package com.wagerproof.core.models

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Translates UI filter state into warehouse RPC `p_filters` JSON.
 * Full port of iOS `HistoricalAnalysisFilterBuilder` (the semantic contract):
 * percent ranges scale /100, favorite spreads emit negative bounds, streaks and
 * margins pass through signed, `season_min` is ALWAYS emitted, `side` is
 * suppressed on game totals, and `fav_dog` only applies on ML + team-total
 * markets (football). MLB emits `opp_last_result` (string) per the warehouse
 * engine — iOS sends `opp_last_won` there, which the MLB RPC ignores.
 */
object HistoricalAnalysisFilterBuilder {
    data class SpreadConfig(val max: Double, val minKey: String, val maxKey: String, val absMinKey: String, val absMaxKey: String)
    data class TotalConfig(val min: Double, val max: Double, val minKey: String, val maxKey: String, val label: String)

    private val nflSpread = mapOf(
        "fg_spread" to SpreadConfig(20.0, "spread_min", "spread_max", "abs_spread_min", "abs_spread_max"),
        "h1_spread" to SpreadConfig(14.0, "h1_spread_min", "h1_spread_max", "h1_abs_spread_min", "h1_abs_spread_max"),
    )

    // CFB spreads reach the low 50s (matches web CFBAnalytics.tsx SPREAD_CFG).
    private val cfbSpread = mapOf(
        "fg_spread" to SpreadConfig(50.0, "spread_min", "spread_max", "abs_spread_min", "abs_spread_max"),
        "h1_spread" to SpreadConfig(28.0, "h1_spread_min", "h1_spread_max", "h1_abs_spread_min", "h1_abs_spread_max"),
    )

    private val nflTotal = mapOf(
        "fg_total" to TotalConfig(30.0, 60.0, "total_min", "total_max", "Game total"),
        "h1_total" to TotalConfig(15.0, 35.0, "h1_total_min", "h1_total_max", "1H total"),
        "team_total" to TotalConfig(10.0, 40.0, "tt_min", "tt_max", "Team total line"),
    )

    private val cfbTotal = mapOf(
        "fg_total" to TotalConfig(30.0, 80.0, "total_min", "total_max", "Game total"),
        "h1_total" to TotalConfig(15.0, 45.0, "h1_total_min", "h1_total_max", "1H total"),
        "team_total" to TotalConfig(10.0, 55.0, "tt_min", "tt_max", "Team total line"),
    )

    private val mlbTotal = mapOf(
        "total" to TotalConfig(5.0, 14.0, "total_min", "total_max", "Game total"),
        "f5_total" to TotalConfig(2.0, 8.0, "f5_total_min", "f5_total_max", "F5 total"),
    )

    fun spreadConfig(sport: HistoricalAnalysisSport, betType: String): SpreadConfig? = when (sport) {
        HistoricalAnalysisSport.NFL -> nflSpread[betType]
        HistoricalAnalysisSport.CFB -> cfbSpread[betType]
        HistoricalAnalysisSport.MLB -> null
    }

    fun totalConfig(sport: HistoricalAnalysisSport, betType: String): TotalConfig? = when (sport) {
        HistoricalAnalysisSport.NFL -> nflTotal[betType]
        HistoricalAnalysisSport.CFB -> cfbTotal[betType]
        HistoricalAnalysisSport.MLB -> mlbTotal[betType]
    }

    fun seasonFloor(betType: String, sport: HistoricalAnalysisSport): Int = when {
        sport == HistoricalAnalysisSport.MLB -> 2023
        betType in HistoricalAnalysisBetType.limitedHistory -> 2023
        else -> sport.defaultSeasonFloor
    }

    fun buildRPCFilters(
        sport: HistoricalAnalysisSport,
        snapshot: HistoricalAnalysisUISnapshot,
        conferenceTeamMap: Map<String, List<String>> = emptyMap(),
    ): JsonObject {
        if (sport == HistoricalAnalysisSport.MLB) return buildMLBRPCFilters(snapshot)
        return buildJsonObject {
            val betType = snapshot.betType
            val spreadCfg = if (sport == HistoricalAnalysisSport.NFL) nflSpread else cfbSpread
            val totalCfg = if (sport == HistoricalAnalysisSport.NFL) nflTotal else cfbTotal
            // Game totals are game-level: Side / ML-odds don't apply.
            val isGameTotal = betType == "fg_total" || betType == "h1_total"

            // Always emit season_min (web parity) — an unbounded scan is the documented
            // statement-timeout risk, and rpc_filters must match across platforms.
            put("season_min", snapshot.seasonMin)
            if (snapshot.seasonMax < sport.seasonMax) put("season_max", snapshot.seasonMax)

            if (sport == HistoricalAnalysisSport.NFL) {
                when (snapshot.seasonType) {
                    "regular" -> {
                        put("season_type", "regular")
                        if (snapshot.weekMin > 1) put("week_min", snapshot.weekMin)
                        if (snapshot.weekMax < 18) put("week_max", snapshot.weekMax)
                    }
                    "postseason" -> {
                        put("season_type", "postseason")
                        if (snapshot.playoffRound != "any") put("playoff_round", snapshot.playoffRound)
                    }
                }
            } else {
                if (snapshot.gameType != "any") put("game_type", snapshot.gameType)
                if (snapshot.rankedMatchup != "any") put("ranked_matchup", snapshot.rankedMatchup)
                if (snapshot.gameType == "any" || snapshot.gameType == "regular") {
                    if (snapshot.weekMin > 1) put("week_min", snapshot.weekMin)
                    if (snapshot.weekMax < 16) put("week_max", snapshot.weekMax)
                }
            }

            if (snapshot.side != "any" && !isGameTotal) put("side", snapshot.side)

            // Explicit team / opponent multi-select. For CFB, explicit teams
            // override the conference→team expansion below.
            if (snapshot.teams.isNotEmpty()) put("team", JsonArray(snapshot.teams.map(::JsonPrimitive)))
            if (snapshot.opponents.isNotEmpty()) put("opponent", JsonArray(snapshot.opponents.map(::JsonPrimitive)))

            // Cross-market lines are sample filters, not result-market filters.
            spreadCfg["fg_spread"]?.let { cfg ->
                emitSpread(this, snapshot.spreadSide, snapshot.spreadMin, snapshot.spreadMax, cfg)
                // An opponent spread is the opposite signed subject-team spread.
                emitSpread(this, invertedSpreadSide(snapshot.oppSpreadSide), snapshot.oppSpreadMin, snapshot.oppSpreadMax, cfg)
            }
            spreadCfg["h1_spread"]?.let { cfg ->
                emitSpread(this, snapshot.h1SpreadSide, snapshot.h1SpreadMin, snapshot.h1SpreadMax, cfg)
            }

            if (snapshot.favDog != "any" &&
                (betType in HistoricalAnalysisBetType.moneylineMarkets || betType == "team_total")
            ) put("fav_dog", snapshot.favDog)

            emitMoneyline(this, snapshot.mlMin, snapshot.mlMax, "ml_min", "ml_max")
            emitMoneyline(this, snapshot.h1MlMin, snapshot.h1MlMax, "h1_ml_min", "h1_ml_max")
            emitMoneyline(this, snapshot.oppMlMin, snapshot.oppMlMax, "opp_ml_min", "opp_ml_max")

            totalCfg["fg_total"]?.let { emitTotal(this, snapshot.lineMin, snapshot.lineMax, it) }
            totalCfg["h1_total"]?.let { emitTotal(this, snapshot.h1TotalMin, snapshot.h1TotalMax, it) }
            totalCfg["team_total"]?.let { cfg ->
                emitTotal(this, snapshot.ttLineMin, snapshot.ttLineMax, cfg)
                emitTotal(
                    this, snapshot.oppTtLineMin, snapshot.oppTtLineMax,
                    TotalConfig(cfg.min, cfg.max, "opp_tt_min", "opp_tt_max", cfg.label),
                )
            }

            snapshot.primetime?.let { put("primetime", it) }

            if (sport == HistoricalAnalysisSport.NFL) {
                snapshot.division?.let { put("division", it) }
                if (snapshot.dome != "any") put("dome", snapshot.dome == "dome")
                if (snapshot.precip != "any") put("precip", snapshot.precip)
                if (snapshot.tempMin > -10) put("temp_min", snapshot.tempMin)
                if (snapshot.tempMax < 100) put("temp_max", snapshot.tempMax)
                snapshot.windMin?.takeIf { it > 0 }?.let { put("wind_min", it) }
                if (snapshot.windMax < 60) put("wind_max", snapshot.windMax)
                when (snapshot.restBye) {
                    "off_bye" -> put("rest_min", 13)
                    "short" -> put("rest_max", 4)
                    "pre_bye" -> put("pre_bye", true)
                }
                if (snapshot.coach != "any") put("coach", snapshot.coach)
                if (snapshot.referee != "any") put("referee", snapshot.referee)
            } else {
                snapshot.conferenceGame?.let { put("conference_game", it) }
                snapshot.neutralSite?.let { put("neutral_site", it) }
                val picked = snapshot.selectedConferences.filter(String::isNotBlank)
                if (snapshot.teams.isEmpty()) {
                    // Only expand conferences → team[] when the user hasn't already
                    // narrowed to specific schools via the Team picker.
                    when {
                        picked.size == 1 -> put("conference", picked.first())
                        picked.size > 1 -> {
                            val teams = picked.flatMap { conferenceTeamMap[it].orEmpty() }.distinct().sorted()
                            if (teams.isNotEmpty()) put("team", JsonArray(teams.map(::JsonPrimitive)))
                        }
                        snapshot.conference != "any" -> put("conference", snapshot.conference)
                    }
                } else if (picked.size == 1) {
                    put("conference", picked.first())
                } else if (picked.isEmpty() && snapshot.conference != "any") {
                    put("conference", snapshot.conference)
                }
                if (snapshot.tempMin > -10) put("temp_min", snapshot.tempMin)
                if (snapshot.tempMax < 110) put("temp_max", snapshot.tempMax)
                snapshot.windMin?.takeIf { it > 0 }?.let { put("wind_min", it) }
                if (snapshot.windMax < 60) put("wind_max", snapshot.windMax)
                if (snapshot.weather != "any") put("weather", snapshot.weather)   // CFBD weatherCondition
                if (snapshot.dome != "any") put("dome", snapshot.dome == "dome")  // CFBD gameIndoors
                // Rest/Bye — CFB short week is ≤6 (weekday after Saturday), not NFL's 4.
                when (snapshot.restBye) {
                    "off_bye" -> put("rest_min", 13)
                    "short" -> put("rest_max", 6)
                    "pre_bye" -> put("pre_bye", true)
                }
                if (snapshot.daysOfWeek.isNotEmpty()) {
                    put("day_of_week", JsonArray(snapshot.daysOfWeek.map(::JsonPrimitive)))
                }
            }

            // Football "last game" filters — team's PREVIOUS game.
            if (snapshot.lastResult != "any") put("last_won", if (snapshot.lastResult == "won") 1 else 0)
            if (snapshot.lastAts != "any") put("last_covered", if (snapshot.lastAts == "covered") 1 else 0)
            if (snapshot.lastTotal != "any") put("last_over", if (snapshot.lastTotal == "over") 1 else 0)
            if (snapshot.lastRole != "any") put("last_favorite", snapshot.lastRole == "favorite")
            snapshot.lastOt?.let { put("last_overtime", it) }

            val marginBound = if (sport == HistoricalAnalysisSport.CFB) 80 else 60
            if (snapshot.lastMargin[0] > -marginBound) put("last_margin_min", snapshot.lastMargin[0])
            if (snapshot.lastMargin[1] < marginBound) put("last_margin_max", snapshot.lastMargin[1])

            // NFL-only multi-selects (CFB day_of_week handled in the sport branch above).
            if (sport == HistoricalAnalysisSport.NFL && snapshot.daysOfWeek.isNotEmpty()) {
                put("day_of_week", JsonArray(snapshot.daysOfWeek.map(::JsonPrimitive)))
            }
            if (sport == HistoricalAnalysisSport.NFL && snapshot.teamDivisions.isNotEmpty()) {
                put("team_division", JsonArray(snapshot.teamDivisions.map(::JsonPrimitive)))
            }

            val ppgMax = if (sport == HistoricalAnalysisSport.CFB) 60.0 else 40.0
            val prevWinsMax = if (sport == HistoricalAnalysisSport.CFB) 15 else 16
            val coverMarginBound = if (sport == HistoricalAnalysisSport.CFB) 30.0 else 15.0
            val pointDiffBound = if (sport == HistoricalAnalysisSport.CFB) 40.0 else 20.0

            // Season Record (as-of)
            pctRange(this, "win_pct", snapshot.winPct)
            intRange(this, "win_streak", snapshot.winStreak, 0, 16)
            intRange(this, "loss_streak", snapshot.lossStreak, 0, 16)
            snapshot.above500?.let { put("above_500", it) }
            snapshot.winPctGtOpp?.let { put("win_pct_gt_opp", it) }
            numRange(this, "ppg", snapshot.ppg, 0.0, ppgMax)
            numRange(this, "pa_pg", snapshot.paPg, 0.0, ppgMax)
            numRange(this, "point_diff_pg", snapshot.pointDiffPg, -pointDiffBound, pointDiffBound)
            if (snapshot.minGames > 0) put("min_games", snapshot.minGames)

            // Cover Profile
            pctRange(this, "ats_win_pct", snapshot.atsWinPct)
            intRange(this, "ats_win_streak", snapshot.atsWinStreak, 0, 16)
            numRange(this, "avg_cover_margin", snapshot.avgCoverMargin, -coverMarginBound, coverMarginBound)

            // Total Profile
            pctRange(this, "over_pct", snapshot.overPct)
            intRange(this, "over_streak", snapshot.overStreak, 0, 16)
            intRange(this, "under_streak", snapshot.underStreak, 0, 16)

            // Prior Year
            intRange(this, "prev_wins", snapshot.prevWins, 0, prevWinsMax)
            pctRange(this, "prev_win_pct", snapshot.prevWinPct)
            snapshot.madePlayoffsPrev?.let { put("made_playoffs_prev", it) }
            snapshot.moreWinsThanOppPrev?.let { put("more_wins_than_opp_prev", it) }

            // Head-to-Head
            if (snapshot.h2hLastWin != "any") put("h2h_last_win", if (snapshot.h2hLastWin == "yes") 1 else 0)
            if (snapshot.h2hLastAts != "any") put("h2h_last_ats_win", if (snapshot.h2hLastAts == "yes") 1 else 0)
            if (snapshot.h2hLastOver != "any") put("h2h_last_over", if (snapshot.h2hLastOver == "yes") 1 else 0)
            snapshot.h2hLastHome?.let { put("h2h_last_home", it) }
            snapshot.h2hLastFav?.let { put("h2h_last_fav", it) }
            snapshot.h2hSameSeason?.let { put("h2h_same_season", it) }
            if (snapshot.h2hSpreadCmp == "lower") put("h2h_spread_lower", true)
            if (snapshot.h2hSpreadCmp == "higher") put("h2h_spread_higher", true)

            // Opponent Record
            pctRange(this, "opp_win_pct", snapshot.oppWinPct)
            pctRange(this, "opp_over_pct", snapshot.oppOverPct)
            intRange(this, "opp_win_streak", snapshot.oppWinStreak, 0, 16)
            intRange(this, "opp_loss_streak", snapshot.oppLossStreak, 0, 16)
            numRange(this, "opp_ppg", snapshot.oppPpg, 0.0, ppgMax)
            numRange(this, "opp_pa_pg", snapshot.oppPaPg, 0.0, ppgMax)
            pctRange(this, "opp_prev_win_pct", snapshot.oppPrevWinPct)

            // Opponent Last Game
            if (snapshot.oppLastResult != "any") put("opp_last_won", if (snapshot.oppLastResult == "won") 1 else 0)
            if (snapshot.oppLastAts != "any") put("opp_last_covered", if (snapshot.oppLastAts == "covered") 1 else 0)
            if (snapshot.oppLastTotal != "any") put("opp_last_over", if (snapshot.oppLastTotal == "over") 1 else 0)
            if (snapshot.oppLastRole != "any") put("opp_last_favorite", snapshot.oppLastRole == "favorite")
            snapshot.oppLastOt?.let { put("opp_last_overtime", it) }
            if (snapshot.oppLastMargin[0] > -marginBound) put("opp_last_margin_min", snapshot.oppLastMargin[0])
            if (snapshot.oppLastMargin[1] < marginBound) put("opp_last_margin_max", snapshot.oppLastMargin[1])
        }
    }

    /** Port of iOS `buildMLBRPCFilters` — omit unset keys; never invent the other end of a range. */
    fun buildMLBRPCFilters(snapshot: HistoricalAnalysisUISnapshot): JsonObject = buildJsonObject {
        val sport = HistoricalAnalysisSport.MLB

        put("season_min", snapshot.seasonMin)
        if (snapshot.seasonMax < sport.seasonMax) put("season_max", snapshot.seasonMax)
        if (snapshot.monthMin > 3) put("month_min", snapshot.monthMin)
        if (snapshot.monthMax < 11) put("month_max", snapshot.monthMax)
        if (snapshot.teams.isNotEmpty()) {
            put("team", JsonArray(snapshot.teams.map { MLBF5.toSplitTeamAbbr(it) }.distinct().map(::JsonPrimitive)))
        }
        if (snapshot.opponents.isNotEmpty()) {
            put("opponent", JsonArray(snapshot.opponents.map { MLBF5.toSplitTeamAbbr(it) }.distinct().map(::JsonPrimitive)))
        }
        snapshot.division?.let { put("division", it) }
        snapshot.interleague?.let { put("interleague", it) }
        if (snapshot.side != "any") put("side", snapshot.side)
        if (snapshot.favDog != "any") put("fav_dog", snapshot.favDog)

        snapshot.mlMin.trim().toDoubleOrNull()?.let { put("ml_min", it) }
        snapshot.mlMax.trim().toDoubleOrNull()?.let { put("ml_max", it) }

        // Totals are cross-market sample filters on web ("available on every bet
        // type") — game total and F5 total are independent dims, both always
        // emitted regardless of the selected bet type.
        mlbTotal.getValue("total").let { cfg ->
            if (snapshot.lineMin > cfg.min) put("total_min", snapshot.lineMin)
            if (snapshot.lineMax < cfg.max) put("total_max", snapshot.lineMax)
        }

        // RPC does jsonb_array_elements on day_of_week — a scalar string errors the
        // whole query. Must be an array even for a single day; legacy single-day
        // `dayOfWeek` only used when the multi-select is empty.
        if (snapshot.daysOfWeek.isNotEmpty()) {
            put("day_of_week", JsonArray(snapshot.daysOfWeek.map(::JsonPrimitive)))
        } else if (snapshot.dayOfWeek != "any") {
            put("day_of_week", JsonArray(listOf(JsonPrimitive(snapshot.dayOfWeek))))
        }
        if (snapshot.timeMin.isNotBlank()) put("time_min", snapshot.timeMin)
        if (snapshot.timeMax.isNotBlank()) put("time_max", snapshot.timeMax)
        if (snapshot.f5TotalMin > 2) put("f5_total_min", snapshot.f5TotalMin)
        if (snapshot.f5TotalMax < 8) put("f5_total_max", snapshot.f5TotalMax)
        snapshot.doubleheader?.let { put("doubleheader", it) }
        snapshot.seriesGameMin?.let { put("series_game_min", it) }
        snapshot.seriesGameMax?.let { put("series_game_max", it) }
        snapshot.tripMin?.let { put("trip_min", it) }
        snapshot.tripMax?.let { put("trip_max", it) }
        snapshot.switchGame?.let { put("switch_game", it) }
        snapshot.restMin?.let { put("rest_min", it) }
        snapshot.restMax?.let { put("rest_max", it) }

        // Signed current streak (+W / −L) — legacy string fields written by the slider.
        snapshot.streakMin.trim().toDoubleOrNull()?.let { put("streak_min", it) }
        snapshot.streakMax.trim().toDoubleOrNull()?.let { put("streak_max", it) }

        if (snapshot.lastResult != "any") put("last_result", snapshot.lastResult)
        if (snapshot.lastAts != "any") put("last_covered", if (snapshot.lastAts == "covered") 1 else 0)
        if (snapshot.lastTotal != "any") put("last_over", if (snapshot.lastTotal == "over") 1 else 0)
        if (snapshot.lastRole != "any") put("last_favorite", snapshot.lastRole == "favorite")

        // Legacy string last-margin fields (back-compat) OR the shared numeric
        // `lastMargin` range (current slider UI) — string fields win if set.
        val marginA = snapshot.lastMarginMin.trim().toDoubleOrNull()
        val marginB = snapshot.lastMarginMax.trim().toDoubleOrNull()
        if (marginA != null) put("last_margin_min", marginA)
        else if (snapshot.lastMargin[0] > -30) put("last_margin_min", snapshot.lastMargin[0])
        if (marginB != null) put("last_margin_max", marginB)
        else if (snapshot.lastMargin[1] < 30) put("last_margin_max", snapshot.lastMargin[1])

        if (snapshot.sp.isNotEmpty()) put("sp", JsonArray(snapshot.sp.map { JsonPrimitive(it.id) }))
        if (snapshot.oppSp.isNotEmpty()) put("opp_sp", JsonArray(snapshot.oppSp.map { JsonPrimitive(it.id) }))
        if (snapshot.spHand != "any") put("sp_hand", snapshot.spHand)
        if (snapshot.oppSpHand != "any") put("opp_sp_hand", snapshot.oppSpHand)

        // Pitching quality — starters + bullpen xFIP, bullpen IP last 3 days.
        doubleRange(this, "sp_xfip_min", "sp_xfip_max", snapshot.spXfipMin, snapshot.spXfipMax, 2.0, 7.0)
        doubleRange(this, "opp_sp_xfip_min", "opp_sp_xfip_max", snapshot.oppSpXfipMin, snapshot.oppSpXfipMax, 2.0, 7.0)
        doubleRange(this, "bp_ip3d_min", "bp_ip3d_max", snapshot.bpIpMin, snapshot.bpIpMax, 0.0, 20.0)
        doubleRange(this, "bp_xfip_min", "bp_xfip_max", snapshot.bpXfipMin, snapshot.bpXfipMax, 2.0, 7.0)

        // Web parity: the MLB temp control floors at 30; a restored web snapshot
        // carries [30,110] untouched and must NOT become an always-on temp_min.
        if (snapshot.tempMin > 30) put("temp_min", snapshot.tempMin)
        if (snapshot.tempMax < 110) put("temp_max", snapshot.tempMax)
        snapshot.windMin?.takeIf { it > 0 }?.let { put("wind_min", it) }
        if (snapshot.windMax < 40) put("wind_max", snapshot.windMax)
        if (snapshot.windDir != "any") put("wind_dir", snapshot.windDir)
        if (snapshot.dome != "any") put("dome", snapshot.dome == "dome")
        snapshot.pfRunsMin?.let { put("pf_runs_min", it) }
        snapshot.pfRunsMax?.let { put("pf_runs_max", it) }

        // Season Record (as-of) — shared fields with football, MLB default ranges.
        pctRange(this, "win_pct", snapshot.winPct)
        intRange(this, "win_streak", snapshot.winStreak, 0, 25)
        intRange(this, "loss_streak", snapshot.lossStreak, 0, 25)
        numRange(this, "rpg", snapshot.rpg, 0.0, 10.0)
        numRange(this, "rapg", snapshot.rapg, 0.0, 10.0)
        numRange(this, "run_diff_pg", snapshot.runDiffPg, -4.0, 4.0)
        if (snapshot.minGames > 0) put("min_games", snapshot.minGames)

        // Run Line Profile
        pctRange(this, "rl_cover_pct", snapshot.rlCoverPct)
        intRange(this, "rl_streak", snapshot.rlStreak, 0, 25)

        // Total Profile
        pctRange(this, "over_pct", snapshot.overPct)
        intRange(this, "over_streak", snapshot.overStreak, 0, 25)
        intRange(this, "under_streak", snapshot.underStreak, 0, 25)

        // Prior Year
        intRange(this, "prev_wins", snapshot.prevWins, 0, 120)
        pctRange(this, "prev_win_pct", snapshot.prevWinPct)

        // Head-to-Head
        if (snapshot.h2hLastWin != "any") put("h2h_last_win", if (snapshot.h2hLastWin == "yes") 1 else 0)
        if (snapshot.h2hLastAts != "any") put("h2h_last_ats_win", if (snapshot.h2hLastAts == "yes") 1 else 0)
        if (snapshot.h2hLastOver != "any") put("h2h_last_over", if (snapshot.h2hLastOver == "yes") 1 else 0)
        intRange(this, "h2h_last_margin", snapshot.h2hLastMargin, -30, 30)
        snapshot.h2hLastHome?.let { put("h2h_last_home", it) }
        snapshot.h2hLastFav?.let { put("h2h_last_fav", it) }
        snapshot.h2hSameSeason?.let { put("h2h_same_season", it) }

        // Opponent Record
        pctRange(this, "opp_win_pct", snapshot.oppWinPct)
        pctRange(this, "opp_over_pct", snapshot.oppOverPct)
        pctRange(this, "opp_rl_cover_pct", snapshot.oppRlCoverPct)
        intRange(this, "opp_win_streak", snapshot.oppWinStreak, 0, 25)
        intRange(this, "opp_loss_streak", snapshot.oppLossStreak, 0, 25)
        numRange(this, "opp_rpg", snapshot.oppRpg, 0.0, 10.0)
        numRange(this, "opp_rapg", snapshot.oppRapg, 0.0, 10.0)
        pctRange(this, "opp_prev_win_pct", snapshot.oppPrevWinPct)

        // Opponent last game — the MLB engine reads `opp_last_result` ('won'/'lost')
        // per mlb_system_rows.sql / trendFilterKeys, mirroring `last_result` above.
        if (snapshot.oppLastResult != "any") put("opp_last_result", snapshot.oppLastResult)
        if (snapshot.oppLastAts != "any") put("opp_last_covered", if (snapshot.oppLastAts == "covered") 1 else 0)
        if (snapshot.oppLastTotal != "any") put("opp_last_over", if (snapshot.oppLastTotal == "over") 1 else 0)
        if (snapshot.oppLastRole != "any") put("opp_last_favorite", snapshot.oppLastRole == "favorite")
        intRange(this, "opp_last_margin", snapshot.oppLastMargin, -30, 30)
    }

    /** Port of iOS `mlbFiltersWeatherOnly` — upcoming RPC should get `{}` when only weather keys are set. */
    fun mlbFiltersWeatherOnly(filters: JsonObject): Boolean {
        if (filters.isEmpty()) return false
        val weather = setOf("temp_min", "temp_max", "wind_min", "wind_max", "wind_dir")
        return filters.keys.all { it in weather }
    }

    /** Hide degenerate breakdown bars — each side must be ≥10% of the split. */
    fun nonDegenerateBars(bars: List<HistoricalAnalysisBar>): List<HistoricalAnalysisBar> = bars.filter { bar ->
        val total = bar.options.sumOf { it.n }
        total > 0 && bar.options.all { it.n > 0 && it.n.toDouble() / total >= 0.1 }
    }

    /**
     * Bars to render — non-degenerate AND not redundant with an active side filter.
     * When the user pins home/away or favorite/underdog, hide that breakdown dimension.
     */
    fun shownBars(bars: List<HistoricalAnalysisBar>, snapshot: HistoricalAnalysisUISnapshot): List<HistoricalAnalysisBar> =
        nonDegenerateBars(bars).filterNot { bar ->
            when (bar.dimension) {
                "home_away" -> snapshot.side != "any"
                "fav_dog" -> when {
                    snapshot.betType in setOf("fg_spread", "h1_spread", "rl", "f5_rl") ->
                        snapshot.spreadSide != "any" || snapshot.favDog != "any"
                    snapshot.betType in HistoricalAnalysisBetType.moneylineMarkets ||
                        snapshot.betType == "team_total" ||
                        snapshot.betType in setOf("ml", "f5_ml") -> snapshot.favDog != "any"
                    else -> false
                }
                else -> false
            }
        }

    // MARK: - Range helpers (emit only when narrowed from default)

    /** Percent range: UI 0–100 → RPC 0–1 fraction. */
    private fun pctRange(
        builder: kotlinx.serialization.json.JsonObjectBuilder,
        key: String,
        range: List<Double>,
    ) {
        if (range[0] > 0.0) builder.put("${key}_min", range[0] / 100.0)
        if (range[1] < 100.0) builder.put("${key}_max", range[1] / 100.0)
    }

    private fun numRange(
        builder: kotlinx.serialization.json.JsonObjectBuilder,
        key: String,
        range: List<Double>,
        defLo: Double,
        defHi: Double,
    ) {
        if (range[0] > defLo) builder.put("${key}_min", range[0])
        if (range[1] < defHi) builder.put("${key}_max", range[1])
    }

    private fun intRange(
        builder: kotlinx.serialization.json.JsonObjectBuilder,
        key: String,
        range: List<Int>,
        defLo: Int,
        defHi: Int,
    ) {
        if (range[0] > defLo) builder.put("${key}_min", range[0])
        if (range[1] < defHi) builder.put("${key}_max", range[1])
    }

    private fun doubleRange(
        builder: kotlinx.serialization.json.JsonObjectBuilder,
        minKey: String,
        maxKey: String,
        lo: Double,
        hi: Double,
        defLo: Double,
        defHi: Double,
    ) {
        if (lo > defLo) builder.put(minKey, lo)
        if (hi < defHi) builder.put(maxKey, hi)
    }

    private fun invertedSpreadSide(side: String): String = when (side) {
        "favorite" -> "underdog"
        "underdog" -> "favorite"
        else -> "any"
    }

    private fun emitSpread(
        builder: kotlinx.serialization.json.JsonObjectBuilder,
        side: String,
        min: Double,
        max: Double,
        cfg: SpreadConfig,
    ) {
        val minDog = kotlin.math.max(min, 0.5)
        when (side) {
            // Favorites carry negative spreads — emit negative bounds, excluding pick'em.
            "favorite" -> {
                builder.put(cfg.minKey, -max)
                builder.put(cfg.maxKey, -minDog)
            }
            "underdog" -> {
                builder.put(cfg.minKey, minDog)
                builder.put(cfg.maxKey, max)
            }
            else -> if (min > 0 || max < cfg.max) {
                builder.put(cfg.absMinKey, min)
                builder.put(cfg.absMaxKey, max)
            }
        }
    }

    private fun emitMoneyline(
        builder: kotlinx.serialization.json.JsonObjectBuilder,
        min: String,
        max: String,
        minKey: String,
        maxKey: String,
    ) {
        var lo = min.trim().toDoubleOrNull()
        var hi = max.trim().toDoubleOrNull()
        if (lo != null && hi != null && lo > hi) {
            val t = lo; lo = hi; hi = t
        }
        lo?.let { builder.put(minKey, it) }
        hi?.let { builder.put(maxKey, it) }
    }

    private fun emitTotal(
        builder: kotlinx.serialization.json.JsonObjectBuilder,
        min: Double,
        max: Double,
        cfg: TotalConfig,
    ) {
        if (min > cfg.min) builder.put(cfg.minKey, min)
        if (max < cfg.max) builder.put(cfg.maxKey, max)
    }
}
