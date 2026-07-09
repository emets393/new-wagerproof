package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.HistoricalAnalysisBetType
import com.wagerproof.core.models.HistoricalAnalysisResponse
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.HistoricalAnalysisUpcomingGame
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs

internal object HistoricalAnalysisCopy {
    val dimensionLabels = mapOf(
        "over_under" to "Over / Under",
        "home_away" to "Home vs Away",
        "fav_dog" to "Favorite vs Underdog",
    )

    fun trimmed(value: Double): String = if (value == value.toLong().toDouble()) {
        value.toLong().toString()
    } else String.format(Locale.US, "%.1f", value).trimEnd('0').trimEnd('.')

    fun yearRange(min: Int, max: Int) = "$min–$max"
    fun signedPct(value: Double) = (if (value > 0) "+" else "") + trimmed(value) + "%"

    fun verb(betType: String) = when (betType) {
        "fg_spread" -> "covered"
        "h1_spread" -> "covered the 1H spread"
        "fg_ml" -> "won"
        "h1_ml" -> "won in the 1H"
        "fg_total" -> "went over"
        "h1_total" -> "went over the 1H total"
        "team_total" -> "went over their team total"
        else -> "hit"
    }

    fun outcomeLabel(betType: String) = when (betType) {
        "fg_spread", "h1_spread" -> "Cover"
        "fg_ml", "h1_ml" -> "Win"
        "fg_total", "h1_total", "team_total" -> "Over"
        else -> "Hit"
    }

    fun noun(snapshot: HistoricalAnalysisUISnapshot) = when {
        snapshot.betType == "team_total" -> "team totals"
        activeConferences(snapshot).isNotEmpty() && snapshot.betType in setOf("fg_spread", "h1_spread") -> "spreads"
        else -> "games"
    }

    fun significance(n: Int, hit: Double): Pair<String, Boolean> {
        val deviation = abs(hit - 50)
        return when {
            n < 20 -> "Thin sample" to false
            n >= 60 && deviation >= 5 -> "Strong" to true
            n >= 30 && deviation >= 3 -> "Solid" to true
            else -> "Neutral" to false
        }
    }

    fun activeConferences(snapshot: HistoricalAnalysisUISnapshot): List<String> =
        snapshot.selectedConferences.ifEmpty {
            if (snapshot.conference != "any") listOf(snapshot.conference) else emptyList()
        }

    fun conferencePillLabel(conferences: List<String>) = when (conferences.size) {
        0 -> "Conference"
        1 -> conferences[0]
        2 -> conferences.joinToString(", ")
        else -> "${conferences[0]} +${conferences.size - 1}"
    }

    data class HeadlineMetrics(val n: Int, val wins: Int, val hitPct: Double, val roi: Double?)

    fun headlineMetrics(snapshot: HistoricalAnalysisUISnapshot, data: HistoricalAnalysisResponse): HeadlineMetrics {
        if (activeConferences(snapshot).isNotEmpty()) return data.overall.toHeadline()
        val directional = when {
            snapshot.betType in setOf("fg_spread", "h1_spread") && snapshot.spreadSide != "any" -> snapshot.spreadSide
            (snapshot.betType in HistoricalAnalysisBetType.moneylineMarkets || snapshot.betType == "team_total") && snapshot.favDog != "any" -> snapshot.favDog
            else -> null
        }
        directional?.let { side ->
            data.bars.firstOrNull { it.dimension == "fav_dog" }?.options
                ?.firstOrNull { it.side == side }?.let { return HeadlineMetrics(it.n, it.wins, it.hitPct, it.roi) }
        }
        if (snapshot.side != "any") {
            data.bars.firstOrNull { it.dimension == "home_away" }?.options
                ?.firstOrNull { it.side == snapshot.side }?.let { return HeadlineMetrics(it.n, it.wins, it.hitPct, it.roi) }
        }
        return data.overall.toHeadline()
    }

    private fun com.wagerproof.core.models.HistoricalAnalysisOverall.toHeadline() =
        HeadlineMetrics(n, wins, hitPct, roi)

    fun headlineSubject(sport: HistoricalAnalysisSport, snapshot: HistoricalAnalysisUISnapshot): String {
        val parts = buildList {
            if (snapshot.side != "any") add(if (snapshot.side == "home") "Home" else "Road")
            val direction = if (snapshot.betType in setOf("fg_spread", "h1_spread")) snapshot.spreadSide else snapshot.favDog
            if (direction != "any") add(if (direction == "favorite") "favorites" else "underdogs")
        }
        val situation = parts.joinToString(" ")
        if (sport == HistoricalAnalysisSport.NFL && snapshot.coach != "any") {
            return "${snapshot.coach}'s teams" + if (situation.isEmpty()) "" else " (${situation.lowercase()})"
        }
        val conferences = activeConferences(snapshot)
        if (sport == HistoricalAnalysisSport.CFB && conferences.isNotEmpty()) {
            return conferences.joinToString(", ") + " schools" + if (situation.isEmpty()) "" else " (${situation.lowercase()})"
        }
        if (situation.isNotEmpty()) return situation.replaceFirstChar(Char::uppercase)
        return if (snapshot.betType in setOf("fg_total", "h1_total")) "Games" else "Teams"
    }

    fun scopeNote(sport: HistoricalAnalysisSport, snapshot: HistoricalAnalysisUISnapshot): String {
        if (sport == HistoricalAnalysisSport.NFL) {
            val bits = buildList {
                if (snapshot.coach != "any") add("${snapshot.coach}-coached teams")
                if (snapshot.referee != "any") add("games officiated by ${snapshot.referee}")
            }
            return "${bits.ifEmpty { listOf("all teams") }.joinToString(" · ")} in every past game that matches your filters."
        }
        val conferences = activeConferences(snapshot)
        if (conferences.isEmpty()) return "All FBS teams in every past game that matches your filters."
        val names = conferences.joinToString(", ")
        return when (snapshot.conferenceGame) {
            true -> "$names conference games only — matchups between schools in that conference."
            false -> "$names schools in non-conference games only."
            null -> if (conferences.size == 1) {
                "Every game a $names school played — non-conference, bowls, and more. Not $names-only matchups."
            } else "Every game involving a $names school — non-conference, bowls, and more."
        }
    }

    fun sideLabel(betType: String, side: String): String {
        if (side == "over") return "Over"
        if (side == "under") return "Under"
        val verb = if (betType in HistoricalAnalysisBetType.moneylineMarkets) "won" else "covered"
        return when (side) {
            "home" -> "Home $verb"
            "away" -> "Away $verb"
            "favorite" -> "Favorites $verb"
            "underdog" -> "Underdogs $verb"
            else -> side.replaceFirstChar(Char::uppercase)
        }
    }

    fun lineForBet(betType: String, game: HistoricalAnalysisUpcomingGame): String = when (betType) {
        "fg_spread" -> game.teamSpread?.let { "${game.team} ${if (it > 0) "+" else ""}${trimmed(it)}" }.orEmpty()
        "fg_ml" -> "${game.team} ML (${if (game.isFavorite) "favorite" else "underdog"})"
        "fg_total" -> "Total O/U ${game.total?.let(::trimmed) ?: "—"}"
        "team_total" -> "${game.team} team total ${game.ttLine?.let(::trimmed) ?: "—"}"
        "h1_spread" -> game.h1Spread?.let { "${game.team} 1H ${if (it > 0) "+" else ""}${trimmed(it)}" }.orEmpty()
        "h1_ml" -> "${game.team} 1H ML (${if (game.isFavorite) "favorite" else "underdog"})"
        "h1_total" -> "1H Total O/U ${game.h1Total?.let(::trimmed) ?: "—"}"
        else -> ""
    }

    fun fmtKickoff(raw: String): String {
        val instant = runCatching { OffsetDateTime.parse(raw).toInstant() }.getOrNull()
            ?: runCatching { Instant.parse(raw) }.getOrNull()
            ?: return ""
        return DateTimeFormatter.ofPattern("EEE, MMM d, h:mm a", Locale.US)
            .withZone(ZoneId.of("America/New_York"))
            .format(instant) + " ET"
    }
}
