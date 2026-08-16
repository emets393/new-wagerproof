package com.wagerproof.core.models

import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

// MARK: - Formatting (ported from src/features/propBreakdown/format.ts)

object NFLPropFormat {
    /** `formatPerGame`: fixed decimals with a bare trailing ".0" stripped. */
    fun perGame(value: Double?, digits: Int = 1): String {
        if (value == null || !value.isFinite()) return "—"
        var out = String.format(Locale.US, "%.${digits}f", value)
        if (out.endsWith(".0")) out = out.dropLast(2)
        return out
    }

    /** "0.62" → "62%". */
    fun ratePct(rate: Double?): String {
        if (rate == null || !rate.isFinite()) return "—"
        return "${(rate * 100).roundToInt()}%"
    }

    /** "62nd" ordinal percentile. */
    fun pctileOrdinal(pctile: Double?): String {
        if (pctile == null || !pctile.isFinite()) return "—"
        val n = pctile.roundToInt()
        val mod = n % 10
        val mod100 = n % 100
        val suffix = when {
            mod == 1 && mod100 != 11 -> "st"
            mod == 2 && mod100 != 12 -> "nd"
            mod == 3 && mod100 != 13 -> "rd"
            else -> "th"
        }
        return "$n$suffix"
    }

    /** American odds with an explicit plus sign. */
    fun american(odds: Double?): String {
        if (odds == null || !odds.isFinite()) return "—"
        val n = odds.roundToInt()
        return if (n > 0) "+$n" else "$n"
    }

    fun american(odds: Int?): String = american(odds?.toDouble())

    /** 0.34 → fair American odds (+194); null outside (0, 1). */
    fun probabilityToAmerican(probability: Double): Double? {
        if (probability <= 0 || probability >= 1) return null
        return if (probability >= 0.5) {
            -((probability / (1 - probability)) * 100).roundToInt().toDouble()
        } else {
            (((1 - probability) / probability) * 100).roundToInt().toDouble()
        }
    }

    /** -110 → implied 0.524; null for 0/non-finite. */
    fun americanToProbability(odds: Double): Double? {
        if (!odds.isFinite() || odds == 0.0) return null
        return if (odds > 0) 100 / (odds + 100) else abs(odds) / (abs(odds) + 100)
    }
}

// MARK: - Verdict headlines
//
// Deterministic per-widget headline sentences for the NFL prop detail —
// the NFL analog of `MLBPlayerProps.buildVerdict`, mirroring iOS
// `NFLPropVerdicts.swift`. Sentences restate what the widget body renders.

object NFLPropVerdicts {
    /** Projection sentence noun ("passing yards"), ported from `PointStrip`. */
    fun projectedNoun(marketKey: String, marketLabel: String): String = when (marketKey) {
        "player_reception_yds" -> "receiving yards"
        "player_receptions" -> "receptions"
        "player_rush_yds" -> "rushing yards"
        "player_pass_yds" -> "passing yards"
        "player_rush_attempts" -> "rushing attempts"
        "player_pass_attempts" -> "passing attempts"
        "player_pass_completions" -> "pass completions"
        "player_pass_tds" -> "passing touchdowns"
        else -> marketLabel.lowercase()
    }

    /** Number-line unit suffix ("yds"), ported from `PointStrip`. */
    fun shortUnit(marketKey: String): String = when {
        marketKey.contains("yds") -> "yds"
        marketKey.contains("attempts") -> "att"
        marketKey.contains("completions") -> "cmp"
        marketKey.contains("receptions") -> "rec"
        marketKey.contains("tds") -> "TDs"
        else -> ""
    }

    /** TD-verb markets ("scored" instead of "over"), per `VsTeamCluster`. */
    fun isTdVerbMarket(marketKey: String): Boolean =
        marketKey.contains("anytime_td") || marketKey.contains("pass_td")

    private fun deltaDigits(delta: Double): Int = if (abs(delta) < 1) 2 else 1

    /**
     * WagerProof Projection headline. Null for rookie/missing projections —
     * the body renders "Projection coming soon" instead.
     */
    fun projectionHeadline(
        projection: NFLPropProjection?,
        marketKey: String,
        marketLabel: String,
        line: Double?,
        vegasOdds: Double?,
    ): String? = when (projection) {
        null -> null
        is NFLPropProjection.Point -> {
            val noun = projectedNoun(marketKey, marketLabel)
            val value = projection.value
            if (line == null) {
                "We project ${NFLPropFormat.perGame(value)} $noun."
            } else {
                val delta = value - line
                if (delta == 0.0) {
                    "We project ${NFLPropFormat.perGame(value)} $noun — even with Vegas' ${NFLPropFormat.perGame(line)} line."
                } else {
                    val direction = if (delta > 0) "above" else "below"
                    "We project ${NFLPropFormat.perGame(value)} $noun — ${NFLPropFormat.perGame(abs(delta), deltaDigits(delta))} $direction Vegas' ${NFLPropFormat.perGame(line)} line."
                }
            }
        }
        is NFLPropProjection.Rate -> {
            val scoreRate = projection.scoreRate
            val pct = NFLPropFormat.perGame(scoreRate * 100, 1)
            val fair = NFLPropFormat.probabilityToAmerican(scoreRate)?.let(NFLPropFormat::american) ?: "—"
            val vegasProb = vegasOdds?.let(NFLPropFormat::americanToProbability)
            if (vegasProb == null) {
                "We calculate a $pct% chance to score — fair odds $fair."
            } else {
                val delta = scoreRate * 100 - vegasProb * 100
                val direction = when {
                    delta > 0.05 -> "more likely to score than Vegas thinks"
                    delta < -0.05 -> "less likely to score than Vegas thinks"
                    else -> "about as likely to score as Vegas thinks"
                }
                "We calculate a $pct% chance to score — fair odds $fair — $direction."
            }
        }
    }

    /**
     * Recent Games headline: the MLB verdict tone applied to the Last-10
     * grading vs today's line. Null when nothing is graded (no line).
     */
    fun recentGamesHeadline(hits: Int, graded: Int, isTd: Boolean, hasLine: Boolean): String? {
        if (!hasLine || graded <= 0) return null
        if (isTd) {
            val emoji = if (hits >= 7) "🔥 " else if (hits >= 5) "📈 " else ""
            return "${emoji}Scored in $hits of the last $graded."
        }
        return when {
            hits >= 7 -> "🔥 Cleared in $hits of the last $graded."
            hits >= 5 -> "📈 Hit $hits/$graded over the last $graded."
            else -> "$hits/$graded over the last $graded."
        }
    }

    /** Matchup headline: the ComparisonBlock header sentence. */
    fun matchupHeadline(opponent: String, identity: String?): String {
        if (identity.isNullOrEmpty()) return "Facing $opponent."
        val capped = identity.replaceFirstChar { it.uppercase() }
        return "Facing $opponent: $capped."
    }

    /** Head-to-Head headline; null below the web's gates (meetings ≥ 2, n ≥ 2). */
    fun headToHeadHeadline(
        matchup: NFLPropTrendMatchup?,
        marketKey: String,
        opponent: String,
    ): String? {
        if (matchup == null || matchup.meetings < 2) return null
        val rec = matchup.byMarket[marketKey] ?: return null
        if (rec.n < 2) return null
        val verb = if (isTdVerbMarket(marketKey)) "scored" else "over"
        val pct = rec.pct?.let { " · ${(it * 100).roundToInt()}%" } ?: ""
        return "${rec.h}/${rec.n} $verb vs $opponent$pct · ${matchup.meetings} career meetings."
    }

    /** Situations headline from the overall bucket record. */
    fun situationsHeadline(overall: NFLPropSituationRecord?, marketKey: String): String? {
        if (overall == null) return null
        val action = if (marketKey == "player_anytime_td") "Scored" else "Cleared the line"
        val noun = if (overall.n == 1) "game" else "games"
        return "$action in ${overall.h} of ${overall.n} recent $noun."
    }
}
