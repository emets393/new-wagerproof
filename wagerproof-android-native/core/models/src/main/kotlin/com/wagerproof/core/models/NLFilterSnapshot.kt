package com.wagerproof.core.models

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlin.math.roundToInt

/**
 * Snapshot ⇄ canonical-web-filter JSON for the natural-language filter chat.
 *
 * The `nl-filter-patch` edge function runs the SAME reducer the web app runs
 * client-side, so it speaks the web's canonical snapshot shape (pair fields like
 * `seasons: [min, max]`, `spreadSize`, `tempRange`…), not the flat native one.
 * [serialize] converts down to that shape and [restore] converts the validated
 * result back. Port of iOS `HistoricalAnalysisStore.serializeCurrentFilterForNL`
 * / `restoreNLFilterSnapshot`.
 *
 * Two invariants that are easy to break:
 *
 * 1. [serialize] emits ONLY dims that differ from this sport's defaults. The
 *    model patches relative to what it is shown, and a full dump of 120 default
 *    dims both blows the prompt budget and makes every untouched slider look
 *    deliberate.
 * 2. [restore] receives the FULL canonical snapshot back (the server normalizes
 *    before applying), so canonical defaults must map back onto the native
 *    "unset" sentinels — see the MLB block at the bottom. Skipping that turns a
 *    no-op `tempRange` into a real `temp_min=30` clause that silently drops
 *    every dome game on the next query.
 */
object NLFilterSnapshot {

    /** Canonical MLB full-span ranges that mean "no filter" and must not stick. */
    private val MLB_TRIP_SPAN = listOf(1, 5)
    private val MLB_REST_SPAN = listOf(0, 10)
    private val MLB_STREAK_SPAN = listOf(-25, 25)
    private val MLB_PF_RUNS_SPAN = listOf(85.0, 115.0)
    private val MLB_SERIES_SPAN = listOf(1, 6)
    private val SP_XFIP_DEFAULT = listOf(2.0, 7.0)
    private val SP_ERA_DEFAULT = listOf(0.0, 10.0)
    private val BP_IP_DEFAULT = listOf(0.0, 20.0)

    // MARK: - Serialize (native snapshot → canonical web filter)

    fun serialize(
        sport: HistoricalAnalysisSport,
        s: HistoricalAnalysisUISnapshot,
    ): JsonObject {
        val d = HistoricalAnalysisUISnapshot.defaults(sport)
        val dict = LinkedHashMap<String, JsonElement>()

        fun putStr(key: String, value: String) { dict[key] = JsonPrimitive(value) }
        fun putInt(key: String, value: Int) { dict[key] = JsonPrimitive(value) }
        fun putBool(key: String, value: Boolean) { dict[key] = JsonPrimitive(value) }
        fun putIntPair(key: String, lo: Int, hi: Int) {
            dict[key] = JsonArray(listOf(JsonPrimitive(lo), JsonPrimitive(hi)))
        }
        fun putDoublePair(key: String, lo: Double, hi: Double) {
            dict[key] = JsonArray(listOf(JsonPrimitive(lo), JsonPrimitive(hi)))
        }
        fun putStrings(key: String, values: List<String>) {
            dict[key] = JsonArray(values.map { JsonPrimitive(it) })
        }
        fun putRange(key: String, value: List<Double>, def: List<Double>) {
            if (value.size >= 2 && value != def) putDoublePair(key, value[0], value[1])
        }
        fun putIntRange(key: String, value: List<Int>, def: List<Int>) {
            if (value.size >= 2 && value != def) putIntPair(key, value[0], value[1])
        }
        fun putTri(key: String, value: Boolean?) { if (value != null) putBool(key, value) }
        fun putEnum(key: String, value: String, defaultValue: String = "any") {
            if (value != defaultValue) putStr(key, value)
        }
        fun putLineRange(key: String, min: Double, max: Double, defMin: Double, defMax: Double) {
            if (min != defMin || max != defMax) putDoublePair(key, min, max)
        }

        putStr("betType", s.betType)

        if (s.seasonMin != d.seasonMin || s.seasonMax != d.seasonMax) putIntPair("seasons", s.seasonMin, s.seasonMax)
        if (s.weekMin != d.weekMin || s.weekMax != d.weekMax) putIntPair("weeks", s.weekMin, s.weekMax)
        if (s.side != d.side) putStr("side", s.side)
        if (s.seasonType != d.seasonType) putStr("seasonType", s.seasonType)
        if (s.playoffRound != d.playoffRound) putStr("playoffRound", s.playoffRound)
        if (s.favDog != d.favDog) putStr("favDog", s.favDog)
        if (s.rlSide != d.rlSide) putStr("rlSide", s.rlSide)
        if (s.spreadSide != d.spreadSide) putStr("spreadSide", s.spreadSide)
        if (s.spreadMin != d.spreadMin || s.spreadMax != d.spreadMax) putDoublePair("spreadSize", s.spreadMin, s.spreadMax)
        if (s.lineMin != d.lineMin || s.lineMax != d.lineMax) putDoublePair("lineRange", s.lineMin, s.lineMax)

        // MLB F5 total is an independent dim from the game total above — always
        // serialized regardless of `betType` (web parity).
        if (sport == HistoricalAnalysisSport.MLB && (s.f5TotalMin != 2.0 || s.f5TotalMax != 8.0)) {
            putDoublePair("f5TotalRange", s.f5TotalMin, s.f5TotalMax)
        }
        if (s.mlMin.isNotEmpty()) putStr("mlMin", s.mlMin)
        if (s.mlMax.isNotEmpty()) putStr("mlMax", s.mlMax)

        if (s.h1SpreadSide != d.h1SpreadSide) putStr("h1SpreadSide", s.h1SpreadSide)
        putLineRange("h1SpreadSize", s.h1SpreadMin, s.h1SpreadMax, d.h1SpreadMin, d.h1SpreadMax)
        if (s.h1MlMin.isNotEmpty()) putStr("h1MlMin", s.h1MlMin)
        if (s.h1MlMax.isNotEmpty()) putStr("h1MlMax", s.h1MlMax)
        putLineRange("h1TotalRange", s.h1TotalMin, s.h1TotalMax, d.h1TotalMin, d.h1TotalMax)
        putLineRange("ttLineRange", s.ttLineMin, s.ttLineMax, d.ttLineMin, d.ttLineMax)
        if (s.oppSpreadSide != d.oppSpreadSide) putStr("oppSpreadSide", s.oppSpreadSide)
        putLineRange("oppSpreadSize", s.oppSpreadMin, s.oppSpreadMax, d.oppSpreadMin, d.oppSpreadMax)
        if (s.oppMlMin.isNotEmpty()) putStr("oppMlMin", s.oppMlMin)
        if (s.oppMlMax.isNotEmpty()) putStr("oppMlMax", s.oppMlMax)
        putLineRange("oppTtLineRange", s.oppTtLineMin, s.oppTtLineMax, d.oppTtLineMin, d.oppTtLineMax)

        putTri("primetime", s.primetime)
        putTri("division", s.division)
        if (s.dome != d.dome) {
            // MLB canonical dome is a TRISTATE bool; football is an enum string.
            if (sport == HistoricalAnalysisSport.MLB) putBool("dome", s.dome == "dome") else putStr("dome", s.dome)
        }
        if (s.tempMin != d.tempMin || s.tempMax != d.tempMax) putIntPair("tempRange", s.tempMin, s.tempMax)
        if (s.windMax != d.windMax) putInt("windMax", s.windMax)
        s.windMin?.takeIf { it > 0 }?.let { putInt("windMin", it) }
        if ((s.windMin ?: 0) > 0 || s.windMax != d.windMax) putIntPair("windRange", s.windMin ?: 0, s.windMax)
        if (s.precip != d.precip) putStr("precip", s.precip)
        if (s.restBye != d.restBye) putStr("restBye", s.restBye)
        if (s.coach != d.coach) putStr("coach", s.coach)
        if (s.referee != d.referee) putStr("referee", s.referee)
        if (s.teams.isNotEmpty()) putStrings("teams", s.teams)
        if (s.opponents.isNotEmpty()) putStrings("opponents", s.opponents)
        if (s.daysOfWeek.isNotEmpty()) putStrings("daysOfWeek", s.daysOfWeek)
        if (s.teamDivisions.isNotEmpty()) putStrings("teamDivisions", s.teamDivisions)

        if (sport == HistoricalAnalysisSport.NFL || sport == HistoricalAnalysisSport.CFB) {
            putRange("winPct", s.winPct, d.winPct)
            putIntRange("winStreak", s.winStreak, d.winStreak)
            putIntRange("lossStreak", s.lossStreak, d.lossStreak)
            putTri("above500", s.above500)
            putTri("winPctGtOpp", s.winPctGtOpp)
            putRange("ppg", s.ppg, d.ppg)
            putRange("paPg", s.paPg, d.paPg)
            putRange("pointDiffPg", s.pointDiffPg, d.pointDiffPg)
            if (s.minGames != d.minGames) putInt("minGames", s.minGames)

            putRange("atsWinPct", s.atsWinPct, d.atsWinPct)
            putIntRange("atsWinStreak", s.atsWinStreak, d.atsWinStreak)
            putRange("avgCoverMargin", s.avgCoverMargin, d.avgCoverMargin)

            putRange("overPct", s.overPct, d.overPct)
            putIntRange("overStreak", s.overStreak, d.overStreak)
            putIntRange("underStreak", s.underStreak, d.underStreak)

            putIntRange("prevWins", s.prevWins, d.prevWins)
            putRange("prevWinPct", s.prevWinPct, d.prevWinPct)
            putTri("madePlayoffsPrev", s.madePlayoffsPrev)
            putTri("moreWinsThanOppPrev", s.moreWinsThanOppPrev)

            putEnum("h2hLastWin", s.h2hLastWin)
            putEnum("h2hLastAts", s.h2hLastAts)
            putEnum("h2hLastOver", s.h2hLastOver)
            putTri("h2hLastHome", s.h2hLastHome)
            putTri("h2hLastFav", s.h2hLastFav)
            putTri("h2hSameSeason", s.h2hSameSeason)
            putEnum("h2hSpreadCmp", s.h2hSpreadCmp)

            putRange("oppWinPct", s.oppWinPct, d.oppWinPct)
            putRange("oppOverPct", s.oppOverPct, d.oppOverPct)
            putIntRange("oppWinStreak", s.oppWinStreak, d.oppWinStreak)
            putIntRange("oppLossStreak", s.oppLossStreak, d.oppLossStreak)
            putRange("oppPpg", s.oppPpg, d.oppPpg)
            putRange("oppPaPg", s.oppPaPg, d.oppPaPg)
            putRange("oppPrevWinPct", s.oppPrevWinPct, d.oppPrevWinPct)

            putEnum("lastResult", s.lastResult)
            putEnum("lastAts", s.lastAts)
            putEnum("lastTotal", s.lastTotal)
            putEnum("lastRole", s.lastRole)
            putTri("lastOt", s.lastOt)
            putIntRange("lastMargin", s.lastMargin, d.lastMargin)

            putEnum("oppLastResult", s.oppLastResult)
            putEnum("oppLastAts", s.oppLastAts)
            putEnum("oppLastTotal", s.oppLastTotal)
            putEnum("oppLastRole", s.oppLastRole)
            putTri("oppLastOt", s.oppLastOt)
            putIntRange("oppLastMargin", s.oppLastMargin, d.oppLastMargin)
        }

        // MLB-only + MLB-shared dims (filterSchemaMlb canonical keys). Without
        // these the chat model never sees months/days/series filters the user
        // already set, and its edits to them are dropped on restore.
        if (sport == HistoricalAnalysisSport.MLB) {
            if (s.monthMin != d.monthMin || s.monthMax != d.monthMax) putIntPair("months", s.monthMin, s.monthMax)
            // `daysOfWeek` (multi) is the canonical MLB control and is serialized
            // generically above; fall back to the legacy single-day field only
            // when the array is empty.
            if (s.daysOfWeek.isEmpty() && s.dayOfWeek != "any") putStrings("daysOfWeek", listOf(s.dayOfWeek))
            if (s.timeMin.trim().isNotEmpty()) putStr("timeMin", s.timeMin)
            if (s.timeMax.trim().isNotEmpty()) putStr("timeMax", s.timeMax)
            putTri("doubleheader", s.doubleheader)
            putTri("interleague", s.interleague)
            putTri("switchGame", s.switchGame)
            if (s.seriesGames.isNotEmpty()) {
                dict["seriesGames"] = JsonArray(s.seriesGames.sorted().map { JsonPrimitive(it) })
            } else if (s.seriesGameMin != null || s.seriesGameMax != null) {
                putIntPair("seriesGame", s.seriesGameMin ?: 1, s.seriesGameMax ?: 6)
            }
            if (s.tripMin != null || s.tripMax != null) putIntPair("trip", s.tripMin ?: 1, s.tripMax ?: 5)
            if (s.restMin != null || s.restMax != null) putIntPair("restRange", s.restMin ?: 0, s.restMax ?: 10)
            val streakLo = s.streakMin.trim().toDoubleOrNull()
            val streakHi = s.streakMax.trim().toDoubleOrNull()
            if (streakLo != null || streakHi != null) {
                putDoublePair("winLossStreak", streakLo ?: -25.0, streakHi ?: 25.0)
            }
            if (s.spHand != "any") putStr("spHand", s.spHand)
            if (s.oppSpHand != "any") putStr("oppSpHand", s.oppSpHand)
            if (s.sp.isNotEmpty()) putStrings("spNames", s.sp.map { it.name })
            if (s.oppSp.isNotEmpty()) putStrings("oppSpNames", s.oppSp.map { it.name })
            if (s.windDir != "any") putStr("windDir", s.windDir)
            if (s.pfRunsMin != null || s.pfRunsMax != null) {
                putDoublePair("pfRuns", s.pfRunsMin ?: 85.0, s.pfRunsMax ?: 115.0)
            }
            putRange("spXfip", listOf(s.spXfipMin, s.spXfipMax), SP_XFIP_DEFAULT)
            putRange("oppSpXfip", listOf(s.oppSpXfipMin, s.oppSpXfipMax), SP_XFIP_DEFAULT)
            putRange("spEra", listOf(s.spEraMin, s.spEraMax), SP_ERA_DEFAULT)
            putRange("oppSpEra", listOf(s.oppSpEraMin, s.oppSpEraMax), SP_ERA_DEFAULT)
            putRange("bpIp", listOf(s.bpIpMin, s.bpIpMax), BP_IP_DEFAULT)
            putRange("bpXfip", listOf(s.bpXfipMin, s.bpXfipMax), SP_XFIP_DEFAULT)

            // Last game — shared field names with football (same RPC keys).
            putEnum("lastResult", s.lastResult)
            putEnum("lastAts", s.lastAts)
            putEnum("lastTotal", s.lastTotal)
            putEnum("lastRole", s.lastRole)
            putIntRange("lastMargin", s.lastMargin, d.lastMargin)

            putEnum("oppLastResult", s.oppLastResult)
            putEnum("oppLastAts", s.oppLastAts)
            putEnum("oppLastTotal", s.oppLastTotal)
            putEnum("oppLastRole", s.oppLastRole)
            putIntRange("oppLastMargin", s.oppLastMargin, d.oppLastMargin)

            // Season record (run-based): winPct/winStreak/lossStreak/minGames are
            // shared fields; rpg/rapg/runDiffPg are MLB-only.
            putRange("winPct", s.winPct, d.winPct)
            putIntRange("winStreak", s.winStreak, d.winStreak)
            putIntRange("lossStreak", s.lossStreak, d.lossStreak)
            putRange("rpg", s.rpg, d.rpg)
            putRange("rapg", s.rapg, d.rapg)
            putRange("runDiffPg", s.runDiffPg, d.runDiffPg)
            if (s.minGames != d.minGames) putInt("minGames", s.minGames)

            putRange("rlCoverPct", s.rlCoverPct, d.rlCoverPct)
            putIntRange("rlStreak", s.rlStreak, d.rlStreak)

            putRange("overPct", s.overPct, d.overPct)
            putIntRange("overStreak", s.overStreak, d.overStreak)
            putIntRange("underStreak", s.underStreak, d.underStreak)

            putIntRange("prevWins", s.prevWins, d.prevWins)
            putRange("prevWinPct", s.prevWinPct, d.prevWinPct)

            putEnum("h2hLastWin", s.h2hLastWin)
            putEnum("h2hLastAts", s.h2hLastAts)
            putEnum("h2hLastOver", s.h2hLastOver)
            putIntRange("h2hLastMargin", s.h2hLastMargin, d.h2hLastMargin)
            putTri("h2hLastHome", s.h2hLastHome)
            putTri("h2hLastFav", s.h2hLastFav)
            putTri("h2hSameSeason", s.h2hSameSeason)

            putRange("oppWinPct", s.oppWinPct, d.oppWinPct)
            putRange("oppOverPct", s.oppOverPct, d.oppOverPct)
            putRange("oppRlCoverPct", s.oppRlCoverPct, d.oppRlCoverPct)
            putIntRange("oppWinStreak", s.oppWinStreak, d.oppWinStreak)
            putIntRange("oppLossStreak", s.oppLossStreak, d.oppLossStreak)
            putRange("oppRpg", s.oppRpg, d.oppRpg)
            putRange("oppRapg", s.oppRapg, d.oppRapg)
            putRange("oppPrevWinPct", s.oppPrevWinPct, d.oppPrevWinPct)
        }

        return JsonObject(dict)
    }

    // MARK: - Restore (canonical web filter → native snapshot, in place)

    /**
     * Apply the server's validated canonical snapshot onto [target]. Mutates in
     * place so the caller can run it inside the store's copy-then-mutate
     * `updateSnapshot` block. Absent keys leave the current value untouched.
     */
    fun restore(
        sport: HistoricalAnalysisSport,
        target: HistoricalAnalysisUISnapshot,
        web: JsonObject,
    ) {
        fun prim(key: String): JsonPrimitive? = (web[key] as? JsonPrimitive)?.takeIf { it !is JsonNull }
        // isString matters: a JSON `true` has content "true", so an unguarded
        // read would turn MLB's boolean `dome` into the string "true".
        fun str(key: String): String? = prim(key)?.takeIf { it.isString }?.content
        fun int(key: String): Int? = prim(key)?.let { it.intOrNull ?: it.doubleOrNull?.roundToInt() }
        fun bool(key: String): Boolean? = prim(key)?.booleanOrNull
        fun arr(key: String): JsonArray? = web[key] as? JsonArray
        fun strings(key: String): List<String>? =
            arr(key)?.mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content }
        fun elemInt(el: JsonElement?): Int? =
            (el as? JsonPrimitive)?.takeIf { it !is JsonNull }?.let { it.intOrNull ?: it.doubleOrNull?.roundToInt() }
        fun elemDouble(el: JsonElement?): Double? =
            (el as? JsonPrimitive)?.takeIf { it !is JsonNull }?.doubleOrNull
        fun pairDoubles(key: String): List<Double>? {
            val a = arr(key)?.takeIf { it.size >= 2 } ?: return null
            val lo = elemDouble(a[0]) ?: return null
            val hi = elemDouble(a[1]) ?: return null
            return listOf(lo, hi)
        }
        fun pairInts(key: String): List<Int>? {
            val a = arr(key)?.takeIf { it.size >= 2 } ?: return null
            val lo = elemInt(a[0]) ?: return null
            val hi = elemInt(a[1]) ?: return null
            return listOf(lo, hi)
        }

        str("betType")?.let { target.betType = it }
        pairInts("seasons")?.let { target.seasonMin = it[0]; target.seasonMax = it[1] }
        pairInts("weeks")?.let { target.weekMin = it[0]; target.weekMax = it[1] }
        str("side")?.let { target.side = it }
        str("seasonType")?.let { target.seasonType = it }
        str("playoffRound")?.let { target.playoffRound = it }
        str("favDog")?.let { target.favDog = it }
        str("rlSide")?.let { target.rlSide = it }
        str("spreadSide")?.let { target.spreadSide = it }
        pairDoubles("spreadSize")?.let { target.spreadMin = it[0]; target.spreadMax = it[1] }
        pairDoubles("lineRange")?.let { target.lineMin = it[0]; target.lineMax = it[1] }
        str("mlMin")?.let { target.mlMin = it }
        str("mlMax")?.let { target.mlMax = it }
        str("h1SpreadSide")?.let { target.h1SpreadSide = it }
        pairDoubles("h1SpreadSize")?.let { target.h1SpreadMin = it[0]; target.h1SpreadMax = it[1] }
        str("h1MlMin")?.let { target.h1MlMin = it }
        str("h1MlMax")?.let { target.h1MlMax = it }
        pairDoubles("h1TotalRange")?.let { target.h1TotalMin = it[0]; target.h1TotalMax = it[1] }
        pairDoubles("ttLineRange")?.let { target.ttLineMin = it[0]; target.ttLineMax = it[1] }
        str("oppSpreadSide")?.let { target.oppSpreadSide = it }
        pairDoubles("oppSpreadSize")?.let { target.oppSpreadMin = it[0]; target.oppSpreadMax = it[1] }
        str("oppMlMin")?.let { target.oppMlMin = it }
        str("oppMlMax")?.let { target.oppMlMax = it }
        pairDoubles("oppTtLineRange")?.let { target.oppTtLineMin = it[0]; target.oppTtLineMax = it[1] }
        bool("primetime")?.let { target.primetime = it }
        bool("division")?.let { target.division = it }
        str("dome")?.let { target.dome = it }
        pairInts("tempRange")?.let { target.tempMin = it[0]; target.tempMax = it[1] }
        int("windMax")?.let { target.windMax = it }
        int("windMin")?.let { target.windMin = it }
        arr("windRange")?.takeIf { it.size >= 2 }?.let { wr ->
            elemInt(wr[0])?.let { target.windMin = if (it > 0) it else null }
            elemInt(wr[1])?.let { target.windMax = it }
        }
        str("precip")?.let { target.precip = it }
        str("restBye")?.let { target.restBye = it }
        str("coach")?.let { target.coach = it }
        str("referee")?.let { target.referee = it }
        strings("teams")?.let { target.teams = it }
        strings("opponents")?.let { target.opponents = it }
        strings("daysOfWeek")?.let { target.daysOfWeek = it }
        strings("teamDivisions")?.let { target.teamDivisions = it }

        if (sport == HistoricalAnalysisSport.NFL || sport == HistoricalAnalysisSport.CFB) {
            pairDoubles("winPct")?.let { target.winPct = it }
            pairInts("winStreak")?.let { target.winStreak = it }
            pairInts("lossStreak")?.let { target.lossStreak = it }
            bool("above500")?.let { target.above500 = it }
            bool("winPctGtOpp")?.let { target.winPctGtOpp = it }
            pairDoubles("ppg")?.let { target.ppg = it }
            pairDoubles("paPg")?.let { target.paPg = it }
            pairDoubles("pointDiffPg")?.let { target.pointDiffPg = it }
            int("minGames")?.let { target.minGames = it }

            pairDoubles("atsWinPct")?.let { target.atsWinPct = it }
            pairInts("atsWinStreak")?.let { target.atsWinStreak = it }
            pairDoubles("avgCoverMargin")?.let { target.avgCoverMargin = it }

            pairDoubles("overPct")?.let { target.overPct = it }
            pairInts("overStreak")?.let { target.overStreak = it }
            pairInts("underStreak")?.let { target.underStreak = it }

            pairInts("prevWins")?.let { target.prevWins = it }
            pairDoubles("prevWinPct")?.let { target.prevWinPct = it }
            bool("madePlayoffsPrev")?.let { target.madePlayoffsPrev = it }
            bool("moreWinsThanOppPrev")?.let { target.moreWinsThanOppPrev = it }

            str("h2hLastWin")?.let { target.h2hLastWin = it }
            str("h2hLastAts")?.let { target.h2hLastAts = it }
            str("h2hLastOver")?.let { target.h2hLastOver = it }
            bool("h2hLastHome")?.let { target.h2hLastHome = it }
            bool("h2hLastFav")?.let { target.h2hLastFav = it }
            bool("h2hSameSeason")?.let { target.h2hSameSeason = it }
            str("h2hSpreadCmp")?.let { target.h2hSpreadCmp = it }

            pairDoubles("oppWinPct")?.let { target.oppWinPct = it }
            pairDoubles("oppOverPct")?.let { target.oppOverPct = it }
            pairInts("oppWinStreak")?.let { target.oppWinStreak = it }
            pairInts("oppLossStreak")?.let { target.oppLossStreak = it }
            pairDoubles("oppPpg")?.let { target.oppPpg = it }
            pairDoubles("oppPaPg")?.let { target.oppPaPg = it }
            pairDoubles("oppPrevWinPct")?.let { target.oppPrevWinPct = it }

            str("lastResult")?.let { target.lastResult = it }
            str("lastAts")?.let { target.lastAts = it }
            str("lastTotal")?.let { target.lastTotal = it }
            str("lastRole")?.let { target.lastRole = it }
            bool("lastOt")?.let { target.lastOt = it }
            pairInts("lastMargin")?.let { target.lastMargin = it }

            str("oppLastResult")?.let { target.oppLastResult = it }
            str("oppLastAts")?.let { target.oppLastAts = it }
            str("oppLastTotal")?.let { target.oppLastTotal = it }
            str("oppLastRole")?.let { target.oppLastRole = it }
            bool("oppLastOt")?.let { target.oppLastOt = it }
            pairInts("oppLastMargin")?.let { target.oppLastMargin = it }
        }

        if (sport != HistoricalAnalysisSport.MLB) return

        // MLB-only dims. The server returns the FULL canonical snapshot, so
        // canonical DEFAULTS must map back to the native "unset" sentinels
        // (null / "any" / ""), not become active filters.
        bool("dome")?.let { target.dome = if (it) "dome" else "outdoor" }
        pairInts("months")?.let { target.monthMin = it[0]; target.monthMax = it[1] }
        // The MLB UI uses the multi-select `daysOfWeek` (restored generically
        // above); keep the legacy single-day field in sync for old call sites.
        strings("daysOfWeek")?.let { target.dayOfWeek = it.firstOrNull() ?: "any" }
        bool("doubleheader")?.let { target.doubleheader = it }
        bool("interleague")?.let { target.interleague = it }
        bool("switchGame")?.let { target.switchGame = it }
        val seriesGames = arr("seriesGames")
        if (seriesGames != null) {
            target.seriesGames = seriesGames.mapNotNull { elemInt(it) }
        } else {
            pairInts("seriesGame")?.takeIf { it != MLB_SERIES_SPAN }?.let {
                // Legacy range save — expand into the multi-select set.
                target.seriesGames = (it[0]..maxOf(it[0], it[1])).toList()
            }
        }
        pairInts("trip")?.let {
            val span = it == MLB_TRIP_SPAN
            target.tripMin = if (span) null else it[0]
            target.tripMax = if (span) null else it[1]
        }
        pairInts("restRange")?.let {
            val span = it == MLB_REST_SPAN
            target.restMin = if (span) null else it[0]
            target.restMax = if (span) null else it[1]
        }
        str("timeMin")?.let { target.timeMin = it }
        str("timeMax")?.let { target.timeMax = it }
        pairInts("winLossStreak")?.let {
            val span = it == MLB_STREAK_SPAN
            target.streakMin = if (span) "" else it[0].toString()
            target.streakMax = if (span) "" else it[1].toString()
        }
        str("spHand")?.let { target.spHand = it }
        str("oppSpHand")?.let { target.oppSpHand = it }
        str("windDir")?.let { target.windDir = it }
        pairDoubles("pfRuns")?.let {
            val span = it == MLB_PF_RUNS_SPAN
            target.pfRunsMin = if (span) null else it[0]
            target.pfRunsMax = if (span) null else it[1]
        }
        pairDoubles("f5TotalRange")?.let { target.f5TotalMin = it[0]; target.f5TotalMax = it[1] }
        pairDoubles("spXfip")?.let { target.spXfipMin = it[0]; target.spXfipMax = it[1] }
        pairDoubles("oppSpXfip")?.let { target.oppSpXfipMin = it[0]; target.oppSpXfipMax = it[1] }
        pairDoubles("spEra")?.let { target.spEraMin = it[0]; target.spEraMax = it[1] }
        pairDoubles("oppSpEra")?.let { target.oppSpEraMin = it[0]; target.oppSpEraMax = it[1] }
        pairDoubles("bpIp")?.let { target.bpIpMin = it[0]; target.bpIpMax = it[1] }
        pairDoubles("bpXfip")?.let { target.bpXfipMin = it[0]; target.bpXfipMax = it[1] }

        str("lastResult")?.let { target.lastResult = it }
        str("lastAts")?.let { target.lastAts = it }
        str("lastTotal")?.let { target.lastTotal = it }
        str("lastRole")?.let { target.lastRole = it }
        pairInts("lastMargin")?.let { target.lastMargin = it }

        str("oppLastResult")?.let { target.oppLastResult = it }
        str("oppLastAts")?.let { target.oppLastAts = it }
        str("oppLastTotal")?.let { target.oppLastTotal = it }
        str("oppLastRole")?.let { target.oppLastRole = it }
        pairInts("oppLastMargin")?.let { target.oppLastMargin = it }

        pairDoubles("winPct")?.let { target.winPct = it }
        pairInts("winStreak")?.let { target.winStreak = it }
        pairInts("lossStreak")?.let { target.lossStreak = it }
        pairDoubles("rpg")?.let { target.rpg = it }
        pairDoubles("rapg")?.let { target.rapg = it }
        pairDoubles("runDiffPg")?.let { target.runDiffPg = it }
        int("minGames")?.let { target.minGames = it }

        pairDoubles("rlCoverPct")?.let { target.rlCoverPct = it }
        pairInts("rlStreak")?.let { target.rlStreak = it }

        pairDoubles("overPct")?.let { target.overPct = it }
        pairInts("overStreak")?.let { target.overStreak = it }
        pairInts("underStreak")?.let { target.underStreak = it }

        pairInts("prevWins")?.let { target.prevWins = it }
        pairDoubles("prevWinPct")?.let { target.prevWinPct = it }

        str("h2hLastWin")?.let { target.h2hLastWin = it }
        str("h2hLastAts")?.let { target.h2hLastAts = it }
        str("h2hLastOver")?.let { target.h2hLastOver = it }
        pairInts("h2hLastMargin")?.let { target.h2hLastMargin = it }
        bool("h2hLastHome")?.let { target.h2hLastHome = it }
        bool("h2hLastFav")?.let { target.h2hLastFav = it }
        bool("h2hSameSeason")?.let { target.h2hSameSeason = it }

        pairDoubles("oppWinPct")?.let { target.oppWinPct = it }
        pairDoubles("oppOverPct")?.let { target.oppOverPct = it }
        pairDoubles("oppRlCoverPct")?.let { target.oppRlCoverPct = it }
        pairInts("oppWinStreak")?.let { target.oppWinStreak = it }
        pairInts("oppLossStreak")?.let { target.oppLossStreak = it }
        pairDoubles("oppRpg")?.let { target.oppRpg = it }
        pairDoubles("oppRapg")?.let { target.oppRapg = it }
        pairDoubles("oppPrevWinPct")?.let { target.oppPrevWinPct = it }

        // Canonical tempRange floor is 30 (the web slider); the native "any" is
        // -10. A full-span [30,110] must NOT become temp_min=30 — that silently
        // excludes dome games (NULL temps) after every chat turn.
        if (target.tempMin == 30 && target.tempMax == 110) target.tempMin = -10
        // Same for windRange full span [0,40] vs the native windMax sentinel 60.
        if ((target.windMin ?: 0) == 0 && target.windMax == 40) {
            target.windMin = null
            target.windMax = 60
        }
        // spNames/oppSpNames need a name→id lookup to restore; chat-set pitcher
        // filters are intentionally not applied yet (same as iOS).
    }
}
