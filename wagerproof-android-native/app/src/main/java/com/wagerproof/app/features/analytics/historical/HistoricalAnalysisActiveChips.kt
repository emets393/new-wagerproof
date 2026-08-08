package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.HistoricalAnalysisBetType
import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot

/**
 * One clearable "active filter" capsule. [clear] mutates a snapshot copy back to
 * this sport's default for that dimension — the caller hands it to
 * `HistoricalAnalysisStore.updateSnapshot`.
 */
internal data class ActiveChip(val label: String, val clear: (HistoricalAnalysisUISnapshot) -> Unit)

/**
 * Port of iOS `HistoricalAnalysisCopy.activeChips`.
 *
 * Every dimension `HistoricalAnalysisFilterBuilder` can emit needs a chip here:
 * a filter with no chip is a filter the user can neither see nor clear, which is
 * exactly how a restored web/iOS system silently narrows an Android search. That
 * is why the football block runs for CFB too (iOS only runs it for NFL, so CFB
 * team-form / H2H / opponent filters are invisible there) and why a few
 * decode-only legacy fields (`lastBlowout`, `lastMarginMin/Max`, `dayOfWeek`,
 * `seriesGameMin/Max`) get a clear-only chip with no matching control.
 *
 * Pure function — unit-tested in HistoricalAnalysisActiveChipsTest.
 */
internal object HistoricalAnalysisActiveChips {

    val allDays = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

    val nflDivisions = listOf(
        "AFC East", "AFC North", "AFC South", "AFC West",
        "NFC East", "NFC North", "NFC South", "NFC West",
    )

    fun dayLabel(day: String): String = when (day) {
        "Sun" -> "Sunday"
        "Mon" -> "Monday"
        "Tue" -> "Tuesday"
        "Wed" -> "Wednesday"
        "Thu" -> "Thursday"
        "Fri" -> "Friday"
        "Sat" -> "Saturday"
        else -> day
    }

    fun monthName(month: Int): String = when (month) {
        3 -> "Mar"; 4 -> "Apr"; 5 -> "May"; 6 -> "Jun"; 7 -> "Jul"
        8 -> "Aug"; 9 -> "Sep"; 10 -> "Oct"; 11 -> "Nov"
        else -> month.toString()
    }

    fun build(
        sport: HistoricalAnalysisSport,
        snapshot: HistoricalAnalysisUISnapshot,
        seasonFloor: Int,
    ): List<ActiveChip> {
        val chips = mutableListOf<ActiveChip>()
        // Sport-aware defaults — CFB as-of ranges are wider than NFL's, so
        // hardcoded [0,40]-style comparisons would show phantom chips there.
        val d = HistoricalAnalysisUISnapshot.defaults(sport)
        val s = snapshot
        val betType = s.betType
        // Game totals are game-level: Side doesn't apply.
        val isGameTotal = betType == "fg_total" || betType == "h1_total"
        val weekMax = if (sport == HistoricalAnalysisSport.NFL) 18 else 16
        val spreadCfg = HistoricalAnalysisFilterBuilder.spreadConfig(sport, "fg_spread")
        // `lineMin/Max` is ALWAYS the full-game total dim, every sport (matches the
        // builder). Resolving it from the selected bet type produced a phantom
        // "Team total 30–60" chip the moment those markets were picked.
        val totalCfg = HistoricalAnalysisFilterBuilder.totalConfig(
            sport,
            if (sport == HistoricalAnalysisSport.MLB) "total" else "fg_total",
        )

        fun chip(label: String, clear: (HistoricalAnalysisUISnapshot) -> Unit) {
            chips += ActiveChip(label, clear)
        }
        fun t(value: Double) = HistoricalAnalysisCopy.trimmed(value)
        fun pctRange(range: List<Double>) = "${range[0].toInt()}–${range[1].toInt()}%"
        fun numRange(range: List<Double>) = "${t(range[0])}–${t(range[1])}"
        fun intRange(range: List<Int>) = "${range[0]}–${range[1]}"

        if (s.seasonMin != seasonFloor || s.seasonMax != sport.seasonMax) {
            chip("Seasons ${HistoricalAnalysisCopy.yearRange(s.seasonMin, s.seasonMax)}") {
                it.seasonMin = seasonFloor; it.seasonMax = sport.seasonMax
            }
        }

        when (sport) {
            HistoricalAnalysisSport.NFL -> {
                if (s.seasonType != "any") {
                    chip(if (s.seasonType == "regular") "Regular season" else "Playoffs") {
                        it.seasonType = "any"; it.playoffRound = "any"
                    }
                }
                if (s.seasonType == "regular" && (s.weekMin != 1 || s.weekMax != weekMax)) {
                    chip("Weeks ${s.weekMin}–${s.weekMax}") { it.weekMin = 1; it.weekMax = weekMax }
                }
                if (s.seasonType == "postseason" && s.playoffRound != "any") {
                    chip("Round: ${s.playoffRound}") { it.playoffRound = "any" }
                }
            }
            HistoricalAnalysisSport.CFB -> {
                if (s.gameType != "any") {
                    val labels = mapOf(
                        "regular" to "Regular season", "bowl" to "Bowl games",
                        "playoff" to "Playoff", "postseason" to "All postseason",
                    )
                    chip(labels[s.gameType] ?: s.gameType) { it.gameType = "any" }
                }
                if (s.rankedMatchup != "any") {
                    val labels = mapOf(
                        "both" to "Both ranked", "neither" to "Neither ranked",
                        "home_ranked" to "Home ranked / away unranked",
                        "away_ranked" to "Away ranked / home unranked",
                        "either" to "Either ranked",
                    )
                    chip(labels[s.rankedMatchup] ?: s.rankedMatchup) { it.rankedMatchup = "any" }
                }
                // The CFB builder emits week bounds on "any" as well as "regular",
                // so gating the chip on "regular" (as iOS does) hid a live filter.
                if (s.gameType in setOf("any", "regular") && (s.weekMin != 1 || s.weekMax != weekMax)) {
                    chip("Weeks ${s.weekMin}–${s.weekMax}") { it.weekMin = 1; it.weekMax = weekMax }
                }
            }
            HistoricalAnalysisSport.MLB -> {
                if (s.monthMin != 3 || s.monthMax != 11) {
                    chip("Months ${monthName(s.monthMin)}–${monthName(s.monthMax)}") {
                        it.monthMin = 3; it.monthMax = 11
                    }
                }
                if (!s.timeMin.isEmpty() || !s.timeMax.isEmpty()) {
                    val lo = s.timeMin.ifEmpty { "…" }
                    val hi = s.timeMax.ifEmpty { "…" }
                    chip("Start $lo–$hi") { it.timeMin = ""; it.timeMax = "" }
                }
                if (s.f5TotalMin > 2.001 || s.f5TotalMax < 7.999) {
                    chip("F5 total ${t(s.f5TotalMin)}–${t(s.f5TotalMax)}") {
                        it.f5TotalMin = 2.0; it.f5TotalMax = 8.0
                    }
                }
                if (s.seriesGames.isNotEmpty() || s.seriesGameMin != null || s.seriesGameMax != null) {
                    val games = s.seriesGames.sorted().joinToString(", ")
                    chip(if (games.isEmpty()) "Series game" else "Series game $games") {
                        it.seriesGames = emptyList(); it.seriesGameMin = null; it.seriesGameMax = null
                    }
                }
                if (s.tripMin != null || s.tripMax != null) {
                    chip("Trip ${s.tripMin ?: 1}–${s.tripMax ?: 5}") { it.tripMin = null; it.tripMax = null }
                }
                if (s.switchGame != null) {
                    chip("Switch: ${yesNo(s.switchGame)}") { it.switchGame = null }
                }
                if (s.restMin != null || s.restMax != null) {
                    chip("Rest ${s.restMin ?: 0}–${s.restMax ?: 10} days") { it.restMin = null; it.restMax = null }
                }
                // Last game (shared fields / RPC keys with football, MLB wording).
                if (s.lastResult != "any") {
                    chip("Last: ${if (s.lastResult == "won") "Won" else "Lost"}") { it.lastResult = "any" }
                }
                if (s.lastAts != "any") {
                    chip("Last: ${if (s.lastAts == "covered") "Covered RL" else "Didn't cover RL"}") { it.lastAts = "any" }
                }
                if (s.lastTotal != "any") {
                    chip("Last: ${if (s.lastTotal == "over") "Over" else "Under"}") { it.lastTotal = "any" }
                }
                if (s.lastRole != "any") {
                    chip("Last: ${if (s.lastRole == "favorite") "Favorite" else "Underdog"}") { it.lastRole = "any" }
                }
                if (s.lastMargin != d.lastMargin) {
                    chip("Last margin ${intRange(s.lastMargin)}") { it.lastMargin = d.lastMargin }
                }
                if (s.lastMarginMin.isNotEmpty() || s.lastMarginMax.isNotEmpty()) {
                    chip("Last margin") { it.lastMarginMin = ""; it.lastMarginMax = "" }
                }
                val streakLo = s.streakMin.trim().toDoubleOrNull()
                val streakHi = s.streakMax.trim().toDoubleOrNull()
                if (streakLo != null || streakHi != null) {
                    chip("Streak ${streakLo?.let { v -> t(v) } ?: "…"}–${streakHi?.let { v -> t(v) } ?: "…"}") {
                        it.streakMin = ""; it.streakMax = ""
                    }
                }
                s.sp.forEach { pitcher ->
                    chip("SP: ${pitcher.name}") { snap -> snap.sp = snap.sp.filterNot { it.id == pitcher.id } }
                }
                s.oppSp.forEach { pitcher ->
                    chip("Opp SP: ${pitcher.name}") { snap -> snap.oppSp = snap.oppSp.filterNot { it.id == pitcher.id } }
                }
                if (s.spHand != "any") chip("SP ${s.spHand}HP") { it.spHand = "any" }
                if (s.oppSpHand != "any") chip("Opp SP ${s.oppSpHand}HP") { it.oppSpHand = "any" }
                if (s.spXfipMin > 2.001 || s.spXfipMax < 6.999) {
                    chip("SP xFIP ${t(s.spXfipMin)}–${t(s.spXfipMax)}") { it.spXfipMin = 2.0; it.spXfipMax = 7.0 }
                }
                if (s.oppSpXfipMin > 2.001 || s.oppSpXfipMax < 6.999) {
                    chip("Opp SP xFIP ${t(s.oppSpXfipMin)}–${t(s.oppSpXfipMax)}") { it.oppSpXfipMin = 2.0; it.oppSpXfipMax = 7.0 }
                }
                if (s.spEraMin > 0.001 || s.spEraMax < 9.999) {
                    chip("SP ERA ${t(s.spEraMin)}–${t(s.spEraMax)}") { it.spEraMin = 0.0; it.spEraMax = 10.0 }
                }
                if (s.oppSpEraMin > 0.001 || s.oppSpEraMax < 9.999) {
                    chip("Opp SP ERA ${t(s.oppSpEraMin)}–${t(s.oppSpEraMax)}") { it.oppSpEraMin = 0.0; it.oppSpEraMax = 10.0 }
                }
                if (s.bpIpMin > 0.001 || s.bpIpMax < 19.999) {
                    chip("Opp bullpen IP ${t(s.bpIpMin)}–${t(s.bpIpMax)}") { it.bpIpMin = 0.0; it.bpIpMax = 20.0 }
                }
                if (s.bpXfipMin > 2.001 || s.bpXfipMax < 6.999) {
                    chip("Opp bullpen xFIP ${t(s.bpXfipMin)}–${t(s.bpXfipMax)}") { it.bpXfipMin = 2.0; it.bpXfipMax = 7.0 }
                }
                if (s.interleague != null) chip("Interleague: ${yesNo(s.interleague)}") { it.interleague = null }
                if (s.doubleheader != null) chip("DH: ${yesNo(s.doubleheader)}") { it.doubleheader = null }
                if (s.windDir != "any") chip("Wind ${s.windDir}") { it.windDir = "any" }
                if (s.pfRunsMin != null || s.pfRunsMax != null) {
                    chip("Park factor ${t(s.pfRunsMin ?: 85.0)}–${t(s.pfRunsMax ?: 115.0)}") {
                        it.pfRunsMin = null; it.pfRunsMax = null
                    }
                }
            }
        }

        // Days of week + legacy single-day are emitted on every sport by the builder.
        s.daysOfWeek.forEach { day ->
            chip(dayLabel(day)) { snap -> snap.daysOfWeek = snap.daysOfWeek - day }
        }
        if (s.daysOfWeek.isEmpty() && s.dayOfWeek != "any") {
            chip(s.dayOfWeek) { it.dayOfWeek = "any" }
        }

        s.teams.forEach { team -> chip("Team: $team") { snap -> snap.teams = snap.teams - team } }
        s.opponents.forEach { opp -> chip("vs $opp") { snap -> snap.opponents = snap.opponents - opp } }

        if (s.side != "any" && !isGameTotal) {
            chip(if (s.side == "home") "Home" else "Away") { it.side = "any" }
        }

        val favDogApplies = betType in HistoricalAnalysisBetType.moneylineMarkets ||
            betType == "team_total" ||
            betType in setOf("ml", "f5_ml", "rl", "f5_rl")
        if (favDogApplies && s.favDog != "any") {
            chip(if (s.favDog == "favorite") "Favorites" else "Underdogs") { it.favDog = "any" }
        }

        if (s.rlSide != "any") {
            chip(if (s.rlSide == "plus") "Getting +1.5" else "Laying −1.5") { it.rlSide = "any" }
        }

        if (spreadCfg != null) {
            val spreadMax = spreadCfg.max
            val lo = t(s.spreadMin)
            val hi = t(s.spreadMax)
            if (s.spreadSide != "any") {
                val sideLabel = if (s.spreadSide == "favorite") "Favored by" else "Getting"
                chip("$sideLabel $lo–$hi") {
                    it.spreadSide = "any"; it.spreadMin = 0.0; it.spreadMax = spreadMax
                }
            } else if (s.spreadMin > 0.001 || s.spreadMax < spreadMax - 0.001) {
                chip("Spread $lo–$hi") { it.spreadMin = 0.0; it.spreadMax = spreadMax }
            }
        }

        if (totalCfg != null && (s.lineMin > totalCfg.min + 0.001 || s.lineMax < totalCfg.max - 0.001)) {
            chip("${totalCfg.label} ${t(s.lineMin)}–${t(s.lineMax)}") {
                it.lineMin = totalCfg.min; it.lineMax = totalCfg.max
            }
        }

        if (sport != HistoricalAnalysisSport.MLB) {
            // Cross-market football dims — the builder always emits these, so a
            // restored web/iOS snapshot needs a visible, clearable chip for each.
            spreadChip("1H spread", s.h1SpreadSide, s.h1SpreadMin, s.h1SpreadMax, d.h1SpreadMax)?.let { label ->
                chip(label) { it.h1SpreadSide = "any"; it.h1SpreadMin = 0.0; it.h1SpreadMax = d.h1SpreadMax }
            }
            spreadChip("Opponent spread", s.oppSpreadSide, s.oppSpreadMin, s.oppSpreadMax, d.oppSpreadMax)?.let { label ->
                chip(label) { it.oppSpreadSide = "any"; it.oppSpreadMin = 0.0; it.oppSpreadMax = d.oppSpreadMax }
            }
            if (s.h1TotalMin != d.h1TotalMin || s.h1TotalMax != d.h1TotalMax) {
                chip("1H total ${t(s.h1TotalMin)}–${t(s.h1TotalMax)}") {
                    it.h1TotalMin = d.h1TotalMin; it.h1TotalMax = d.h1TotalMax
                }
            }
            if (s.ttLineMin != d.ttLineMin || s.ttLineMax != d.ttLineMax) {
                chip("Team total ${t(s.ttLineMin)}–${t(s.ttLineMax)}") {
                    it.ttLineMin = d.ttLineMin; it.ttLineMax = d.ttLineMax
                }
            }
            if (s.oppTtLineMin != d.oppTtLineMin || s.oppTtLineMax != d.oppTtLineMax) {
                chip("Opponent TT ${t(s.oppTtLineMin)}–${t(s.oppTtLineMax)}") {
                    it.oppTtLineMin = d.oppTtLineMin; it.oppTtLineMax = d.oppTtLineMax
                }
            }
            if (s.h1MlMin.isNotEmpty() || s.h1MlMax.isNotEmpty()) {
                chip("1H ML") { it.h1MlMin = ""; it.h1MlMax = "" }
            }
            if (s.oppMlMin.isNotEmpty() || s.oppMlMax.isNotEmpty()) {
                chip("Opponent ML") { it.oppMlMin = ""; it.oppMlMax = "" }
            }
        }

        if (s.mlMin.isNotEmpty() || s.mlMax.isNotEmpty()) {
            chip(moneylineLabel(s.mlMin, s.mlMax)) { it.mlMin = ""; it.mlMax = "" }
        }

        if (s.primetime != null) chip("Primetime: ${yesNo(s.primetime)}") { it.primetime = null }

        when (sport) {
            HistoricalAnalysisSport.NFL -> {
                if (s.division != null) chip("Divisional: ${yesNo(s.division)}") { it.division = null }
                if (s.dome != "any") chip(if (s.dome == "dome") "Dome" else "Outdoor") { it.dome = "any" }
                if (s.precip != "any") chip("Precip: ${s.precip}") { it.precip = "any" }
                if (s.tempMin != -10 || s.tempMax != 100) {
                    chip("Temp ${s.tempMin}–${s.tempMax}°F") { it.tempMin = -10; it.tempMax = 100 }
                }
                windChip(s.windMin, s.windMax, 60)?.let { label -> chip(label) { it.windMin = null; it.windMax = 60 } }
                if (s.restBye != "any") chip(restByeLabel(s.restBye)) { it.restBye = "any" }
                if (s.coach != "any") chip("Coach: ${s.coach}") { it.coach = "any" }
                if (s.referee != "any") chip("Ref: ${s.referee}") { it.referee = "any" }
                s.teamDivisions.forEach { division ->
                    chip(division) { snap -> snap.teamDivisions = snap.teamDivisions - division }
                }
            }
            HistoricalAnalysisSport.CFB -> {
                if (s.conferenceGame != null) chip("Conference game: ${yesNo(s.conferenceGame)}") { it.conferenceGame = null }
                if (s.neutralSite != null) chip("Neutral site: ${yesNo(s.neutralSite)}") { it.neutralSite = null }
                HistoricalAnalysisCopy.activeConferences(s).forEach { conference ->
                    chip(conference) { snap ->
                        snap.selectedConferences = snap.selectedConferences - conference
                        if (snap.selectedConferences.isEmpty()) snap.conference = "any"
                    }
                }
                if (s.tempMin != -10 || s.tempMax != 110) {
                    chip("Temp ${s.tempMin}–${s.tempMax}°F") { it.tempMin = -10; it.tempMax = 110 }
                }
                windChip(s.windMin, s.windMax, 60)?.let { label -> chip(label) { it.windMin = null; it.windMax = 60 } }
                if (s.weather != "any") {
                    val labels = mapOf("clear" to "Clear", "cloudy" to "Cloudy", "rain" to "Rain", "snow" to "Snow")
                    chip("Weather: ${labels[s.weather] ?: s.weather}") { it.weather = "any" }
                }
                if (s.dome != "any") chip(if (s.dome == "dome") "Indoors / dome" else "Outdoors") { it.dome = "any" }
                if (s.restBye != "any") chip(restByeLabel(s.restBye)) { it.restBye = "any" }
            }
            HistoricalAnalysisSport.MLB -> {
                if (s.division != null) chip("Division: ${yesNo(s.division)}") { it.division = null }
                if (s.dome != "any") chip(if (s.dome == "dome") "Dome" else "Outdoor") { it.dome = "any" }
                if (s.tempMin != -10 || s.tempMax != 110) {
                    chip("Temp ${s.tempMin}–${s.tempMax}°F") { it.tempMin = -10; it.tempMax = 110 }
                }
                windChip(s.windMin, s.windMax, 60)?.let { label -> chip(label) { it.windMin = null; it.windMax = 60 } }
            }
        }

        if (sport != HistoricalAnalysisSport.MLB) {
            // Football last game / form / H2H / opponent. iOS runs this block for NFL
            // only, which leaves every CFB team-form and opponent filter chip-less
            // even though the CFB builder emits all of them.
            if (s.lastResult != "any") {
                chip("Last game: ${if (s.lastResult == "won") "Won" else "Lost"}") { it.lastResult = "any" }
            }
            if (s.lastAts != "any") {
                chip("Last game: ${if (s.lastAts == "covered") "Covered" else "Didn't cover"}") { it.lastAts = "any" }
            }
            if (s.lastTotal != "any") {
                chip("Last game: ${if (s.lastTotal == "over") "Over" else "Under"}") { it.lastTotal = "any" }
            }
            if (s.lastRole != "any") {
                chip("Last game: ${if (s.lastRole == "favorite") "Favorite" else "Underdog"}") { it.lastRole = "any" }
            }
            if (s.lastOt != null) chip("Last game OT: ${yesNo(s.lastOt)}") { it.lastOt = null }
            // `lastBlowout` is decode-only (the RPC dropped it) — clear-only chip so a
            // legacy save doesn't leave an invisible value behind on re-save.
            if (s.lastBlowout != "any") {
                chip("Last game: ${if (s.lastBlowout == "win") "Blowout win" else "Blowout loss"}") { it.lastBlowout = "any" }
            }
            marginLabel("Last margin", s.lastMargin, d.lastMargin)?.let { label ->
                chip(label) { it.lastMargin = d.lastMargin }
            }

            // Season record
            if (s.winPct != d.winPct) chip("Win% ${pctRange(s.winPct)}") { it.winPct = d.winPct }
            if (s.winStreak != d.winStreak) chip("Win streak ${intRange(s.winStreak)}") { it.winStreak = d.winStreak }
            if (s.lossStreak != d.lossStreak) chip("Loss streak ${intRange(s.lossStreak)}") { it.lossStreak = d.lossStreak }
            if (s.above500 != null) {
                chip(if (s.above500 == true) "Above .500" else "Below .500") { it.above500 = null }
            }
            if (s.winPctGtOpp != null) {
                chip(if (s.winPctGtOpp == true) "Better record than opp" else "Worse record than opp") { it.winPctGtOpp = null }
            }
            if (s.ppg != d.ppg) chip("PPG ${numRange(s.ppg)}") { it.ppg = d.ppg }
            if (s.paPg != d.paPg) chip("PA/G ${numRange(s.paPg)}") { it.paPg = d.paPg }
            if (s.pointDiffPg != d.pointDiffPg) chip("Point diff ${numRange(s.pointDiffPg)}") { it.pointDiffPg = d.pointDiffPg }
            if (s.minGames > 0) chip("Min ${s.minGames} games") { it.minGames = 0 }

            // Cover profile
            if (s.atsWinPct != d.atsWinPct) chip("ATS% ${pctRange(s.atsWinPct)}") { it.atsWinPct = d.atsWinPct }
            if (s.atsWinStreak != d.atsWinStreak) chip("ATS streak ${intRange(s.atsWinStreak)}") { it.atsWinStreak = d.atsWinStreak }
            if (s.avgCoverMargin != d.avgCoverMargin) {
                chip("Cover margin ${numRange(s.avgCoverMargin)}") { it.avgCoverMargin = d.avgCoverMargin }
            }

            // Total profile
            if (s.overPct != d.overPct) chip("Over% ${pctRange(s.overPct)}") { it.overPct = d.overPct }
            if (s.overStreak != d.overStreak) chip("Over streak ${intRange(s.overStreak)}") { it.overStreak = d.overStreak }
            if (s.underStreak != d.underStreak) chip("Under streak ${intRange(s.underStreak)}") { it.underStreak = d.underStreak }

            // Prior year
            if (s.prevWins != d.prevWins) chip("Prev wins ${intRange(s.prevWins)}") { it.prevWins = d.prevWins }
            if (s.prevWinPct != d.prevWinPct) chip("Prev win% ${pctRange(s.prevWinPct)}") { it.prevWinPct = d.prevWinPct }
            if (s.madePlayoffsPrev != null) {
                chip(if (s.madePlayoffsPrev == true) "Made playoffs prev" else "Missed playoffs prev") { it.madePlayoffsPrev = null }
            }
            if (s.moreWinsThanOppPrev != null) {
                chip(if (s.moreWinsThanOppPrev == true) "More wins than opp prev" else "Fewer wins than opp prev") {
                    it.moreWinsThanOppPrev = null
                }
            }

            // Head-to-head
            if (s.h2hLastWin != "any") {
                chip("H2H last: ${if (s.h2hLastWin == "yes") "Won" else "Lost"}") { it.h2hLastWin = "any" }
            }
            if (s.h2hLastAts != "any") {
                chip("H2H last: ${if (s.h2hLastAts == "yes") "Covered" else "Didn't cover"}") { it.h2hLastAts = "any" }
            }
            if (s.h2hLastOver != "any") {
                chip("H2H last: ${if (s.h2hLastOver == "yes") "Over" else "Under"}") { it.h2hLastOver = "any" }
            }
            if (s.h2hLastHome != null) {
                chip("H2H last: ${if (s.h2hLastHome == true) "Home" else "Away"}") { it.h2hLastHome = null }
            }
            if (s.h2hLastFav != null) {
                chip("H2H last: ${if (s.h2hLastFav == true) "Favorite" else "Underdog"}") { it.h2hLastFav = null }
            }
            if (s.h2hSameSeason != null) {
                chip("H2H: ${if (s.h2hSameSeason == true) "Same season" else "Different season"}") { it.h2hSameSeason = null }
            }
            if (s.h2hSpreadCmp != "any") {
                chip("H2H spread: ${if (s.h2hSpreadCmp == "lower") "Lower" else "Higher"}") { it.h2hSpreadCmp = "any" }
            }

            // Opponent record
            if (s.oppWinPct != d.oppWinPct) chip("Opp win% ${pctRange(s.oppWinPct)}") { it.oppWinPct = d.oppWinPct }
            if (s.oppOverPct != d.oppOverPct) chip("Opp over% ${pctRange(s.oppOverPct)}") { it.oppOverPct = d.oppOverPct }
            if (s.oppWinStreak != d.oppWinStreak) chip("Opp win streak ${intRange(s.oppWinStreak)}") { it.oppWinStreak = d.oppWinStreak }
            if (s.oppLossStreak != d.oppLossStreak) chip("Opp loss streak ${intRange(s.oppLossStreak)}") { it.oppLossStreak = d.oppLossStreak }
            if (s.oppPpg != d.oppPpg) chip("Opp PPG ${numRange(s.oppPpg)}") { it.oppPpg = d.oppPpg }
            if (s.oppPaPg != d.oppPaPg) chip("Opp PA/G ${numRange(s.oppPaPg)}") { it.oppPaPg = d.oppPaPg }
            if (s.oppPrevWinPct != d.oppPrevWinPct) chip("Opp prev win% ${pctRange(s.oppPrevWinPct)}") { it.oppPrevWinPct = d.oppPrevWinPct }

            // Opponent last game
            if (s.oppLastResult != "any") {
                chip("Opp last: ${if (s.oppLastResult == "won") "Won" else "Lost"}") { it.oppLastResult = "any" }
            }
            if (s.oppLastAts != "any") {
                chip("Opp last: ${if (s.oppLastAts == "covered") "Covered" else "Didn't cover"}") { it.oppLastAts = "any" }
            }
            if (s.oppLastTotal != "any") {
                chip("Opp last: ${if (s.oppLastTotal == "over") "Over" else "Under"}") { it.oppLastTotal = "any" }
            }
            if (s.oppLastRole != "any") {
                chip("Opp last: ${if (s.oppLastRole == "favorite") "Favorite" else "Underdog"}") { it.oppLastRole = "any" }
            }
            if (s.oppLastOt != null) chip("Opp last OT: ${yesNo(s.oppLastOt)}") { it.oppLastOt = null }
            marginLabel("Opp last margin", s.oppLastMargin, d.oppLastMargin)?.let { label ->
                chip(label) { it.oppLastMargin = d.oppLastMargin }
            }
        } else {
            // MLB team form / RL profile / total profile / prior year / H2H / opponent.
            if (s.winPct != d.winPct) chip("Win% ${pctRange(s.winPct)}") { it.winPct = d.winPct }
            if (s.winStreak != d.winStreak) chip("Win streak ${intRange(s.winStreak)}") { it.winStreak = d.winStreak }
            if (s.lossStreak != d.lossStreak) chip("Loss streak ${intRange(s.lossStreak)}") { it.lossStreak = d.lossStreak }
            if (s.rpg != d.rpg) chip("RPG ${numRange(s.rpg)}") { it.rpg = d.rpg }
            if (s.rapg != d.rapg) chip("RAPG ${numRange(s.rapg)}") { it.rapg = d.rapg }
            if (s.runDiffPg != d.runDiffPg) chip("Run diff ${numRange(s.runDiffPg)}") { it.runDiffPg = d.runDiffPg }
            if (s.minGames > 0) chip("Min ${s.minGames} games") { it.minGames = 0 }

            if (s.rlCoverPct != d.rlCoverPct) chip("RL cover% ${pctRange(s.rlCoverPct)}") { it.rlCoverPct = d.rlCoverPct }
            if (s.rlStreak != d.rlStreak) chip("RL streak ${intRange(s.rlStreak)}") { it.rlStreak = d.rlStreak }

            if (s.overPct != d.overPct) chip("Over% ${pctRange(s.overPct)}") { it.overPct = d.overPct }
            if (s.overStreak != d.overStreak) chip("Over streak ${intRange(s.overStreak)}") { it.overStreak = d.overStreak }
            if (s.underStreak != d.underStreak) chip("Under streak ${intRange(s.underStreak)}") { it.underStreak = d.underStreak }

            if (s.prevWins != d.prevWins) chip("Prev wins ${intRange(s.prevWins)}") { it.prevWins = d.prevWins }
            if (s.prevWinPct != d.prevWinPct) chip("Prev win% ${pctRange(s.prevWinPct)}") { it.prevWinPct = d.prevWinPct }

            if (s.h2hLastWin != "any") {
                chip("H2H last: ${if (s.h2hLastWin == "yes") "Won" else "Lost"}") { it.h2hLastWin = "any" }
            }
            if (s.h2hLastAts != "any") {
                chip("H2H last: ${if (s.h2hLastAts == "yes") "Covered RL" else "Didn't cover RL"}") { it.h2hLastAts = "any" }
            }
            if (s.h2hLastOver != "any") {
                chip("H2H last: ${if (s.h2hLastOver == "yes") "Over" else "Under"}") { it.h2hLastOver = "any" }
            }
            if (s.h2hLastMargin != d.h2hLastMargin) {
                chip("H2H margin ${intRange(s.h2hLastMargin)}") { it.h2hLastMargin = d.h2hLastMargin }
            }
            if (s.h2hLastHome != null) {
                chip("H2H last: ${if (s.h2hLastHome == true) "Home" else "Away"}") { it.h2hLastHome = null }
            }
            if (s.h2hLastFav != null) {
                chip("H2H last: ${if (s.h2hLastFav == true) "Favorite" else "Underdog"}") { it.h2hLastFav = null }
            }
            if (s.h2hSameSeason != null) {
                chip("H2H: ${if (s.h2hSameSeason == true) "Same season" else "Different season"}") { it.h2hSameSeason = null }
            }

            if (s.oppWinPct != d.oppWinPct) chip("Opp win% ${pctRange(s.oppWinPct)}") { it.oppWinPct = d.oppWinPct }
            if (s.oppOverPct != d.oppOverPct) chip("Opp over% ${pctRange(s.oppOverPct)}") { it.oppOverPct = d.oppOverPct }
            if (s.oppRlCoverPct != d.oppRlCoverPct) {
                chip("Opp RL cover% ${pctRange(s.oppRlCoverPct)}") { it.oppRlCoverPct = d.oppRlCoverPct }
            }
            if (s.oppWinStreak != d.oppWinStreak) chip("Opp win streak ${intRange(s.oppWinStreak)}") { it.oppWinStreak = d.oppWinStreak }
            if (s.oppLossStreak != d.oppLossStreak) chip("Opp loss streak ${intRange(s.oppLossStreak)}") { it.oppLossStreak = d.oppLossStreak }
            if (s.oppRpg != d.oppRpg) chip("Opp RPG ${numRange(s.oppRpg)}") { it.oppRpg = d.oppRpg }
            if (s.oppRapg != d.oppRapg) chip("Opp RAPG ${numRange(s.oppRapg)}") { it.oppRapg = d.oppRapg }
            if (s.oppPrevWinPct != d.oppPrevWinPct) chip("Opp prev win% ${pctRange(s.oppPrevWinPct)}") { it.oppPrevWinPct = d.oppPrevWinPct }

            if (s.oppLastResult != "any") {
                chip("Opp last: ${if (s.oppLastResult == "won") "Won" else "Lost"}") { it.oppLastResult = "any" }
            }
            if (s.oppLastAts != "any") {
                chip("Opp last: ${if (s.oppLastAts == "covered") "Covered RL" else "Didn't cover RL"}") { it.oppLastAts = "any" }
            }
            if (s.oppLastTotal != "any") {
                chip("Opp last: ${if (s.oppLastTotal == "over") "Over" else "Under"}") { it.oppLastTotal = "any" }
            }
            if (s.oppLastRole != "any") {
                chip("Opp last: ${if (s.oppLastRole == "favorite") "Favorite" else "Underdog"}") { it.oppLastRole = "any" }
            }
            if (s.oppLastMargin != d.oppLastMargin) {
                chip("Opp last margin ${intRange(s.oppLastMargin)}") { it.oppLastMargin = d.oppLastMargin }
            }
        }

        return chips
    }

    private fun yesNo(value: Boolean?) = if (value == true) "Yes" else "No"

    private fun restByeLabel(value: String) = when (value) {
        "off_bye" -> "Off a bye"
        "pre_bye" -> "Before a bye"
        "short" -> "Short rest"
        else -> value
    }

    /** "1H spread favorite 3–7"; null when the dim is untouched. */
    private fun spreadChip(
        label: String,
        side: String,
        min: Double,
        max: Double,
        defaultMax: Double,
    ): String? {
        if (side == "any" && min <= 0.001 && max >= defaultMax - 0.001) return null
        val sidePart = if (side == "any") "" else "$side "
        return "$label $sidePart${HistoricalAnalysisCopy.trimmed(min)}–${HistoricalAnalysisCopy.trimmed(max)}"
    }

    /** "Last margin 7–21" / "Last margin ≥ 7" / "Last margin ≤ 21"; null when untouched. */
    private fun marginLabel(prefix: String, value: List<Int>, default: List<Int>): String? {
        if (value == default) return null
        val lo = if (value[0] == default[0]) null else value[0]
        val hi = if (value[1] == default[1]) null else value[1]
        return when {
            lo != null && hi != null -> "$prefix $lo–$hi"
            lo != null -> "$prefix ≥ $lo"
            hi != null -> "$prefix ≤ $hi"
            else -> null
        }
    }

    /** "Wind 5–20" / "Wind ≥ 5" / "Wind ≤ 20"; null when untouched. */
    private fun windChip(windMin: Int?, windMax: Int, defaultMax: Int): String? {
        if (windMax == defaultMax && windMin == null) return null
        val lo = windMin ?: 0
        return when {
            lo > 0 && windMax < defaultMax -> "Wind $lo–$windMax"
            lo > 0 -> "Wind ≥ $lo"
            else -> "Wind ≤ $windMax"
        }
    }

    /** "ML -200 to +150" / "ML ≥ -200" / "ML ≤ +150". */
    private fun moneylineLabel(min: String, max: String): String {
        fun fmt(raw: String): String {
            val n = raw.trim().toDoubleOrNull() ?: return raw
            return if (n > 0) "+${n.toInt()}" else "${n.toInt()}"
        }
        return when {
            min.isNotEmpty() && max.isNotEmpty() -> "ML ${fmt(min)} to ${fmt(max)}"
            min.isNotEmpty() -> "ML ≥ ${fmt(min)}"
            else -> "ML ≤ ${fmt(max)}"
        }
    }
}
