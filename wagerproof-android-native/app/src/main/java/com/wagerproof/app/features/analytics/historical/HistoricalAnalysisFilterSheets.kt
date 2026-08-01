package com.wagerproof.app.features.analytics.historical

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.stores.HistoricalAnalysisStore
import com.wagerproof.core.stores.LoadState

// Bodies for the 11 Historical Analysis filter sheets. One-for-one port of the
// sheet set in iOS HistoricalAnalysisFiltersView.swift; every control writes the
// snapshot field whose name the RPC builder and cross-platform saved systems use.

@Composable
internal fun ColumnScope.FilterSheetContent(store: HistoricalAnalysisStore, sheet: FilterSheet) {
    when (sheet) {
        FilterSheet.Teams -> TeamsSheet(store)
        FilterSheet.Lines -> if (store.sport == HistoricalAnalysisSport.MLB) MlbLinesSheet(store) else LinesSheet(store)
        FilterSheet.Schedule -> ScheduleSheet(store)
        FilterSheet.Game -> GameSheet(store)
        FilterSheet.Weather -> WeatherSheet(store)
        FilterSheet.TeamForm ->
            if (store.sport == HistoricalAnalysisSport.MLB) MlbTeamFormSheet(store) else FootballTeamFormSheet(store)
        FilterSheet.LastGame -> LastGameSheet(store)
        FilterSheet.H2H -> HeadToHeadSheet(store)
        FilterSheet.Opponent ->
            if (store.sport == HistoricalAnalysisSport.MLB) MlbOpponentSheet(store) else FootballOpponentSheet(store)
        FilterSheet.Pitching -> PitchingSheet(store)
        FilterSheet.CoachRef -> CoachRefSheet(store)
    }
}

// MARK: - Teams (who's playing)

@Composable
private fun ColumnScope.TeamsSheet(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    val options = store.teamOptions.map { option ->
        SelectOption(option.id, if (option.id == option.name) option.name else "${option.id} · ${option.name}")
    }
    SearchableMultiSelectRow("Teams", options, s.teams) { next -> changed(store) { it.teams = next } }
    SearchableMultiSelectRow("Opponents", options, s.opponents) { next -> changed(store) { it.opponents = next } }

    if (store.sport == HistoricalAnalysisSport.CFB) {
        val active = HistoricalAnalysisCopy.activeConferences(s)
        SheetSection("Conferences") {
            MultiSelectChips(
                title = "Conference",
                options = store.conferences.map { it to it },
                selected = active,
                emptyLabel = "All conferences",
            ) { conference ->
                changed(store) { snap ->
                    snap.selectedConferences =
                        if (conference in snap.selectedConferences) snap.selectedConferences - conference
                        else (snap.selectedConferences + conference).sorted()
                    // The legacy single-conference field is decode-only; folding it into
                    // the multi-select keeps the builder from emitting two conference clauses.
                    snap.conference = "any"
                }
            }
            if (active.isNotEmpty()) {
                TextButton(onClick = {
                    changed(store) { it.selectedConferences = emptyList(); it.conference = "any" }
                }) { Text("Clear all conferences", color = AppColors.appAccentRed) }
            }
        }
    }

    if (store.sport == HistoricalAnalysisSport.NFL) {
        SheetSection("Team divisions") {
            MultiSelectChips(
                title = "Division",
                options = HistoricalAnalysisActiveChips.nflDivisions.map { it to it },
                selected = s.teamDivisions,
                emptyLabel = "All divisions",
            ) { division ->
                changed(store) { snap ->
                    snap.teamDivisions =
                        if (division in snap.teamDivisions) snap.teamDivisions - division
                        else snap.teamDivisions + division
                }
            }
        }
    }
}

// MARK: - Lines & odds
//
// Every control writes its OWN snapshot field. The sheet used to resolve one
// config from the selected bet type and then write `spreadMin/Max` + `lineMin/Max`
// regardless, so picking 1H Total or Team Total emitted the full-game keys instead
// — the intended filter never fired and a different one silently did.

@Composable
private fun ColumnScope.LinesSheet(store: HistoricalAnalysisStore) {
    val sport = store.sport
    val s = store.snapshot
    val fullGame = HistoricalAnalysisFilterBuilder.spreadConfig(sport, "fg_spread") ?: return

    SpreadSection(store, "Full-game spread", s.spreadSide, s.spreadMin, s.spreadMax, fullGame.max,
        writeSide = { snap, v -> snap.spreadSide = v },
        writeRange = { snap, lo, hi -> snap.spreadMin = lo; snap.spreadMax = hi })

    MoneylineSection(store, "Full-game ML", s.mlMin, s.mlMax,
        { snap, v -> snap.mlMin = v }, { snap, v -> snap.mlMax = v })

    HistoricalAnalysisFilterBuilder.totalConfig(sport, "fg_total")?.let { cfg ->
        SheetSection(cfg.label) {
            LabeledRangeSlider(cfg.label, s.lineMin, s.lineMax, cfg.min, cfg.max, 0.5) { lo, hi ->
                changed(store) { it.lineMin = lo; it.lineMax = hi }
            }
        }
    }

    HistoricalAnalysisFilterBuilder.spreadConfig(sport, "h1_spread")?.let { cfg ->
        SpreadSection(store, "1H spread", s.h1SpreadSide, s.h1SpreadMin, s.h1SpreadMax, cfg.max,
            writeSide = { snap, v -> snap.h1SpreadSide = v },
            writeRange = { snap, lo, hi -> snap.h1SpreadMin = lo; snap.h1SpreadMax = hi })
    }
    MoneylineSection(store, "1H ML", s.h1MlMin, s.h1MlMax,
        { snap, v -> snap.h1MlMin = v }, { snap, v -> snap.h1MlMax = v })
    HistoricalAnalysisFilterBuilder.totalConfig(sport, "h1_total")?.let { cfg ->
        SheetSection(cfg.label) {
            LabeledRangeSlider(cfg.label, s.h1TotalMin, s.h1TotalMax, cfg.min, cfg.max, 0.5) { lo, hi ->
                changed(store) { it.h1TotalMin = lo; it.h1TotalMax = hi }
            }
        }
    }
    HistoricalAnalysisFilterBuilder.totalConfig(sport, "team_total")?.let { cfg ->
        SheetSection(cfg.label) {
            LabeledRangeSlider(cfg.label, s.ttLineMin, s.ttLineMax, cfg.min, cfg.max, 0.5) { lo, hi ->
                changed(store) { it.ttLineMin = lo; it.ttLineMax = hi }
            }
        }
    }

    // An opponent spread is the opposite signed subject-team spread — same bounds.
    SpreadSection(store, "Opponent spread", s.oppSpreadSide, s.oppSpreadMin, s.oppSpreadMax, fullGame.max,
        writeSide = { snap, v -> snap.oppSpreadSide = v },
        writeRange = { snap, lo, hi -> snap.oppSpreadMin = lo; snap.oppSpreadMax = hi })
    MoneylineSection(store, "Opponent ML", s.oppMlMin, s.oppMlMax,
        { snap, v -> snap.oppMlMin = v }, { snap, v -> snap.oppMlMax = v })
    HistoricalAnalysisFilterBuilder.totalConfig(sport, "team_total")?.let { cfg ->
        SheetSection("Opponent team total line") {
            LabeledRangeSlider("Opponent TT", s.oppTtLineMin, s.oppTtLineMax, cfg.min, cfg.max, 0.5) { lo, hi ->
                changed(store) { it.oppTtLineMin = lo; it.oppTtLineMax = hi }
            }
        }
    }
}

@Composable
private fun ColumnScope.MlbLinesSheet(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    // The posted run line is a different question from the ML favorite — books
    // post the ML favorite at +1.5 in ~7% of games. Game totals are game-level.
    if (store.betType !in setOf("total", "f5_total")) {
        SheetSection("Run line") {
            ChoiceRow("Run line", listOf("any" to "Any", "minus" to "Laying −1.5", "plus" to "Getting +1.5"), s.rlSide) {
                changed(store) { snap -> snap.rlSide = it }
            }
        }
    }
    MoneylineSection(store, "Moneyline odds", s.mlMin, s.mlMax,
        { snap, v -> snap.mlMin = v }, { snap, v -> snap.mlMax = v })

    HistoricalAnalysisFilterBuilder.totalConfig(HistoricalAnalysisSport.MLB, "total")?.let { cfg ->
        SheetSection("Game total (runs)") {
            LabeledRangeSlider("Game total", s.lineMin, s.lineMax, cfg.min, cfg.max, 0.5, suffix = " runs") { lo, hi ->
                changed(store) { it.lineMin = lo; it.lineMax = hi }
            }
        }
    }
    // F5 total is an independent dim from the game total, always emitted
    // regardless of the selected bet type (web parity).
    HistoricalAnalysisFilterBuilder.totalConfig(HistoricalAnalysisSport.MLB, "f5_total")?.let { cfg ->
        SheetSection("First-5-innings total (runs)") {
            LabeledRangeSlider("F5 total", s.f5TotalMin, s.f5TotalMax, cfg.min, cfg.max, 0.5, suffix = " runs") { lo, hi ->
                changed(store) { it.f5TotalMin = lo; it.f5TotalMax = hi }
            }
        }
    }
}

@Composable
private fun ColumnScope.SpreadSection(
    store: HistoricalAnalysisStore,
    title: String,
    side: String,
    lower: Double,
    upper: Double,
    max: Double,
    writeSide: (HistoricalAnalysisUISnapshot, String) -> Unit,
    writeRange: (HistoricalAnalysisUISnapshot, Double, Double) -> Unit,
) = SheetSection(title) {
    ChoiceRow("Side", listOf("any" to "Either side", "favorite" to "Favored by", "underdog" to "Getting"), side) { value ->
        changed(store) { writeSide(it, value) }
    }
    LabeledRangeSlider("Range", lower, upper, 0.0, max, 0.5) { lo, hi ->
        changed(store) { writeRange(it, lo, hi) }
    }
}

@Composable
private fun ColumnScope.MoneylineSection(
    store: HistoricalAnalysisStore,
    title: String,
    min: String,
    max: String,
    writeMin: (HistoricalAnalysisUISnapshot, String) -> Unit,
    writeMax: (HistoricalAnalysisUISnapshot, String) -> Unit,
) = SheetSection(title) {
    SheetTextField("Min American odds (e.g. -200)", min) { value -> changed(store) { writeMin(it, value) } }
    SheetTextField("Max American odds (e.g. -120)", max) { value -> changed(store) { writeMax(it, value) } }
}

// MARK: - Schedule (when is it played)

@Composable
private fun ColumnScope.ScheduleSheet(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    SheetSection("Seasons") {
        LabeledIntRangeSlider("Seasons", s.seasonMin, s.seasonMax, store.seasonFloor, store.sport.seasonMax) { lo, hi ->
            changed(store) { it.seasonMin = lo; it.seasonMax = hi }
        }
    }

    when (store.sport) {
        HistoricalAnalysisSport.NFL -> {
            ChoiceRow(
                "Season type",
                listOf("any" to "Regular + Playoffs", "regular" to "Regular season", "postseason" to "Playoffs only"),
                s.seasonType,
            ) { changed(store) { snap -> snap.seasonType = it } }
            if (s.seasonType == "regular") WeekRange(store, 18)
            if (s.seasonType == "postseason") {
                ChoiceRow(
                    "Playoff round",
                    listOf(
                        "any" to "All rounds", "Wild Card" to "Wild Card", "Divisional" to "Divisional",
                        "Conference" to "Conference", "Super Bowl" to "Super Bowl",
                    ),
                    s.playoffRound,
                ) { changed(store) { snap -> snap.playoffRound = it } }
            }
            DaysOfWeekSection(store)
            RestByeRow(store)
        }
        HistoricalAnalysisSport.CFB -> {
            ChoiceRow(
                "Game type",
                listOf(
                    "any" to "All games", "regular" to "Regular season", "bowl" to "Bowl games",
                    "playoff" to "Playoff", "postseason" to "All postseason",
                ),
                s.gameType,
            ) { changed(store) { snap -> snap.gameType = it } }
            if (s.gameType == "any" || s.gameType == "regular") WeekRange(store, 16)
            // iOS omits these two on CFB, but the CFB branch of buildRPCFilters emits
            // `day_of_week` and rest/bye all the same — without controls they were
            // reachable only by restoring a web system.
            DaysOfWeekSection(store)
            RestByeRow(store)
        }
        HistoricalAnalysisSport.MLB -> {
            SheetSection("Months") {
                LabeledIntRangeSlider(
                    "Months", s.monthMin, s.monthMax, 3, 11,
                    format = HistoricalAnalysisActiveChips::monthName,
                ) { lo, hi -> changed(store) { it.monthMin = lo; it.monthMax = hi } }
            }
            DaysOfWeekSection(store)
            SheetSection("Start time (ET)") {
                SheetTextField("From (HH:MM, e.g. 13:00)", s.timeMin) { value -> changed(store) { it.timeMin = value } }
                SheetTextField("To (HH:MM, e.g. 19:00)", s.timeMax) { value -> changed(store) { it.timeMax = value } }
            }
            SheetSection("Series game") {
                // Games 5-6 exist only via doubleheader-stretched series (a handful of rows).
                MultiSelectChips(
                    title = "Game number",
                    options = (1..4).map { it.toString() to "Game $it" },
                    selected = s.seriesGames.map(Int::toString),
                    emptyLabel = "Any game",
                ) { value ->
                    val game = value.toInt()
                    changed(store) { snap ->
                        snap.seriesGames =
                            if (game in snap.seriesGames) snap.seriesGames - game else snap.seriesGames + game
                    }
                }
            }
            SheetSection("Trip series index") {
                OptionalIntRangeRow("Trip #", s.tripMin, s.tripMax, 1, 5) { lo, hi ->
                    changed(store) { it.tripMin = lo; it.tripMax = hi }
                }
            }
            SheetSection("Days rest") {
                OptionalIntRangeRow(
                    "Rest", s.restMin, s.restMax, 0, 10,
                    suffix = " days",
                    caption = "0 = played the day before · 1+ = days off before this game",
                ) { lo, hi -> changed(store) { it.restMin = lo; it.restMax = hi } }
            }
            OptionalBoolRow("Doubleheader", s.doubleheader) { changed(store) { snap -> snap.doubleheader = it } }
        }
    }
}

@Composable
private fun ColumnScope.WeekRange(store: HistoricalAnalysisStore, max: Int) {
    val s = store.snapshot
    LabeledIntRangeSlider("Weeks", s.weekMin, s.weekMax, 1, max) { lo, hi ->
        changed(store) { it.weekMin = lo; it.weekMax = hi }
    }
}

@Composable
private fun ColumnScope.DaysOfWeekSection(store: HistoricalAnalysisStore) = SheetSection("Days of week") {
    MultiSelectChips(
        title = "Day",
        options = HistoricalAnalysisActiveChips.allDays.map { it to it },
        selected = store.snapshot.daysOfWeek,
        emptyLabel = "All days",
    ) { day ->
        changed(store) { snap ->
            snap.daysOfWeek = if (day in snap.daysOfWeek) snap.daysOfWeek - day else snap.daysOfWeek + day
        }
    }
}

@Composable
private fun ColumnScope.RestByeRow(store: HistoricalAnalysisStore) {
    val shortLabel = if (store.sport == HistoricalAnalysisSport.NFL) "Short rest (Thu)" else "Short rest"
    ChoiceRow(
        "Rest / bye",
        listOf("any" to "Any", "off_bye" to "Off a bye", "pre_bye" to "Week before bye", "short" to shortLabel),
        store.snapshot.restBye,
    ) { changed(store) { snap -> snap.restBye = it } }
}

// MARK: - Game (what kind of matchup)

@Composable
private fun ColumnScope.GameSheet(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    when (store.sport) {
        HistoricalAnalysisSport.NFL -> {
            OptionalBoolRow("Primetime", s.primetime) { changed(store) { snap -> snap.primetime = it } }
            OptionalBoolRow("Divisional", s.division) { changed(store) { snap -> snap.division = it } }
        }
        HistoricalAnalysisSport.CFB -> {
            ChoiceRow(
                "Ranked matchup",
                listOf(
                    "any" to "Any", "both" to "Both ranked", "neither" to "Neither ranked",
                    "home_ranked" to "Home ranked / away not", "away_ranked" to "Away ranked / home not",
                    "either" to "Either ranked",
                ),
                s.rankedMatchup,
            ) { changed(store) { snap -> snap.rankedMatchup = it } }
            OptionalBoolRow("Primetime", s.primetime) { changed(store) { snap -> snap.primetime = it } }
            OptionalBoolRow("Conference game", s.conferenceGame) { changed(store) { snap -> snap.conferenceGame = it } }
            OptionalBoolRow("Neutral site", s.neutralSite) { changed(store) { snap -> snap.neutralSite = it } }
        }
        HistoricalAnalysisSport.MLB -> {
            OptionalBoolRow("Division", s.division) { changed(store) { snap -> snap.division = it } }
            OptionalBoolRow("Interleague", s.interleague) { changed(store) { snap -> snap.interleague = it } }
            OptionalBoolRow("First game after home/road switch", s.switchGame) {
                changed(store) { snap -> snap.switchGame = it }
            }
        }
    }
}

// MARK: - Weather & venue

@Composable
private fun ColumnScope.WeatherSheet(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    when (store.sport) {
        HistoricalAnalysisSport.NFL -> {
            ChoiceRow("Venue", listOf("any" to "Any", "dome" to "Dome", "outdoor" to "Outdoor"), s.dome) {
                changed(store) { snap -> snap.dome = it }
            }
            ChoiceRow("Precipitation", listOf("any" to "Any", "none" to "None", "rain" to "Rain", "snow" to "Snow"), s.precip) {
                changed(store) { snap -> snap.precip = it }
            }
            FootballWeatherSliders(store, tempMax = 100)
        }
        HistoricalAnalysisSport.CFB -> {
            ChoiceRow(
                "Weather",
                listOf("any" to "Any", "clear" to "Clear", "cloudy" to "Cloudy", "rain" to "Rain", "snow" to "Snow"),
                s.weather,
            ) { changed(store) { snap -> snap.weather = it } }
            ChoiceRow("Venue", listOf("any" to "Any", "dome" to "Dome / indoors", "outdoor" to "Outdoors"), s.dome) {
                changed(store) { snap -> snap.dome = it }
            }
            FootballWeatherSliders(store, tempMax = 110)
            SheetCaption("Weather conditions are complete for 2022+, partial for 2018–2021, and sparse in 2016–2017.")
        }
        HistoricalAnalysisSport.MLB -> MlbConditions(store)
    }
}

@Composable
private fun ColumnScope.FootballWeatherSliders(store: HistoricalAnalysisStore, tempMax: Int) {
    val s = store.snapshot
    LabeledIntRangeSlider("Temperature", s.tempMin, s.tempMax, -10, tempMax, suffix = "°F") { lo, hi ->
        changed(store) { it.tempMin = lo; it.tempMax = hi }
    }
    LabeledIntRangeSlider("Wind", s.windMin ?: 0, s.windMax, 0, 60, suffix = " mph") { lo, hi ->
        // 0 = unset sentinel so an untouched slider emits no wind_min.
        changed(store) { it.windMin = lo.takeIf { v -> v > 0 }; it.windMax = hi }
    }
}

@Composable
private fun ColumnScope.MlbConditions(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    // Floors at 30°F to match the builder's web-parity emit threshold — the old
    // -10 floor let users set a temp_min the builder silently dropped.
    LabeledIntRangeSlider("Temperature", maxOf(30, s.tempMin), s.tempMax, 30, 110, suffix = "°F") { lo, hi ->
        // Thumb parked at the 30° floor = unset (-10 sentinel).
        changed(store) { it.tempMin = if (lo <= 30) -10 else lo; it.tempMax = hi }
    }
    SheetSection("Wind") {
        LabeledIntRangeSlider("Wind", s.windMin ?: 0, minOf(40, s.windMax), 0, 40, suffix = " mph") { lo, hi ->
            // Thumb at the 40 mph cap = unset (60 sentinel): the builder emits
            // wind_max only below 40.
            changed(store) { it.windMin = lo.takeIf { v -> v > 0 }; it.windMax = if (hi >= 40) 60 else hi }
        }
        ChoiceRow(
            "Wind direction",
            listOf("any" to "Any", "out" to "Out", "in" to "In", "cross" to "Cross", "none" to "None / calm"),
            s.windDir,
        ) { changed(store) { snap -> snap.windDir = it } }
    }
    ChoiceRow("Dome", listOf("any" to "Any", "dome" to "Dome", "outdoor" to "Outdoor"), s.dome) {
        changed(store) { snap -> snap.dome = it }
    }
    SheetSection("Park factor (runs)") {
        // 100-scale (100 = neutral). Bounded slider (85-115, web parity) — free text
        // here invited out-of-scale values like "1.05".
        LabeledRangeSlider(
            "Park factor", s.pfRunsMin ?: 85.0, s.pfRunsMax ?: 115.0, 85.0, 115.0, 1.0,
            caption = "100 = neutral · below = pitcher's park · above = hitter's park",
        ) { lo, hi ->
            changed(store) {
                it.pfRunsMin = lo.takeIf { v -> v > 85.0 }
                it.pfRunsMax = hi.takeIf { v -> v < 115.0 }
            }
        }
    }
}

// MARK: - Team form (as-of season record at time of game)

@Composable
private fun ColumnScope.FootballTeamFormSheet(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    val d = HistoricalAnalysisUISnapshot.defaults(store.sport)

    SheetSection("Season record") {
        PctRangeRow(store, "Win %", s.winPct) { snap, lo, hi -> snap.winPct = listOf(lo, hi) }
        IntRangeRow(store, "Win streak", s.winStreak, 0, 16, " games") { snap, lo, hi -> snap.winStreak = listOf(lo, hi) }
        IntRangeRow(store, "Loss streak", s.lossStreak, 0, 16, " games") { snap, lo, hi -> snap.lossStreak = listOf(lo, hi) }
        OptionalBoolRow("Winning record (>.500)", s.above500, yesLabel = "Above .500", noLabel = "Below .500") {
            changed(store) { snap -> snap.above500 = it }
        }
        OptionalBoolRow("Better record than opponent", s.winPctGtOpp, yesLabel = "Better record", noLabel = "Worse record") {
            changed(store) { snap -> snap.winPctGtOpp = it }
        }
        NumRangeRow(store, "PPG", s.ppg, d.ppg[0], d.ppg[1], 0.5) { snap, lo, hi -> snap.ppg = listOf(lo, hi) }
        NumRangeRow(store, "PA/G", s.paPg, d.paPg[0], d.paPg[1], 0.5) { snap, lo, hi -> snap.paPg = listOf(lo, hi) }
        NumRangeRow(store, "Point diff/game", s.pointDiffPg, d.pointDiffPg[0], d.pointDiffPg[1], 0.5) { snap, lo, hi ->
            snap.pointDiffPg = listOf(lo, hi)
        }
        LabeledIntSlider("Min games this season", s.minGames, 0, 10) { changed(store) { snap -> snap.minGames = it } }
    }

    SheetSection("Cover profile") {
        PctRangeRow(store, "ATS win %", s.atsWinPct) { snap, lo, hi -> snap.atsWinPct = listOf(lo, hi) }
        IntRangeRow(store, "ATS win streak", s.atsWinStreak, 0, 16, " games") { snap, lo, hi -> snap.atsWinStreak = listOf(lo, hi) }
        NumRangeRow(store, "Avg cover margin", s.avgCoverMargin, d.avgCoverMargin[0], d.avgCoverMargin[1], 0.5) { snap, lo, hi ->
            snap.avgCoverMargin = listOf(lo, hi)
        }
    }

    SheetSection("Total profile") {
        PctRangeRow(store, "Over %", s.overPct) { snap, lo, hi -> snap.overPct = listOf(lo, hi) }
        IntRangeRow(store, "Over streak", s.overStreak, 0, 16, " games") { snap, lo, hi -> snap.overStreak = listOf(lo, hi) }
        IntRangeRow(store, "Under streak", s.underStreak, 0, 16, " games") { snap, lo, hi -> snap.underStreak = listOf(lo, hi) }
    }

    SheetSection("Prior year") {
        IntRangeRow(store, "Last season wins", s.prevWins, d.prevWins[0], d.prevWins[1]) { snap, lo, hi ->
            snap.prevWins = listOf(lo, hi)
        }
        PctRangeRow(store, "Last season win %", s.prevWinPct) { snap, lo, hi -> snap.prevWinPct = listOf(lo, hi) }
        OptionalBoolRow("Made playoffs last year", s.madePlayoffsPrev, yesLabel = "Made playoffs", noLabel = "Missed playoffs") {
            changed(store) { snap -> snap.madePlayoffsPrev = it }
        }
        OptionalBoolRow(
            "More wins than opponent last year", s.moreWinsThanOppPrev,
            yesLabel = "More wins", noLabel = "Fewer wins",
        ) { changed(store) { snap -> snap.moreWinsThanOppPrev = it } }
    }
}

@Composable
private fun ColumnScope.MlbTeamFormSheet(store: HistoricalAnalysisStore) {
    val s = store.snapshot

    SheetSection("Season record") {
        PctRangeRow(store, "Win %", s.winPct) { snap, lo, hi -> snap.winPct = listOf(lo, hi) }
        IntRangeRow(store, "Win streak", s.winStreak, 0, 25, " games") { snap, lo, hi -> snap.winStreak = listOf(lo, hi) }
        IntRangeRow(store, "Loss streak", s.lossStreak, 0, 25, " games") { snap, lo, hi -> snap.lossStreak = listOf(lo, hi) }
        // Signed current streak (+ = winning, − = losing). Legacy String fields kept
        // for saved-filter back-compat; an empty string means "no bound".
        LabeledIntRangeSlider(
            "Current streak (+W / −L)",
            s.streakMin.trim().toIntOrNull() ?: -25,
            s.streakMax.trim().toIntOrNull() ?: 25,
            -25, 25, suffix = " games",
        ) { lo, hi ->
            changed(store) {
                it.streakMin = if (lo == -25) "" else lo.toString()
                it.streakMax = if (hi == 25) "" else hi.toString()
            }
        }
        NumRangeRow(store, "Runs per game", s.rpg, 0.0, 10.0, 0.1) { snap, lo, hi -> snap.rpg = listOf(lo, hi) }
        NumRangeRow(store, "Runs allowed per game", s.rapg, 0.0, 10.0, 0.1) { snap, lo, hi -> snap.rapg = listOf(lo, hi) }
        NumRangeRow(store, "Run diff/game", s.runDiffPg, -4.0, 4.0, 0.1) { snap, lo, hi -> snap.runDiffPg = listOf(lo, hi) }
        LabeledIntSlider("Min games this season", s.minGames, 0, 40) { changed(store) { snap -> snap.minGames = it } }
    }

    SheetSection("Run line profile") {
        PctRangeRow(store, "RL cover %", s.rlCoverPct) { snap, lo, hi -> snap.rlCoverPct = listOf(lo, hi) }
        IntRangeRow(store, "RL cover streak", s.rlStreak, 0, 25, " games") { snap, lo, hi -> snap.rlStreak = listOf(lo, hi) }
    }

    SheetSection("Total profile") {
        PctRangeRow(store, "Over %", s.overPct) { snap, lo, hi -> snap.overPct = listOf(lo, hi) }
        IntRangeRow(store, "Over streak", s.overStreak, 0, 25, " games") { snap, lo, hi -> snap.overStreak = listOf(lo, hi) }
        IntRangeRow(store, "Under streak", s.underStreak, 0, 25, " games") { snap, lo, hi -> snap.underStreak = listOf(lo, hi) }
    }

    SheetSection("Prior year") {
        IntRangeRow(store, "Last season wins", s.prevWins, 0, 120) { snap, lo, hi -> snap.prevWins = listOf(lo, hi) }
        PctRangeRow(store, "Last season win %", s.prevWinPct) { snap, lo, hi -> snap.prevWinPct = listOf(lo, hi) }
    }
}

// MARK: - Last game (the team's PREVIOUS game — shared fields across all sports)

@Composable
private fun ColumnScope.LastGameSheet(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    val isMlb = store.sport == HistoricalAnalysisSport.MLB
    val d = HistoricalAnalysisUISnapshot.defaults(store.sport)

    ChoiceRow("Result", listOf("any" to "Any", "won" to "Won", "lost" to "Lost"), s.lastResult) {
        changed(store) { snap -> snap.lastResult = it }
    }
    ChoiceRow(
        if (isMlb) "Run line" else "ATS",
        listOf("any" to "Any", "covered" to "Covered", "not" to "Didn't cover"),
        s.lastAts,
    ) { changed(store) { snap -> snap.lastAts = it } }
    ChoiceRow("Total", listOf("any" to "Any", "over" to "Over", "under" to "Under"), s.lastTotal) {
        changed(store) { snap -> snap.lastTotal = it }
    }
    ChoiceRow("Was", listOf("any" to "Any", "favorite" to "Favorite", "underdog" to "Underdog"), s.lastRole) {
        changed(store) { snap -> snap.lastRole = it }
    }
    // Signed margin slider for all three sports — the CFB `last_blowout` picker was
    // removed from the RPC and wrote a key the builder never emitted (a dead control).
    LabeledIntRangeSlider(
        "Last game margin", s.lastMargin[0], s.lastMargin[1], d.lastMargin[0], d.lastMargin[1],
        suffix = if (isMlb) " runs" else " pts",
        caption = "+ = won by, − = lost by",
    ) { lo, hi -> changed(store) { it.lastMargin = listOf(lo, hi) } }
    if (!isMlb) {
        OptionalBoolRow("Went to overtime", s.lastOt) { changed(store) { snap -> snap.lastOt = it } }
    }
}

// MARK: - Head-to-head (last meeting vs THIS opponent)

@Composable
private fun ColumnScope.HeadToHeadSheet(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    val isMlb = store.sport == HistoricalAnalysisSport.MLB
    val d = HistoricalAnalysisUISnapshot.defaults(store.sport)

    ChoiceRow("Won last meeting", listOf("any" to "Any", "yes" to "Won", "no" to "Lost"), s.h2hLastWin) {
        changed(store) { snap -> snap.h2hLastWin = it }
    }
    ChoiceRow(
        if (isMlb) "Covered RL last meeting" else "Covered last meeting",
        listOf("any" to "Any", "yes" to "Covered", "no" to "Didn't cover"),
        s.h2hLastAts,
    ) { changed(store) { snap -> snap.h2hLastAts = it } }
    ChoiceRow("Last meeting total", listOf("any" to "Any", "yes" to "Over", "no" to "Under"), s.h2hLastOver) {
        changed(store) { snap -> snap.h2hLastOver = it }
    }
    if (isMlb) {
        LabeledIntRangeSlider(
            "Last meeting margin", s.h2hLastMargin[0], s.h2hLastMargin[1], d.h2hLastMargin[0], d.h2hLastMargin[1],
            suffix = " runs",
        ) { lo, hi -> changed(store) { it.h2hLastMargin = listOf(lo, hi) } }
    }
    OptionalBoolRow("Was home last meeting", s.h2hLastHome, yesLabel = "Home", noLabel = "Away") {
        changed(store) { snap -> snap.h2hLastHome = it }
    }
    OptionalBoolRow("Was favorite last meeting", s.h2hLastFav, yesLabel = "Favorite", noLabel = "Underdog") {
        changed(store) { snap -> snap.h2hLastFav = it }
    }
    OptionalBoolRow("Same season as last meeting", s.h2hSameSeason, yesLabel = "Same season", noLabel = "Different season") {
        changed(store) { snap -> snap.h2hSameSeason = it }
    }
    if (!isMlb) {
        ChoiceRow(
            "Spread vs last meeting",
            listOf("any" to "Any", "lower" to "Lower (more favored)", "higher" to "Higher (less favored)"),
            s.h2hSpreadCmp,
        ) { changed(store) { snap -> snap.h2hSpreadCmp = it } }
    }
}

// MARK: - Opponent

@Composable
private fun ColumnScope.FootballOpponentSheet(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    val d = HistoricalAnalysisUISnapshot.defaults(store.sport)

    SheetSection("Opponent record") {
        PctRangeRow(store, "Opponent win %", s.oppWinPct) { snap, lo, hi -> snap.oppWinPct = listOf(lo, hi) }
        PctRangeRow(store, "Opponent over %", s.oppOverPct) { snap, lo, hi -> snap.oppOverPct = listOf(lo, hi) }
        IntRangeRow(store, "Opponent win streak", s.oppWinStreak, 0, 16, " games") { snap, lo, hi ->
            snap.oppWinStreak = listOf(lo, hi)
        }
        IntRangeRow(store, "Opponent loss streak", s.oppLossStreak, 0, 16, " games") { snap, lo, hi ->
            snap.oppLossStreak = listOf(lo, hi)
        }
        NumRangeRow(store, "Opponent PPG", s.oppPpg, d.oppPpg[0], d.oppPpg[1], 0.5) { snap, lo, hi -> snap.oppPpg = listOf(lo, hi) }
        NumRangeRow(store, "Opponent PA/G", s.oppPaPg, d.oppPaPg[0], d.oppPaPg[1], 0.5) { snap, lo, hi -> snap.oppPaPg = listOf(lo, hi) }
        PctRangeRow(store, "Opponent last-season win %", s.oppPrevWinPct) { snap, lo, hi -> snap.oppPrevWinPct = listOf(lo, hi) }
    }

    SheetSection("Opponent last game") {
        OpponentLastGameRows(store, isMlb = false)
        OptionalBoolRow("Opponent last game overtime", s.oppLastOt, yesLabel = "Overtime", noLabel = "Regulation") {
            changed(store) { snap -> snap.oppLastOt = it }
        }
        LabeledIntRangeSlider(
            "Opponent last game margin", s.oppLastMargin[0], s.oppLastMargin[1], d.oppLastMargin[0], d.oppLastMargin[1],
            suffix = " pts",
            caption = "+ = opponent won by, − = opponent lost by",
        ) { lo, hi -> changed(store) { it.oppLastMargin = listOf(lo, hi) } }
    }
}

@Composable
private fun ColumnScope.MlbOpponentSheet(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    val d = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB)

    SheetSection("Opponent record") {
        PctRangeRow(store, "Opponent win %", s.oppWinPct) { snap, lo, hi -> snap.oppWinPct = listOf(lo, hi) }
        PctRangeRow(store, "Opponent over %", s.oppOverPct) { snap, lo, hi -> snap.oppOverPct = listOf(lo, hi) }
        PctRangeRow(store, "Opponent RL cover %", s.oppRlCoverPct) { snap, lo, hi -> snap.oppRlCoverPct = listOf(lo, hi) }
        IntRangeRow(store, "Opponent win streak", s.oppWinStreak, 0, 25, " games") { snap, lo, hi ->
            snap.oppWinStreak = listOf(lo, hi)
        }
        IntRangeRow(store, "Opponent loss streak", s.oppLossStreak, 0, 25, " games") { snap, lo, hi ->
            snap.oppLossStreak = listOf(lo, hi)
        }
        NumRangeRow(store, "Opponent runs/game", s.oppRpg, 0.0, 10.0, 0.1) { snap, lo, hi -> snap.oppRpg = listOf(lo, hi) }
        NumRangeRow(store, "Opponent runs allowed/game", s.oppRapg, 0.0, 10.0, 0.1) { snap, lo, hi -> snap.oppRapg = listOf(lo, hi) }
        PctRangeRow(store, "Opponent last-season win %", s.oppPrevWinPct) { snap, lo, hi -> snap.oppPrevWinPct = listOf(lo, hi) }
    }

    SheetSection("Opponent last game") {
        OpponentLastGameRows(store, isMlb = true)
        LabeledIntRangeSlider(
            "Opponent last game margin", s.oppLastMargin[0], s.oppLastMargin[1], d.oppLastMargin[0], d.oppLastMargin[1],
            suffix = " runs",
        ) { lo, hi -> changed(store) { it.oppLastMargin = listOf(lo, hi) } }
    }
}

@Composable
private fun ColumnScope.OpponentLastGameRows(store: HistoricalAnalysisStore, isMlb: Boolean) {
    val s = store.snapshot
    ChoiceRow("Opponent last game result", listOf("any" to "Any", "won" to "Won", "lost" to "Lost"), s.oppLastResult) {
        changed(store) { snap -> snap.oppLastResult = it }
    }
    ChoiceRow(
        if (isMlb) "Opponent last game run line" else "Opponent last game ATS",
        listOf("any" to "Any", "covered" to "Covered", "not" to "Didn't cover"),
        s.oppLastAts,
    ) { changed(store) { snap -> snap.oppLastAts = it } }
    ChoiceRow("Opponent last game total", listOf("any" to "Any", "over" to "Over", "under" to "Under"), s.oppLastTotal) {
        changed(store) { snap -> snap.oppLastTotal = it }
    }
    ChoiceRow(
        "Opponent last game role",
        listOf("any" to "Any", "favorite" to "Favorite", "underdog" to "Underdog"),
        s.oppLastRole,
    ) { changed(store) { snap -> snap.oppLastRole = it } }
}

// MARK: - Pitching (MLB) / Coach & referee (NFL)

@Composable
private fun ColumnScope.PitchingSheet(store: HistoricalAnalysisStore) {
    val s = store.snapshot
    // Catalog loads on first open, not at bootstrap — most sessions never open this
    // sheet and the list is ~1,500 rows.
    LaunchedEffect(Unit) { store.loadPitcherCatalog() }

    MlbPitcherTypeahead(
        label = "Team starter (SP)",
        selected = s.sp,
        catalog = store.pitcherCatalog,
        isLoading = store.pitcherCatalogState.isLoading,
        loadFailed = store.pitcherCatalogState is LoadState.Failed,
    ) { next -> changed(store) { it.sp = next } }

    MlbPitcherTypeahead(
        label = "Opposing starter",
        selected = s.oppSp,
        catalog = store.pitcherCatalog,
        isLoading = store.pitcherCatalogState.isLoading,
        loadFailed = store.pitcherCatalogState is LoadState.Failed,
    ) { next -> changed(store) { it.oppSp = next } }

    SheetSection("Handedness") {
        ChoiceRow("SP hand", listOf("any" to "Any", "L" to "Left", "R" to "Right"), s.spHand) {
            changed(store) { snap -> snap.spHand = it }
        }
        ChoiceRow("Opp SP hand", listOf("any" to "Any", "L" to "Left", "R" to "Right"), s.oppSpHand) {
            changed(store) { snap -> snap.oppSpHand = it }
        }
    }

    SheetSection("Pitching quality") {
        LabeledRangeSlider("SP xFIP", s.spXfipMin, s.spXfipMax, 2.0, 7.0, 0.05) { lo, hi ->
            changed(store) { it.spXfipMin = lo; it.spXfipMax = hi }
        }
        LabeledRangeSlider("Opp SP xFIP", s.oppSpXfipMin, s.oppSpXfipMax, 2.0, 7.0, 0.05) { lo, hi ->
            changed(store) { it.oppSpXfipMin = lo; it.oppSpXfipMax = hi }
        }
        LabeledRangeSlider("SP ERA", s.spEraMin, s.spEraMax, 0.0, 10.0, 0.05) { lo, hi ->
            changed(store) { it.spEraMin = lo; it.spEraMax = hi }
        }
        LabeledRangeSlider("Opp SP ERA", s.oppSpEraMin, s.oppSpEraMax, 0.0, 10.0, 0.05) { lo, hi ->
            changed(store) { it.oppSpEraMin = lo; it.oppSpEraMax = hi }
        }
        LabeledRangeSlider("Opponent bullpen IP (last 3 days)", s.bpIpMin, s.bpIpMax, 0.0, 20.0, 0.5) { lo, hi ->
            changed(store) { it.bpIpMin = lo; it.bpIpMax = hi }
        }
        LabeledRangeSlider("Opponent bullpen xFIP", s.bpXfipMin, s.bpXfipMax, 2.0, 7.0, 0.05) { lo, hi ->
            changed(store) { it.bpXfipMin = lo; it.bpXfipMax = hi }
        }
    }
}

@Composable
private fun ColumnScope.CoachRefSheet(store: HistoricalAnalysisStore) {
    SearchableSingleSelectRow("Coach", "Any coach", store.coaches, store.snapshot.coach) {
        changed(store) { snap -> snap.coach = it }
    }
    SearchableSingleSelectRow("Referee", "Any referee", store.referees, store.snapshot.referee) {
        changed(store) { snap -> snap.referee = it }
    }
}

// MARK: - Range row helpers
//
// Percent ranges are 0–100 in the snapshot (the builder divides by 100); int and
// numeric ranges keep this sport's default bounds so an untouched slider stays
// equal to `defaults(sport)` and emits no RPC key.

@Composable
private fun PctRangeRow(
    store: HistoricalAnalysisStore,
    title: String,
    value: List<Double>,
    write: (HistoricalAnalysisUISnapshot, Double, Double) -> Unit,
) = LabeledRangeSlider(
    title, value[0], value[1], 0.0, 100.0, 1.0,
    suffix = "%",
    format = { it.toInt().toString() },
) { lo, hi -> changed(store) { write(it, lo, hi) } }

@Composable
private fun NumRangeRow(
    store: HistoricalAnalysisStore,
    title: String,
    value: List<Double>,
    min: Double,
    max: Double,
    step: Double,
    write: (HistoricalAnalysisUISnapshot, Double, Double) -> Unit,
) = LabeledRangeSlider(title, value[0], value[1], min, max, step) { lo, hi -> changed(store) { write(it, lo, hi) } }

@Composable
private fun IntRangeRow(
    store: HistoricalAnalysisStore,
    title: String,
    value: List<Int>,
    min: Int,
    max: Int,
    suffix: String = "",
    write: (HistoricalAnalysisUISnapshot, Int, Int) -> Unit,
) = LabeledIntRangeSlider(title, value[0], value[1], min, max, suffix) { lo, hi ->
    changed(store) { write(it, lo, hi) }
}

/**
 * `Int?` range where null = unset. Parking a thumb back on its natural bound
 * clears the field so the builder omits the RPC key again (iOS
 * `optionalIntRangeBinding`).
 */
@Composable
private fun OptionalIntRangeRow(
    title: String,
    lower: Int?,
    upper: Int?,
    min: Int,
    max: Int,
    suffix: String = "",
    caption: String? = null,
    onChange: (Int?, Int?) -> Unit,
) = LabeledIntRangeSlider(title, lower ?: min, upper ?: max, min, max, suffix, caption) { lo, hi ->
    onChange(lo.takeIf { it != min }, hi.takeIf { it != max })
}
