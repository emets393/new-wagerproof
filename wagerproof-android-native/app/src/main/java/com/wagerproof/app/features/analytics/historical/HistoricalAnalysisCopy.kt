package com.wagerproof.app.features.analytics.historical

import androidx.compose.ui.graphics.Color
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.HistoricalAnalysisBetType
import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisResponse
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.HistoricalAnalysisUpcomingGame
import com.wagerproof.core.stores.HistoricalAnalysisStore
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

    fun year(value: Int) = value.toString()
    fun yearRange(min: Int, max: Int) = "$min–$max"
    fun signedPct(value: Double) = (if (value > 0) "+" else "") + trimmed(value) + "%"

    /**
     * Green above water / red below, neutral exactly at 50 (iOS `hitPctColor`).
     * [neutral] is a parameter because the share cards print on fixed dark
     * cardstock and can't use the theme's text token.
     */
    fun hitPctColor(hitPct: Double, neutral: Color = AppColors.appTextPrimary): Color = when {
        hitPct > 50 -> AppColors.appWin
        hitPct < 50 -> AppColors.appLoss
        else -> neutral
    }

    fun verb(betType: String) = when (betType) {
        "fg_spread" -> "covered"
        "h1_spread" -> "covered the 1H spread"
        "fg_ml" -> "won"
        "h1_ml" -> "won in the 1H"
        "fg_total" -> "went over"
        "h1_total" -> "went over the 1H total"
        "team_total" -> "went over their team total"
        "ml" -> "won"
        "rl" -> "covered the run line"
        "total" -> "went over"
        "f5_ml" -> "won the F5"
        "f5_rl" -> "covered the F5 run line"
        "f5_total" -> "went over the F5 total"
        else -> "hit"
    }

    fun outcomeLabel(betType: String) = when (betType) {
        "fg_spread", "h1_spread", "rl", "f5_rl" -> "Cover"
        "fg_ml", "h1_ml", "ml", "f5_ml" -> "Win"
        "fg_total", "h1_total", "team_total", "total", "f5_total" -> "Over"
        else -> "Hit"
    }

    /**
     * Markets that ask an over/under question — the hero must headline the
     * WINNING side ("went under 58.7%"), never bury it behind a losing over%.
     * Pair with [underVerb] when the under slice out-hits the over slice.
     */
    val overUnderMarkets = setOf("fg_total", "h1_total", "team_total", "total", "f5_total")

    fun underVerb(betType: String) = when (betType) {
        "h1_total" -> "went under the 1H total"
        "team_total" -> "stayed under their team total"
        "f5_total" -> "went under the F5 total"
        else -> "went under"
    }

    /** Markets whose result is a game-level over/under — Side / fav-dog don't describe them. */
    val gameTotalMarkets = setOf("fg_total", "h1_total", "total", "f5_total")

    /** Markets where the fav/dog bar is the directional split (mirrors iOS `directionalBarSide`). */
    val favDogMarkets =
        HistoricalAnalysisBetType.moneylineMarkets + setOf("team_total", "ml", "f5_ml", "rl", "f5_rl")

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

    /** Tone of a filter-chat result banner; the view maps it to icon + color. */
    enum class NLResultTone { Success, Warning, Neutral }

    data class NLResult(val tone: NLResultTone, val text: String)

    /**
     * One chat turn → one banner line. Port of iOS `presentToast(for:)`.
     *
     * Partial success is the common case and must READ as partial: the model
     * routinely lands three of four clauses, and reporting only "Updated 3
     * filters" hides that the fourth was silently dropped.
     */
    fun nlResultMessage(response: HistoricalAnalysisStore.NLFilterResponse): NLResult {
        response.error?.let { return NLResult(NLResultTone.Warning, it) }
        if (response.noChange) return NLResult(NLResultTone.Success, "Filters already match that")
        if (response.applied.isNotEmpty()) {
            val skipped = response.couldntMap.size + response.ambiguous.size + response.rejected.size
            val plural = if (response.applied.size == 1) "" else "s"
            val suffix = if (skipped > 0) " · $skipped skipped" else ""
            return NLResult(NLResultTone.Success, "Updated ${response.applied.size} filter$plural$suffix")
        }
        if (response.hasChanges) {
            return NLResult(NLResultTone.Warning, "Couldn't map that — try rephrasing")
        }
        return NLResult(NLResultTone.Neutral, "I didn't catch a filter in that")
    }

    /**
     * Canned chips above the filter-chat input, shown until the user has a
     * history of their own. They double as a spec of what the model accepts, so
     * each one exercises a different dimension family (iOS `nlExampleQueries`).
     */
    fun nlExampleQueries(sport: HistoricalAnalysisSport): List<String> = when (sport) {
        HistoricalAnalysisSport.MLB -> listOf(
            "Home favorites on Fridays",
            "Division games under 8.5",
            "Teams off a loss vs lefties",
            "Day games in summer",
            "2024 season only",
        )
        HistoricalAnalysisSport.NFL, HistoricalAnalysisSport.CFB -> listOf(
            "Teams on 3+ game win streak",
            "Home underdogs in primetime",
            "Road favorites off a loss",
            "Divisional games in December",
            "Teams with winning record",
        )
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
            snapshot.betType in favDogMarkets && snapshot.favDog != "any" -> snapshot.favDog
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

    /** What the hero headlines: the metric slice plus the verb/label/baseline that describe it. */
    data class HeroSlice(
        val metrics: HeadlineMetrics,
        val verb: String,
        val outcome: String,
        val baseline: Double,
    )

    /**
     * Over/under markets headline whichever side actually hit more. "Games went
     * over 41.3%" buries the story when the under hit 58.7%, so when the under
     * wins we flip the metrics, the verb, the gauge label AND the baseline (the
     * league's over rate becomes its under rate). iOS `HistoricalAnalysisView.heroSlice`.
     */
    fun heroSlice(snapshot: HistoricalAnalysisUISnapshot, data: HistoricalAnalysisResponse): HeroSlice {
        val metrics = headlineMetrics(snapshot, data)
        val default = HeroSlice(metrics, verb(snapshot.betType), outcomeLabel(snapshot.betType), data.baselinePct)
        if (snapshot.betType !in overUnderMarkets) return default
        val options = data.bars.firstOrNull { it.dimension == "over_under" }?.options ?: return default
        val over = options.firstOrNull { it.side == "over" } ?: return default
        val under = options.firstOrNull { it.side == "under" } ?: return default
        if (under.hitPct <= over.hitPct) return default
        return HeroSlice(
            metrics = HeadlineMetrics(under.n, under.wins, under.hitPct, under.roi),
            verb = underVerb(snapshot.betType),
            outcome = "Under",
            baseline = 100 - data.baselinePct,
        )
    }

    fun headlineSubject(sport: HistoricalAnalysisSport, snapshot: HistoricalAnalysisUISnapshot): String {
        // Game totals are game outcomes ("went over") — never "Favorites went over".
        if (snapshot.betType in gameTotalMarkets) {
            if (sport == HistoricalAnalysisSport.MLB && snapshot.teams.isNotEmpty()) {
                return "${snapshot.teams.joinToString(", ")} games"
            }
            if (snapshot.side != "any") return if (snapshot.side == "home") "Home games" else "Road games"
            return "Games"
        }
        val parts = buildList {
            if (snapshot.side != "any") add(if (snapshot.side == "home") "Home" else "Road")
            val direction = when {
                snapshot.betType in setOf("fg_spread", "h1_spread") -> snapshot.spreadSide
                snapshot.betType in favDogMarkets -> snapshot.favDog
                else -> "any"
            }
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
        if (sport == HistoricalAnalysisSport.MLB && snapshot.teams.isNotEmpty()) {
            return snapshot.teams.joinToString(", ") + if (situation.isEmpty()) "" else " (${situation.lowercase()})"
        }
        if (situation.isNotEmpty()) return situation.replaceFirstChar(Char::uppercase)
        return "Teams"
    }

    fun scopeNote(sport: HistoricalAnalysisSport, snapshot: HistoricalAnalysisUISnapshot): String {
        if (sport == HistoricalAnalysisSport.NFL) {
            val bits = buildList {
                if (snapshot.coach != "any") add("${snapshot.coach}-coached teams")
                if (snapshot.referee != "any") add("games officiated by ${snapshot.referee}")
            }
            return "${bits.ifEmpty { listOf("all teams") }.joinToString(" · ")} in every past game that matches your filters."
        }
        // MLB has no conferences — without this branch a baseball screen read
        // "All FBS teams…" (iOS HistoricalAnalysisCopy.swift:1654-1659).
        if (sport == HistoricalAnalysisSport.MLB) {
            if (snapshot.teams.isNotEmpty()) {
                return "${snapshot.teams.joinToString(", ")} in every past game that matches your filters."
            }
            return "All MLB teams in every past game that matches your filters."
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
        val isML = betType in HistoricalAnalysisBetType.moneylineMarkets || betType == "ml" || betType == "f5_ml"
        val verb = if (isML) "won" else "covered"
        return when (side) {
            "home" -> "Home $verb"
            "away" -> "Away $verb"
            "favorite" -> "Favorites $verb"
            "underdog" -> "Underdogs $verb"
            else -> side.replaceFirstChar(Char::uppercase)
        }
    }

    /** MLB `mlb_analysis_upcoming` returns a null `is_favorite` on pick'em / missing odds. */
    private fun favLabel(isFavorite: Boolean?, yes: String, no: String, unknown: String): String =
        when (isFavorite) {
            true -> yes
            false -> no
            null -> unknown
        }

    fun lineForBet(betType: String, game: HistoricalAnalysisUpcomingGame): String = when (betType) {
        "fg_spread" -> game.teamSpread?.let { "${game.team} ${if (it > 0) "+" else ""}${trimmed(it)}" }.orEmpty()
        "fg_ml" -> "${game.team} ML (${favLabel(game.isFavorite, "favorite", "underdog", "even")})"
        "fg_total" -> "Total O/U ${game.total?.let(::trimmed) ?: "—"}"
        "team_total" -> "${game.team} team total ${game.ttLine?.let(::trimmed) ?: "—"}"
        "h1_spread" -> game.h1Spread?.let { "${game.team} 1H ${if (it > 0) "+" else ""}${trimmed(it)}" }.orEmpty()
        "h1_ml" -> "${game.team} 1H ML (${favLabel(game.isFavorite, "favorite", "underdog", "even")})"
        "h1_total" -> "1H Total O/U ${game.h1Total?.let(::trimmed) ?: "—"}"
        // MLB markets (iOS HistoricalAnalysisCopy.swift:220-246). Without these
        // every upcoming row on MLB — whose default bet type is "ml" — printed
        // a blank line where the side and number belong.
        "ml" -> "${game.team} ML (${favLabel(game.isFavorite, "fav", "dog", "even")})"
        "rl" -> "${game.team} RL${favLabel(game.isFavorite, " −1.5", " +1.5", "")}"
        "total" -> "Total O/U ${game.total?.let(::trimmed) ?: "—"}"
        "f5_ml" -> "${game.team} F5 ML"
        "f5_rl" -> "${game.team} F5 RL${favLabel(game.isFavorite, " −0.5", " +0.5", "")}"
        "f5_total" -> "F5 Total O/U ${game.f5Total?.let(::trimmed) ?: "—"}"
        else -> ""
    }

    /**
     * Kickoff line for an upcoming row. MLB rows carry `game_date` + `time_et`
     * and a null `kickoff`, so the football-only formatter left the time blank.
     * iOS `HistoricalAnalysisView.upcomingTimeLabel`.
     */
    fun upcomingTimeLabel(game: HistoricalAnalysisUpcomingGame): String {
        val kickoff = game.kickoff
        if (!kickoff.isNullOrEmpty()) return fmtKickoff(kickoff)
        return listOfNotNull(
            game.gameDate?.takeIf { it.isNotEmpty() },
            game.timeEt?.takeIf { it.isNotEmpty() }?.let { "$it ET" },
        ).joinToString(" · ")
    }

    /** MLB-only context for an upcoming row. iOS `mlbUpcomingChips`. */
    fun mlbUpcomingChips(game: HistoricalAnalysisUpcomingGame): List<String> = buildList {
        game.seriesGame?.let { add("Series G${if (it >= 4) "4+" else "$it"}") }
        game.tripSeriesIndex?.let {
            add(
                when {
                    it >= 3 -> "3rd+ series of trip"
                    it == 2 -> "2nd series of trip"
                    else -> "1st series of trip"
                },
            )
        }
        if (game.isSwitchGame == true) add("Switch")
        game.oppSpHand?.takeIf { it.isNotEmpty() }?.let { add("vs ${it}HP") }
        game.oppSpName?.takeIf { it.isNotEmpty() }?.let { add(it) }
        if (game.isDoubleheader == true) add("DH")
    }

    // MARK: - Narrative sentence (share infographic, saved-system cards)

    /**
     * Read-only plain-English labels for a saved system's filter snapshot
     * (leaderboard cards, share posters). Same strings as the Trends chip row —
     * built from the one canonical chip builder so a saved system can never
     * describe itself differently from the screen that produced it.
     */
    fun filterChipLabels(
        sport: HistoricalAnalysisSport,
        snapshot: HistoricalAnalysisUISnapshot,
    ): List<String> = HistoricalAnalysisActiveChips.build(
        sport = sport,
        snapshot = snapshot,
        seasonFloor = HistoricalAnalysisFilterBuilder.seasonFloor(snapshot.betType, sport),
    ).map { it.label }

    /**
     * "When"-style clauses built from the active filters, composed into
     * "When {a}, {b}, and {c}, {subject} {verb} X% of the time."
     */
    fun narrativeClauses(
        sport: HistoricalAnalysisSport,
        snapshot: HistoricalAnalysisUISnapshot,
    ): List<String> = HistoricalAnalysisNarrative.clauses(sport, snapshot)

    /** Oxford-comma join: ["a","b","c"] → "a, b, and c". */
    fun joinedClauses(clauses: List<String>): String = when (clauses.size) {
        0 -> ""
        1 -> clauses[0]
        2 -> "${clauses[0]} and ${clauses[1]}"
        else -> clauses.dropLast(1).joinToString(", ") + ", and " + clauses.last()
    }

    /**
     * Lowercase generic subjects mid-sentence; keep proper nouns intact
     * ("Home games" → "home games", "Boston Red Sox" stays capitalized). Only
     * the FIRST word is matched, which is why "Home games"/"Road games" need no
     * entries of their own.
     */
    fun midSentenceSubject(subject: String): String {
        val generic = setOf("Home", "Road", "Favorites", "Underdogs", "Teams", "Games")
        val first = subject.split(' ').firstOrNull() ?: return subject
        if (first !in generic) return subject
        return subject.replaceFirstChar(Char::lowercase)
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
