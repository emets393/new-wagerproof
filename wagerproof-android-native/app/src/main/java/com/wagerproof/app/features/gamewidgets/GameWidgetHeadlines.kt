package com.wagerproof.app.features.gamewidgets

import com.wagerproof.core.models.MLBSignalItem
import com.wagerproof.core.models.MLBSuggestedPick
import com.wagerproof.core.models.NBAGameTrends
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

/**
 * Deterministic game-widget headlines — port of iOS
 * `Features/GameWidgets/GameWidgetHeadlines.swift`.
 *
 * One bold plain-language sentence per detail widget, answering that card's
 * question. Callers pass values ALREADY resolved for display, so a headline can
 * never disagree with the numbers rendered under it; these helpers never
 * reinterpret a signed source field. `null` means "no headline", which is a
 * normal outcome — see .claude/docs/17_widget_headlines.md.
 *
 * Pure Kotlin (no Compose) so the strings are unit-testable.
 */
object GameWidgetHeadlines {

    fun projectedScore(
        segment: String = "full",
        awayName: String,
        homeName: String,
        awayScore: Double?,
        homeScore: Double?,
    ): String? {
        if (awayScore == null || homeScore == null) return null
        if (!awayScore.isFinite() || !homeScore.isFinite()) return null
        if (awayScore < 0 || homeScore < 0) return null
        val prefix = if (segment == "f5") "Through five, the model projects" else "The model projects"
        if (abs(awayScore - homeScore) < 0.25) {
            return "$prefix a near-even game: $awayName ${one(awayScore)}, $homeName ${one(homeScore)}."
        }
        val homeLeads = homeScore > awayScore
        val leadName = if (homeLeads) homeName else awayName
        val leadScore = if (homeLeads) homeScore else awayScore
        val trailName = if (homeLeads) awayName else homeName
        val trailScore = if (homeLeads) awayScore else homeScore
        return "$prefix $leadName ${one(leadScore)}, $trailName ${one(trailScore)}."
    }

    fun spread(
        team: String,
        modelSpread: Double?,
        marketSpread: Double?,
        edge: Double,
        probability: Double? = null,
    ): String? {
        if (!edge.isFinite()) return null
        if (modelSpread != null && marketSpread != null && modelSpread.isFinite() && marketSpread.isFinite()) {
            return "Model makes $team ${signed(modelSpread)} versus ${signed(marketSpread)} at the market — " +
                "a ${one(edge)}-point edge."
        }
        if (probability != null && probability.isFinite()) {
            return "Model expects $team to cover at ${whole(probability * 100)}%."
        }
        return "Model finds a ${one(edge)}-point spread edge on $team."
    }

    fun total(
        segment: String = "full",
        direction: String,
        modelTotal: Double?,
        marketTotal: Double?,
        probability: Double? = null,
    ): String {
        val scope = if (segment == "f5") "Through five" else "Full game"
        if (modelTotal != null && marketTotal != null && modelTotal.isFinite() && marketTotal.isFinite()) {
            return "$scope: model projects ${one(modelTotal)} versus ${one(marketTotal)} at the market — leans $direction."
        }
        if (probability != null && probability.isFinite()) {
            return "$scope: model leans $direction at ${whole(probability * 100)}%."
        }
        return "$scope: model leans $direction."
    }

    fun moneyline(
        segment: String,
        pickAbbr: String,
        pickProbability: Double,
        impliedProbability: Double?,
        pickEdgePct: Double?,
    ): String? {
        if (!pickProbability.isFinite()) return null
        val scope = if (segment == "f5") "Through five" else "Full game"
        val modelPct = pickProbability * 100
        val edge = pickEdgePct?.takeIf { it.isFinite() }
            ?: return "$scope: model leans $pickAbbr at ${one(modelPct)}%."
        if (edge <= 0) {
            return "$scope: no moneyline value on $pickAbbr; the model does not beat the market price."
        }
        if (modelPct < 50 && impliedProbability != null && impliedProbability.isFinite()) {
            return "$scope: $pickAbbr is not the outright favorite, but the model's ${one(modelPct)}% " +
                "beats the market's ${one(impliedProbability * 100)}% by ${one(edge)} points."
        }
        return "$scope: model backs $pickAbbr at ${one(modelPct)}%, a +${one(edge)}-point edge over the market."
    }

    fun injuries(
        awayAbbr: String,
        homeAbbr: String,
        awayImpact: Double,
        homeImpact: Double,
        count: Int,
    ): String {
        if (count <= 0) return "No injuries are currently reported for this matchup."
        if (abs(awayImpact - homeImpact) < 0.001) {
            return "$count reported injuries, with no clear impact advantage."
        }
        // Higher impact score = healthier side in the widget's own scale, so the
        // LARGER number is the team the injuries favor (iOS parity, verbatim).
        val healthier = if (awayImpact > homeImpact) awayAbbr else homeAbbr
        return "$count reported injuries; the current impact scores favor $healthier."
    }

    /**
     * Empty is meaningful only after the injury query succeeds. Before that,
     * publishing the zero-count copy would falsely claim that no injuries exist.
     */
    fun injuriesWhenLoaded(
        isLoaded: Boolean,
        awayAbbr: String,
        homeAbbr: String,
        awayImpact: Double,
        homeImpact: Double,
        count: Int,
    ): String? = if (isLoaded) {
        injuries(awayAbbr, homeAbbr, awayImpact, homeImpact, count)
    } else {
        null
    }

    fun teamStats(
        awayAbbr: String,
        homeAbbr: String,
        awayOffense: Double?,
        homeOffense: Double?,
    ): String? {
        if (awayOffense == null || homeOffense == null) return null
        if (!awayOffense.isFinite() || !homeOffense.isFinite()) return null
        if (abs(awayOffense - homeOffense) < 0.05) {
            return "$awayAbbr and $homeAbbr are nearly even in adjusted offense."
        }
        val leader = if (awayOffense > homeOffense) awayAbbr else homeAbbr
        return "$leader owns the stronger adjusted offense entering this matchup."
    }

    fun marketOdds(): String = "Live public-market probabilities and movement for this matchup."

    fun modelAccuracy(): String = "How this model has performed on comparable predictions."

    fun recentTrends(
        awayAbbr: String,
        homeAbbr: String,
        trends: NBAGameTrends?,
    ): String? {
        trends ?: return null
        val findings = mutableListOf<String>()

        val awayRtg = trends.awayOvrRtg
        val homeRtg = trends.homeOvrRtg
        if (awayRtg != null && homeRtg != null && awayRtg.isFinite() && homeRtg.isFinite()) {
            findings += if (abs(awayRtg - homeRtg) < 0.01) {
                "$awayAbbr and $homeAbbr are even in overall rating"
            } else {
                "${if (awayRtg > homeRtg) awayAbbr else homeAbbr} has the stronger recent overall rating"
            }
        }

        val awayAts = trends.awayAtsPct
        val homeAts = trends.homeAtsPct
        if (awayAts != null && homeAts != null && awayAts.isFinite() && homeAts.isFinite()) {
            findings += "$awayAbbr has covered ${whole(awayAts * 100)}% versus ${whole(homeAts * 100)}% for $homeAbbr"
        }

        if (findings.isEmpty()) return null
        return findings.joinToString("; ") + "."
    }

    fun regressionPicks(picks: List<MLBSuggestedPick>): String? {
        val primary = picks.firstOrNull() ?: return null
        val prefix = if (picks.size == 1) {
            "The regression report flags ${primary.pick}"
        } else {
            "${picks.size} regression picks are available, led by ${primary.pick}"
        }
        val market = regressionMarket(primary.betType)
        if (primary.bucketSample <= 0) return "$prefix in the $market market."
        return "$prefix in the $market market; its ${regressionBucket(primary.edgeBucket)} edge bucket has won " +
            "${whole(primary.bucketWinPct)}% across ${primary.bucketSample} picks."
    }

    fun gameSignals(signals: List<MLBSignalItem>): String? {
        if (signals.isEmpty()) return null
        val overCount = signals.count { it.severity.lowercase(Locale.US) == "over" }
        val underCount = signals.count { it.severity.lowercase(Locale.US) == "under" }

        // LinkedHashMap keeps first-seen order, which the tie-break below relies
        // on (Swift tracks `categoryOrder` separately for the same reason).
        val categoryCounts = LinkedHashMap<String, Int>()
        for (signal in signals) {
            val category = signal.category.replace("_", " ").trim().lowercase(Locale.US)
            if (category.isEmpty()) continue
            categoryCounts[category] = (categoryCounts[category] ?: 0) + 1
        }
        val order = categoryCounts.keys.toList()
        val topCategories = order
            .sortedWith(compareByDescending<String> { categoryCounts[it] ?: 0 }.thenBy { order.indexOf(it) })
            .take(2)

        val detail = mutableListOf<String>()
        if (topCategories.isNotEmpty()) {
            detail += "${topCategories.joinToString(" and ")} context"
        }
        if (overCount > 0 && underCount == 0) {
            detail += "$overCount tagged OVER"
        } else if (underCount > 0 && overCount == 0) {
            detail += "$underCount tagged UNDER"
        }

        val noun = if (signals.size == 1) "situational signal" else "situational signals"
        if (detail.isEmpty()) {
            return "${signals.size} $noun flagged beyond the model's projections."
        }
        return "${signals.size} $noun flagged — ${detail.joinToString(", ")}."
    }

    /** One decimal, no grouping separators — matches Swift's `.fractionLength(1)`. */
    fun one(value: Double): String = String.format(Locale.US, "%.1f", value)

    /**
     * Zero decimals. `roundToLong` (ties up) rather than `Int(x.rounded())`
     * gymnastics — every caller feeds a non-negative percentage, so ties-up and
     * Swift's ties-away-from-zero agree.
     */
    private fun whole(value: Double): String = value.roundToLong().toString()

    private fun signed(value: Double): String =
        (if (value >= 0) "+" else "") + String.format(Locale.US, "%.1f", value)

    private fun regressionMarket(betType: String): String = when (betType) {
        "full_ml" -> "full-game moneyline"
        "full_ou" -> "full-game total"
        "f5_ml" -> "first-five moneyline"
        "f5_ou" -> "first-five total"
        else -> betType.replace("_", " ")
    }

    private fun regressionBucket(bucket: String): String = bucket.replace("_", " ")
}
