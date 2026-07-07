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
        GamesStore.Sport.nba -> MonthDay.of(10, 21) to MonthDay.of(6, 22)
        GamesStore.Sport.ncaab -> MonthDay.of(11, 3) to MonthDay.of(4, 8)
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
        if (isInSeason(sport, today)) {
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
}
