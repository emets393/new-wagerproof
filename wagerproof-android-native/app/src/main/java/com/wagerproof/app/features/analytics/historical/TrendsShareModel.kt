package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.HistoricalAnalysisBreakdownRow
import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisResponse
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import kotlin.math.roundToInt

/**
 * Headline computations for the Historical Trends share cards — port of iOS
 * `TrendsShareContext` (HistoricalTrendsShareView.swift). Pure: no Compose, no
 * Android, so the sentence a user shares is unit-testable.
 *
 * The narrative sentence is a public claim about what was filtered, so the two
 * failure modes that matter are a PHANTOM clause (a filter the user never set)
 * and a MISSING clause (the filter that actually produced the number). Clause
 * generation itself lives in [HistoricalAnalysisNarrative]; this type only adds
 * the clauses that the FOCUS displaces out of the subject.
 */

/**
 * What the card's headline metric describes: the blended overall number, one
 * side of a split (home/away, fav/dog, over/under), or a single team from the
 * by-team breakdown.
 */
internal sealed interface InfographicFocus {
    data object Overall : InfographicFocus
    data class Side(val side: String) : InfographicFocus
    data class Team(val team: String) : InfographicFocus
}

/** Swipeable share-card designs. Same data + focus, five very different looks. */
internal enum class TrendsShareStyle(val displayName: String) {
    /** The full narrative infographic (splits + top-5 lists). */
    REPORT("Full Report"),

    /** Big-number social poster — one stat, loud. */
    POSTER("Poster"),

    /** Ring gauge — hit rate as a donut arc with a baseline tick. */
    GAUGE("Gauge"),

    /** Bar-graph card — situation splits + top teams as chunky bars. */
    CHART("Chart"),

    /** Betting-slip receipt — filters printed like line items. */
    RECEIPT("Receipt"),
}

internal data class TrendsShareContext(
    val sport: HistoricalAnalysisSport,
    val snapshot: HistoricalAnalysisUISnapshot,
    val analysis: HistoricalAnalysisResponse,
    val focus: InfographicFocus = InfographicFocus.Overall,
) {
    val metrics: HistoricalAnalysisCopy.HeadlineMetrics
        get() = when (focus) {
            is InfographicFocus.Overall -> HistoricalAnalysisCopy.headlineMetrics(snapshot, analysis)
            is InfographicFocus.Side -> analysis.bars
                .firstNotNullOfOrNull { bar -> bar.options.firstOrNull { it.side == focus.side } }
                ?.let { HistoricalAnalysisCopy.HeadlineMetrics(it.n, it.wins, it.hitPct, it.roi) }
                ?: HistoricalAnalysisCopy.headlineMetrics(snapshot, analysis)
            is InfographicFocus.Team -> analysis.byTeam.firstOrNull { it.team == focus.team }
                // Breakdown rows don't carry wins — derive from the rate.
                ?.let {
                    HistoricalAnalysisCopy.HeadlineMetrics(
                        it.n,
                        (it.hitPct / 100 * it.n).roundToInt(),
                        it.hitPct,
                        it.roi,
                    )
                }
                ?: HistoricalAnalysisCopy.headlineMetrics(snapshot, analysis)
        }

    /** "{subject} {verb}" — the payoff half of every card's sentence. */
    val subjectVerb: Pair<String, String>
        get() {
            val betType = snapshot.betType
            val verb = HistoricalAnalysisCopy.verb(betType)
            return when (focus) {
                is InfographicFocus.Overall ->
                    HistoricalAnalysisCopy.midSentenceSubject(
                        HistoricalAnalysisCopy.headlineSubject(sport, snapshot),
                    ) to verb
                is InfographicFocus.Side -> when (focus.side) {
                    "home" -> "home teams" to verb
                    "away" -> "road teams" to verb
                    "favorite" -> "favorites" to verb
                    "underdog" -> "underdogs" to verb
                    "over", "under" -> {
                        val market = if (betType == "h1_total") "1H " else ""
                        val suffix = if (betType == "team_total") " on team totals" else ""
                        "the $market${focus.side}$suffix" to "hit"
                    }
                    else -> focus.side to verb
                }
                // Game totals are game outcomes, so a focused team reads as "KC games
                // went over" — same rule the on-page headline subject uses.
                is InfographicFocus.Team ->
                    if (betType in HistoricalAnalysisCopy.gameTotalMarkets) "${focus.team} games" to verb
                    else focus.team to verb
            }
        }

    /**
     * Filter clauses for the "When {a}, {b}, and {c}…" prefix. A focus overrides
     * the subject, so any directional filter that [HistoricalAnalysisCopy.headlineSubject]
     * would have absorbed into that subject has to come back as a clause —
     * otherwise sharing "the under hit 58%" silently drops the "home favorites"
     * half of the search.
     */
    val clauses: List<String>
        get() {
            val base = HistoricalAnalysisCopy.narrativeClauses(sport, snapshot)
            if (focus is InfographicFocus.Overall) return base
            val extra = mutableListOf<String>()
            if (snapshot.side == "home" && focus != InfographicFocus.Side("home")) extra += "playing at home"
            if (snapshot.side == "away" && focus != InfographicFocus.Side("away")) extra += "playing on the road"
            // Same resolution as headlineSubject: spread markets carry the direction
            // on spreadSide, everything two-sided carries it on favDog.
            val direction = when {
                snapshot.betType in setOf("fg_spread", "h1_spread") -> snapshot.spreadSide
                snapshot.betType in HistoricalAnalysisCopy.favDogMarkets -> snapshot.favDog
                else -> "any"
            }
            if (direction == "favorite" && focus != InfographicFocus.Side("favorite")) extra += "as favorites"
            if (direction == "underdog" && focus != InfographicFocus.Side("underdog")) extra += "as underdogs"
            return base + extra
        }

    /** Active-filter labels — the same strings as the on-page chips. */
    val filterLabels: List<String>
        get() = HistoricalAnalysisCopy.filterChipLabels(sport, snapshot)

    /** "When {clauses}, {subject} {verb} X% of the time." — the shared sentence. */
    fun narrativeSentence(): String {
        val (subject, verb) = subjectVerb
        val pct = HistoricalAnalysisCopy.trimmed(metrics.hitPct)
        return "${narrativePrefix()}$subject $verb $pct% of the time."
    }

    /** "When a, b, and c, " — or the full-history opener when nothing is filtered. */
    fun narrativePrefix(): String {
        val active = clauses
        if (active.isEmpty()) {
            return "Across every game since ${HistoricalAnalysisCopy.year(analysis.coverage.seasonMin)}, "
        }
        return "When ${HistoricalAnalysisCopy.joinedClauses(active)}, "
    }

    /**
     * Condensed situation line for the poster/gauge cards, which have room for
     * three clauses before the type collapses.
     */
    fun situationLine(capitalized: Boolean): String {
        val active = clauses
        if (active.isEmpty()) {
            val opener = if (capitalized) "Every" else "every"
            return "$opener game since ${HistoricalAnalysisCopy.year(analysis.coverage.seasonMin)}"
        }
        val shown = active.take(3)
        val opener = if (capitalized) "When" else "when"
        var text = "$opener ${HistoricalAnalysisCopy.joinedClauses(shown)}"
        if (active.size > 3) text += " (+${active.size - 3} more)"
        return text
    }

    /** Sides offered by the focus picker — whatever the non-degenerate splits contain. */
    fun sideChoices(): List<String> =
        HistoricalAnalysisFilterBuilder
            .shownBars(analysis.bars, snapshot)
            .flatMap { it.options }
            .map { it.side }
            .distinct()

    /** Teams offered by the focus picker, biggest sample first. */
    fun teamChoices(): List<String> =
        analysis.byTeam.filter { it.n >= 3 }.sortedByDescending { it.n }.mapNotNull { it.team }

    companion object {
        /**
         * Best hit rates with a minimum sample, so a 1-game 100% never headlines a
         * "top" list (iOS `qualifyingSorted`).
         */
        fun qualifyingSorted(rows: List<HistoricalAnalysisBreakdownRow>): List<HistoricalAnalysisBreakdownRow> =
            rows.filter { it.n >= 5 && it.label != "—" }
                .sortedWith(compareByDescending<HistoricalAnalysisBreakdownRow> { it.hitPct }.thenByDescending { it.n })

        fun focusSideLabel(side: String): String = when (side) {
            "home" -> "Home teams"
            "away" -> "Away teams"
            "favorite" -> "Favorites"
            "underdog" -> "Underdogs"
            "over" -> "The over"
            "under" -> "The under"
            else -> side.replaceFirstChar(Char::uppercase)
        }

        fun focusLabel(focus: InfographicFocus): String = when (focus) {
            is InfographicFocus.Overall -> "Overall"
            is InfographicFocus.Side -> focusSideLabel(focus.side)
            is InfographicFocus.Team -> focus.team
        }
    }
}
