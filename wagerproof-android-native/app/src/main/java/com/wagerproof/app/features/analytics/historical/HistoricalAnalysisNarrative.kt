package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot

/**
 * "When…" clauses for the trends share sentence — port of iOS
 * `HistoricalAnalysisCopy.narrativeClauses` (HistoricalAnalysisCopy.swift:1245-1601).
 *
 * The share summary composes these as
 * "When {a}, {b}, and {c}, {subject} {verb} X% of the time." Every clause must
 * correspond to a filter that is actually narrowing the query, and every
 * narrowing filter must produce a clause — a phantom clause claims a filter the
 * user never set (13d67228) and a missing one hides the filter that produced the
 * number. That is why the range comparisons below read the SPORT'S defaults
 * (`HistoricalAnalysisUISnapshot.defaults`) rather than hardcoded numbers: CFB
 * scoring ranges are wider than NFL's and MLB's are different again.
 *
 * Pure function — unit-tested in HistoricalAnalysisNarrativeTest.
 */
internal object HistoricalAnalysisNarrative {

    fun clauses(
        sport: HistoricalAnalysisSport,
        snapshot: HistoricalAnalysisUISnapshot,
    ): List<String> {
        val clauses = mutableListOf<String>()
        val s = snapshot

        fun add(text: String) { clauses += text }
        fun t(value: Double) = HistoricalAnalysisCopy.trimmed(value)

        when (sport) {
            HistoricalAnalysisSport.NFL -> {
                if (s.seasonType == "regular") add("it's the regular season")
                if (s.seasonType == "postseason") {
                    add(
                        when (s.playoffRound) {
                            "any" -> "it's the playoffs"
                            "Super Bowl" -> "it's the Super Bowl"
                            else -> "it's the ${s.playoffRound} round"
                        },
                    )
                }
                if (s.seasonType == "regular" && (s.weekMin != 1 || s.weekMax != 18)) {
                    add(weekClause(s.weekMin, s.weekMax))
                }
                s.division?.let { add(if (it) "it's a divisional game" else "it's a non-divisional game") }
            }
            HistoricalAnalysisSport.CFB -> {
                when (s.gameType) {
                    "regular" -> add("it's the regular season")
                    "bowl" -> add("it's a bowl game")
                    "playoff" -> add("it's a playoff game")
                    "postseason" -> add("it's the postseason")
                }
                if (s.gameType == "regular" && (s.weekMin != 1 || s.weekMax != 16)) {
                    add(weekClause(s.weekMin, s.weekMax))
                }
                when (s.rankedMatchup) {
                    "both" -> add("both teams are ranked")
                    "neither" -> add("neither team is ranked")
                    "home_ranked" -> add("only the home team is ranked")
                    "away_ranked" -> add("only the away team is ranked")
                    "either" -> add("at least one team is ranked")
                }
                s.conferenceGame?.let { add(if (it) "it's a conference game" else "it's a non-conference game") }
                s.neutralSite?.let { add(if (it) "it's at a neutral site" else "it's not at a neutral site") }
            }
            HistoricalAnalysisSport.MLB -> {
                if (s.monthMin != 3 || s.monthMax != 11) add("it's months ${s.monthMin}–${s.monthMax}")
                if (s.daysOfWeek.isNotEmpty()) {
                    add("it's a ${s.daysOfWeek.joinToString("/")}")
                } else if (s.dayOfWeek != "any") {
                    add("it's a ${s.dayOfWeek}")
                }
                if (s.timeMin.isNotEmpty() || s.timeMax.isNotEmpty()) {
                    add(
                        when {
                            s.timeMin.isNotEmpty() && s.timeMax.isNotEmpty() ->
                                "first pitch is ${s.timeMin}–${s.timeMax} ET"
                            s.timeMin.isNotEmpty() -> "first pitch is after ${s.timeMin} ET"
                            else -> "first pitch is before ${s.timeMax} ET"
                        },
                    )
                }
                if (s.seriesGames.isNotEmpty()) {
                    add("it's series game ${s.seriesGames.sorted().joinToString("/")}")
                }
                if (s.tripMin != null || s.tripMax != null) {
                    add("it's series ${s.tripMin ?: 1}–${s.tripMax ?: 5} of the trip")
                }
                // days_rest counts OFF-days: 0 = played the day before (2ac44c4f).
                if (s.restMin != null || s.restMax != null) {
                    add("they're on ${s.restMin ?: 0}–${s.restMax ?: 10} days rest")
                }
                s.doubleheader?.let { add(if (it) "it's a doubleheader" else "it's not a doubleheader") }
                s.division?.let { add(if (it) "it's a division game" else "it's a non-division game") }
                s.interleague?.let { add(if (it) "it's interleague" else "it's not interleague") }
                if (s.switchGame == true) add("it's their first game after a home/road switch")
                if (s.rlSide == "minus") add("they're laying −1.5")
                if (s.rlSide == "plus") add("they're getting +1.5")
                if (s.f5TotalMin > 2.001 || s.f5TotalMax < 7.999) {
                    add("the F5 total is ${t(s.f5TotalMin)}–${t(s.f5TotalMax)}")
                }
                val pfLo = s.pfRunsMin
                val pfHi = s.pfRunsMax
                when {
                    pfLo != null && pfHi != null -> add("the park factor is ${pfLo.toInt()}–${pfHi.toInt()}")
                    pfLo != null -> add("the park factor is at least ${pfLo.toInt()}")
                    pfHi != null -> add("the park factor is at most ${pfHi.toInt()}")
                }
                // Last game — the full family, mirroring the chips (was lastResult only,
                // which silently dropped shared filters like "last game went over").
                if (s.lastResult == "won") add("they won their last game")
                if (s.lastResult == "lost") add("they lost their last game")
                if (s.lastAts == "covered") add("they covered the run line last game")
                if (s.lastAts == "not") add("they didn't cover the run line last game")
                if (s.lastTotal == "over") add("their last game went over")
                if (s.lastTotal == "under") add("their last game went under")
                if (s.lastRole == "favorite") add("they were favorites last game")
                if (s.lastRole == "underdog") add("they were underdogs last game")
                // Opponent's last game
                if (s.oppLastResult == "won") add("their opponent won its last game")
                if (s.oppLastResult == "lost") add("their opponent lost its last game")
                if (s.oppLastAts == "covered") add("their opponent covered the run line last game")
                if (s.oppLastAts == "not") add("their opponent didn't cover the run line last game")
                if (s.oppLastTotal == "over") add("their opponent's last game went over")
                if (s.oppLastTotal == "under") add("their opponent's last game went under")
                if (s.oppLastRole == "favorite") add("their opponent was a favorite last game")
                if (s.oppLastRole == "underdog") add("their opponent was an underdog last game")
                // Head-to-head
                if (s.h2hLastWin == "yes") add("they won the last meeting")
                if (s.h2hLastWin == "no") add("they lost the last meeting")
                if (s.h2hLastAts == "yes") add("they covered the run line in the last meeting")
                if (s.h2hLastAts == "no") add("they didn't cover the run line in the last meeting")
                if (s.h2hLastOver == "yes") add("the last meeting went over")
                if (s.h2hLastOver == "no") add("the last meeting went under")
                s.h2hLastHome?.let { add(if (it) "they were home in the last meeting" else "they were away in the last meeting") }
                s.h2hLastFav?.let { add(if (it) "they were the favorite in the last meeting" else "they were the underdog in the last meeting") }
                s.h2hSameSeason?.let { add(if (it) "the last meeting was this season" else "the last meeting was a prior season") }
                // Pitching
                if (s.spHand != "any") add("their starter is ${s.spHand}HP")
                if (s.oppSpHand != "any") add("the opposing starter is ${s.oppSpHand}HP")
                if (s.sp.isNotEmpty()) add("starting ${s.sp.joinToString(" / ") { it.name }}")
                if (s.oppSp.isNotEmpty()) add("facing ${s.oppSp.joinToString(" / ") { it.name }}")
                if (s.spXfipMin > 2.001 || s.spXfipMax < 6.999) {
                    add("their starter's xFIP is ${t(s.spXfipMin)}–${t(s.spXfipMax)}")
                }
                if (s.oppSpXfipMin > 2.001 || s.oppSpXfipMax < 6.999) {
                    add("the opposing starter's xFIP is ${t(s.oppSpXfipMin)}–${t(s.oppSpXfipMax)}")
                }
                if (s.spEraMin > 0.001 || s.spEraMax < 9.999) {
                    add("their starter's ERA is ${t(s.spEraMin)}–${t(s.spEraMax)}")
                }
                if (s.oppSpEraMin > 0.001 || s.oppSpEraMax < 9.999) {
                    add("the opposing starter's ERA is ${t(s.oppSpEraMin)}–${t(s.oppSpEraMax)}")
                }
                if (s.bpIpMin > 0.001 || s.bpIpMax < 19.999) {
                    add("the opposing bullpen threw ${t(s.bpIpMin)}–${t(s.bpIpMax)} IP over the last 3 days")
                }
                if (s.bpXfipMin > 2.001 || s.bpXfipMax < 6.999) {
                    add("the opposing bullpen's xFIP is ${t(s.bpXfipMin)}–${t(s.bpXfipMax)}")
                }
            }
        }

        // Season-to-date form + opponent record (shared fields; per-sport defaults) —
        // compare to the sport's real defaults so a clause appears exactly when the
        // matching chip does. Hand-picked defaults here previously caused phantom /
        // missing clauses in the share summary.
        val d = HistoricalAnalysisUISnapshot.defaults(sport)
        val isMlb = sport == HistoricalAnalysisSport.MLB
        val unitWord = if (isMlb) "runs" else "points"

        fun rangeClause(v: List<Double>, dv: List<Double>, text: (String, String) -> String) {
            if (v != dv) add(text(t(v[0]), t(v[1])))
        }
        fun intRangeClause(v: List<Int>, dv: List<Int>, text: (Int, Int) -> String) {
            if (v != dv) add(text(v[0], v[1]))
        }

        if (!isMlb) {
            if (s.h1TotalMin > d.h1TotalMin + 0.001 || s.h1TotalMax < d.h1TotalMax - 0.001) {
                add("the 1H total is ${t(s.h1TotalMin)}–${t(s.h1TotalMax)}")
            }
            if (s.ttLineMin > d.ttLineMin + 0.001 || s.ttLineMax < d.ttLineMax - 0.001) {
                add("their team total line is ${t(s.ttLineMin)}–${t(s.ttLineMax)}")
            }
            if (s.oppTtLineMin > d.oppTtLineMin + 0.001 || s.oppTtLineMax < d.oppTtLineMax - 0.001) {
                add("the opponent's team total line is ${t(s.oppTtLineMin)}–${t(s.oppTtLineMax)}")
            }
        }
        intRangeClause(s.lastMargin, d.lastMargin) { lo, hi -> "their last-game margin was $lo to $hi $unitWord" }
        intRangeClause(s.oppLastMargin, d.oppLastMargin) { lo, hi -> "the opponent's last-game margin was $lo to $hi $unitWord" }
        intRangeClause(s.h2hLastMargin, d.h2hLastMargin) { lo, hi -> "the last-meeting margin was $lo to $hi $unitWord" }
        val streakLo = s.streakMin.trim()
        val streakHi = s.streakMax.trim()
        if (streakLo.isNotEmpty() || streakHi.isNotEmpty()) {
            add(
                "their current streak is ${streakLo.ifEmpty { "any" }} to " +
                    "${streakHi.ifEmpty { "any" }} (+ = wins)",
            )
        }
        rangeClause(s.winPct, d.winPct) { lo, hi -> "their win rate is $lo–$hi%" }
        intRangeClause(s.winStreak, d.winStreak) { lo, hi -> "they've won $lo–$hi straight" }
        intRangeClause(s.lossStreak, d.lossStreak) { lo, hi -> "they've lost $lo–$hi straight" }
        s.above500?.let { add(if (it) "they're above .500" else "they're below .500") }
        s.winPctGtOpp?.let { add(if (it) "they have the better record" else "they have the worse record") }
        rangeClause(s.overPct, d.overPct) { lo, hi -> "their over rate is $lo–$hi%" }
        intRangeClause(s.overStreak, d.overStreak) { lo, hi -> "their last $lo–$hi games went over" }
        intRangeClause(s.underStreak, d.underStreak) { lo, hi -> "their last $lo–$hi games went under" }
        intRangeClause(s.prevWins, d.prevWins) { lo, hi -> "they won $lo–$hi games last season" }
        rangeClause(s.prevWinPct, d.prevWinPct) { lo, hi -> "their win rate last season was $lo–$hi%" }
        s.madePlayoffsPrev?.let { add(if (it) "they made the playoffs last year" else "they missed the playoffs last year") }
        s.moreWinsThanOppPrev?.let {
            add(if (it) "they out-won their opponent last year" else "they won fewer games than their opponent last year")
        }
        if (isMlb) {
            rangeClause(s.rpg, d.rpg) { lo, hi -> "they score $lo–$hi runs/game" }
            rangeClause(s.rapg, d.rapg) { lo, hi -> "they allow $lo–$hi runs/game" }
            rangeClause(s.runDiffPg, d.runDiffPg) { lo, hi -> "their run differential is $lo–$hi/game" }
            rangeClause(s.rlCoverPct, d.rlCoverPct) { lo, hi -> "their run-line cover rate is $lo–$hi%" }
            intRangeClause(s.rlStreak, d.rlStreak) { lo, hi -> "they've covered the run line $lo–$hi straight" }
        } else {
            rangeClause(s.ppg, d.ppg) { lo, hi -> "they score $lo–$hi $unitWord/game" }
            rangeClause(s.paPg, d.paPg) { lo, hi -> "they allow $lo–$hi $unitWord/game" }
            rangeClause(s.pointDiffPg, d.pointDiffPg) { lo, hi -> "their point differential is $lo–$hi/game" }
            rangeClause(s.atsWinPct, d.atsWinPct) { lo, hi -> "their ATS win rate is $lo–$hi%" }
            intRangeClause(s.atsWinStreak, d.atsWinStreak) { lo, hi -> "they've covered $lo–$hi straight" }
            rangeClause(s.avgCoverMargin, d.avgCoverMargin) { lo, hi -> "their average cover margin is $lo–$hi" }
        }
        rangeClause(s.oppWinPct, d.oppWinPct) { lo, hi -> "the opponent's win rate is $lo–$hi%" }
        rangeClause(s.oppOverPct, d.oppOverPct) { lo, hi -> "the opponent's over rate is $lo–$hi%" }
        intRangeClause(s.oppWinStreak, d.oppWinStreak) { lo, hi -> "the opponent has won $lo–$hi straight" }
        intRangeClause(s.oppLossStreak, d.oppLossStreak) { lo, hi -> "the opponent has lost $lo–$hi straight" }
        rangeClause(s.oppPrevWinPct, d.oppPrevWinPct) { lo, hi -> "the opponent's win rate last season was $lo–$hi%" }
        if (isMlb) {
            rangeClause(s.oppRlCoverPct, d.oppRlCoverPct) { lo, hi -> "the opponent's run-line cover rate is $lo–$hi%" }
            rangeClause(s.oppRpg, d.oppRpg) { lo, hi -> "the opponent scores $lo–$hi runs/game" }
            rangeClause(s.oppRapg, d.oppRapg) { lo, hi -> "the opponent allows $lo–$hi runs/game" }
        } else {
            rangeClause(s.oppPpg, d.oppPpg) { lo, hi -> "the opponent scores $lo–$hi $unitWord/game" }
            rangeClause(s.oppPaPg, d.oppPaPg) { lo, hi -> "the opponent allows $lo–$hi $unitWord/game" }
        }

        s.primetime?.let { add(if (it) "it's primetime" else "it's not primetime") }

        if (sport == HistoricalAnalysisSport.NFL || sport == HistoricalAnalysisSport.CFB) {
            if (s.dome == "dome") add("the game is in a dome")
            if (s.dome == "outdoor") add("the game is outdoors")
            if (s.lastResult == "won") add("they won their last game")
            if (s.lastResult == "lost") add("they lost their last game")
            if (s.lastAts == "covered") add("they covered last game")
            if (s.lastAts == "not") add("they didn't cover last game")
            if (s.lastTotal == "over") add("their last game went over")
            if (s.lastTotal == "under") add("their last game went under")
            if (s.lastRole == "favorite") add("they were favorites last game")
            if (s.lastRole == "underdog") add("they were underdogs last game")
            s.lastOt?.let { add(if (it) "their last game went to OT" else "their last game didn't go to OT") }
            // Opponent's last game + head-to-head — same chips-parity gap as MLB.
            if (s.oppLastResult == "won") add("their opponent won its last game")
            if (s.oppLastResult == "lost") add("their opponent lost its last game")
            if (s.oppLastAts == "covered") add("their opponent covered last game")
            if (s.oppLastAts == "not") add("their opponent didn't cover last game")
            if (s.oppLastTotal == "over") add("their opponent's last game went over")
            if (s.oppLastTotal == "under") add("their opponent's last game went under")
            if (s.oppLastRole == "favorite") add("their opponent was a favorite last game")
            if (s.oppLastRole == "underdog") add("their opponent was an underdog last game")
            s.oppLastOt?.let { add(if (it) "their opponent's last game went to OT" else "their opponent's last game didn't go to OT") }
            if (s.h2hLastWin == "yes") add("they won the last meeting")
            if (s.h2hLastWin == "no") add("they lost the last meeting")
            if (s.h2hLastAts == "yes") add("they covered the last meeting")
            if (s.h2hLastAts == "no") add("they didn't cover the last meeting")
            if (s.h2hLastOver == "yes") add("the last meeting went over")
            if (s.h2hLastOver == "no") add("the last meeting went under")
            s.h2hLastHome?.let { add(if (it) "they were home in the last meeting" else "they were away in the last meeting") }
            s.h2hLastFav?.let { add(if (it) "they were the favorite in the last meeting" else "they were the underdog in the last meeting") }
            s.h2hSameSeason?.let { add(if (it) "the last meeting was this season" else "the last meeting was a prior season") }
            if (s.h2hSpreadCmp == "lower") add("they're more favored than the last meeting")
            if (s.h2hSpreadCmp == "higher") add("they're less favored than the last meeting")
        }
        if (sport == HistoricalAnalysisSport.NFL) {
            when (s.precip) {
                "rain" -> add("it's raining")
                "snow" -> add("it's snowing")
                "none" -> add("conditions are dry")
            }
            when (s.restBye) {
                "off_bye" -> add("they're coming off a bye")
                "pre_bye" -> add("it's the week before a bye")
                "short" -> add("they're on short rest")
            }
            if (s.lastBlowout == "win") add("they blew out their last opponent")
            if (s.lastBlowout == "loss") add("they were blown out last game")
            if (s.referee != "any") add("${s.referee} is officiating")
        }
        if (sport == HistoricalAnalysisSport.CFB && s.weather != "any") {
            add("conditions are ${s.weather}")
        }

        if (isMlb) {
            if (s.dome == "dome") add("the game is in a dome")
            if (s.dome == "outdoor") add("the game is outdoors")
            if (s.windDir != "any") add("wind is ${s.windDir}")
        }

        // MLB temp floors at 30 (web parity): a restored snapshot legitimately
        // carries tempMin=30 meaning UNSET — `!= -10` painted a phantom
        // "it's 30–110°F" clause on shared systems.
        val tempDefaultMax = if (sport == HistoricalAnalysisSport.NFL) 100 else 110
        val tempFloor = if (isMlb) 30 else -10
        if (s.tempMin > tempFloor || s.tempMax < tempDefaultMax) {
            add("it's ${maxOf(s.tempMin, tempFloor)}–${s.tempMax}°F")
        }
        // MLB wind caps at 40: windMax in 40..59 (old saves) means unset there.
        val windCap = if (isMlb) 40 else 60
        if (s.windMin != null || s.windMax < windCap) {
            val lo = s.windMin ?: 0
            when {
                lo > 0 && s.windMax < windCap -> add("winds are $lo–${s.windMax} mph")
                lo > 0 -> add("winds are at least $lo mph")
                else -> add("winds are under ${s.windMax} mph")
            }
        }

        HistoricalAnalysisFilterBuilder.spreadConfig(sport, "fg_spread")?.let { spreadCfg ->
            val lo = t(s.spreadMin)
            val hi = t(s.spreadMax)
            when {
                s.spreadSide == "favorite" -> add("they're laying $lo–$hi points")
                s.spreadSide == "underdog" -> add("they're getting $lo–$hi points")
                s.spreadMin > 0.001 || s.spreadMax < spreadCfg.max - 0.001 -> add("the spread is $lo–$hi points")
            }
        }

        // `lineMin/Max` is ALWAYS the full-game total dim (chips parity). Passing the
        // current betType here described the untouched game-total slider with the
        // F5/1H market's label + bounds — a phantom second "total" clause (f975ab90).
        HistoricalAnalysisFilterBuilder.totalConfig(sport, if (isMlb) "total" else "fg_total")?.let { totalCfg ->
            if (s.lineMin > totalCfg.min + 0.001 || s.lineMax < totalCfg.max - 0.001) {
                add("the ${totalCfg.label.lowercase()} is ${t(s.lineMin)}–${t(s.lineMax)}")
            }
        }

        if (s.mlMin.isNotEmpty() || s.mlMax.isNotEmpty()) {
            fun fmt(raw: String): String {
                val n = raw.toDoubleOrNull() ?: return raw
                return if (n > 0) "+${n.toInt()}" else "${n.toInt()}"
            }
            add(
                when {
                    s.mlMin.isNotEmpty() && s.mlMax.isNotEmpty() ->
                        "the moneyline is ${fmt(s.mlMin)} to ${fmt(s.mlMax)}"
                    s.mlMin.isNotEmpty() -> "the moneyline is ${fmt(s.mlMin)} or better"
                    else -> "the moneyline is ${fmt(s.mlMax)} or worse"
                },
            )
        }

        return clauses
    }

    private fun weekClause(min: Int, max: Int) =
        if (min == max) "it's week $min" else "it's weeks $min–$max"
}
