package com.wagerproof.core.stores

import java.time.LocalDate
import java.time.MonthDay
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Per-sport regular-season windows + season-aware empty-state copy, shared by
 * the Games and Props tabs. Port of iOS `SportSeason.swift`. Bookend dates are
 * approximate (regular-season start → championship) and use ET to match the
 * app's sports-date convention (`GamesStore.Sport.displayOrder`). Precise enough
 * to (a) dim a sport in the tab picker while it's out of season and (b) tell an
 * offseason user when to return vs. telling an in-season user an empty board is
 * just mid-refresh.
 */
object SportSeason {

    private val ET: ZoneId = ZoneId.of("America/New_York")
    // e.g. "September 4"
    private val startFormatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("MMMM d", Locale.US)

    /** Title + message pair for an empty "no games / no props" tile. */
    data class EmptyCopy(val title: String, val message: String)

    /**
     * Season start (month, day) and end (month, day). Windows that run past
     * Dec 31 (football/basketball) have a start month later than the end month.
     */
    fun window(sport: GamesStore.Sport): Pair<MonthDay, MonthDay> = when (sport) {
        GamesStore.Sport.nfl -> MonthDay.of(9, 4) to MonthDay.of(2, 15)
        GamesStore.Sport.cfb -> MonthDay.of(8, 23) to MonthDay.of(1, 20)
        GamesStore.Sport.nba -> MonthDay.of(10, 20) to MonthDay.of(6, 22)
        GamesStore.Sport.ncaab -> MonthDay.of(11, 1) to MonthDay.of(4, 8)
        GamesStore.Sport.mlb -> MonthDay.of(3, 26) to MonthDay.of(11, 5)
    }

    /** month*100+day so month/day pairs compare as plain ascending integers. */
    private fun ordinal(md: MonthDay): Int = md.monthValue * 100 + md.dayOfMonth

    private fun todayET(date: LocalDate?): LocalDate = date ?: LocalDate.now(ET)

    /**
     * True when `date` sits inside the sport's season window, handling windows
     * that wrap past Dec 31.
     */
    fun isInSeason(sport: GamesStore.Sport, date: LocalDate? = null): Boolean {
        val (start, end) = window(sport)
        val today = todayET(date)
        val todayOrd = today.monthValue * 100 + today.dayOfMonth
        val startOrd = ordinal(start)
        val endOrd = ordinal(end)
        // Same-year window (MLB) vs. one that wraps the new year.
        return if (startOrd <= endOrd) todayOrd in startOrd..endOrd
        else todayOrd >= startOrd || todayOrd <= endOrd
    }

    /** The next calendar date the season starts, relative to `date`. */
    fun nextSeasonStart(sport: GamesStore.Sport, date: LocalDate? = null): LocalDate {
        val (start, _) = window(sport)
        val today = todayET(date)
        // Match Swift's nextDate(after:matching:.nextTime): strictly after today.
        var candidate = start.atYear(today.year)
        if (!candidate.isAfter(today)) candidate = start.atYear(today.year + 1)
        return candidate
    }

    /**
     * Title + message for an empty "no games / no props" tile, chosen by
     * in-season vs. offseason. `itemsNoun`/`dataNoun` let the Props tab say
     * "player props" / "prop data" where the Games tab says "games" / "game data".
     */
    fun emptyCopy(
        sport: GamesStore.Sport,
        itemsNoun: String = "games",
        dataNoun: String = "game data",
        date: LocalDate? = null,
    ): EmptyCopy {
        val today = todayET(date)
        if (isInSeason(sport, today) || isOpeningLeadIn(sport, today)) {
            return EmptyCopy(
                title = "Refreshing ${sport.label} analysis",
                message = "We're refreshing analysis for today's $itemsNoun. Check back tomorrow for updated $dataNoun.",
            )
        }
        val title = "${sport.label} is out of season"
        val start = nextSeasonStart(sport, today)
        return EmptyCopy(
            title = title,
            message = "The season begins ${startFormatter.format(start)}. Check back closer to the start date.",
        )
    }

    /**
     * College tips off November 1. The nine days before that, and the first
     * week of games, stay on a 10-day board so Friday still shows Sunday.
     * After November 8 the board is today and tomorrow, same as NBA.
     */
    fun ncaabBoardDays(date: LocalDate = LocalDate.now(ET)): Int {
        val openingYear = if (date.monthValue <= 4) date.year - 1 else date.year
        val opening = LocalDate.of(openingYear, 11, 1)
        val leadStart = opening.minusDays(9)
        val tailEnd = opening.plusDays(7)
        return if (!date.isBefore(leadStart) && !date.isAfter(tailEnd)) 10 else 2
    }

    /** Inclusive Eastern dates for the college board. */
    fun ncaabBoardSpan(date: LocalDate = LocalDate.now(ET)): Pair<String, String> {
        val end = date.plusDays((ncaabBoardDays(date) - 1).toLong())
        return date.toString() to end.toString()
    }

    /** Games are already posted the week before tip. That is not the offseason. */
    private fun isOpeningLeadIn(sport: GamesStore.Sport, date: LocalDate): Boolean {
        if (sport != GamesStore.Sport.ncaab) return false
        val start = nextSeasonStart(sport, date)
        val days = java.time.temporal.ChronoUnit.DAYS.between(date, start)
        return days in 1..9
    }
}
