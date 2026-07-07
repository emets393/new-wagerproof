package com.wagerproof.core.models

import java.util.Locale
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor

/**
 * MLB props Best Picks report. Port of iOS `MLBPlayerPropBestPick.swift`.
 * All types here are client-built (assembled from RPC/report rows in the
 * service layer) — nothing decodes straight from JSON.
 */

// MARK: - Tiers & results

enum class MLBPlayerPropPickTier(val raw: String) {
    ELITE("elite"),
    STRONG("strong"),
    LEAN("lean");

    val label: String
        get() = when (this) {
            ELITE -> "Elite"
            STRONG -> "Strong"
            LEAN -> "Lean"
        }

    val emoji: String
        get() = when (this) {
            ELITE -> "🔥"
            STRONG -> "⭐"
            LEAN -> "👍"
        }

    val sortRank: Int
        get() = when (this) {
            ELITE -> 0
            STRONG -> 1
            LEAN -> 2
        }

    companion object {
        fun fromRaw(raw: String): MLBPlayerPropPickTier? = entries.firstOrNull { it.raw == raw }
    }
}

enum class MLBPlayerPropPickResult(val raw: String) {
    WON("won"),
    LOST("lost"),
    PUSH("push"),
    PENDING("pending"),
    VOID("void");

    companion object {
        fun fromRaw(raw: String): MLBPlayerPropPickResult? = entries.firstOrNull { it.raw == raw }
    }
}

enum class MLBPlayerPropPickKind(val raw: String) {
    BATTER("batter"),
    PITCHER("pitcher");

    companion object {
        fun fromRaw(raw: String): MLBPlayerPropPickKind? = entries.firstOrNull { it.raw == raw }
    }
}

// MARK: - Live pick (Best Picks Report)

data class MLBPlayerPropBestPick(
    val reportDate: String,
    val gamePk: Int,
    val playerId: Int,
    val market: String,
    val side: String,
    val playerName: String,
    val teamName: String?,
    val gameLabel: String,
    val isDay: Boolean,
    val marketLabel: String,
    val kind: MLBPlayerPropPickKind,
    val tier: MLBPlayerPropPickTier,
    val score: Int,
    val line: Double,
    val overOdds: Int?,
    val underOdds: Int?,
    val l10Over: Int?,
    val l10Games: Int?,
    val l10Pct: Int?,
    val rationale: List<String>,
    val locked: Boolean,
) {
    val id: String get() = "$reportDate|$gamePk|$playerId|$market|$side"
}

// MARK: - Graded history row

data class MLBPlayerPropGrade(
    val reportDate: String,
    val gamePk: Int,
    val playerId: Int,
    val market: String,
    val side: String,
    val playerName: String?,
    val teamName: String?,
    val marketLabel: String?,
    val kind: MLBPlayerPropPickKind?,
    val tier: MLBPlayerPropPickTier?,
    val score: Int?,
    val line: Double?,
    val overOdds: Int?,
    val underOdds: Int?,
    val l10Pct: Int?,
    val actualValue: Double?,
    val result: MLBPlayerPropPickResult?,
    val unitsStaked: Double?,
    val unitsWon: Double?,
) {
    val id: String get() = "$reportDate|$gamePk|$playerId|$market|$side"
}

// MARK: - Per-(tier x market) summary row

data class MLBPlayerPropGradeSummary(
    val tier: MLBPlayerPropPickTier,
    val market: String,
    val marketLabel: String,
    val kind: MLBPlayerPropPickKind,
    val picksTotal: Int,
    val picksWon: Int,
    val picksLost: Int,
    val picksPush: Int,
    val picksPending: Int,
    val winPct: Double?,
    val unitsStaked: Double?,
    val unitsWon: Double?,
    val roiPct: Double?,
) {
    val id: String get() = "${tier.raw}|$market"
}

// MARK: - Aggregates

data class MLBPlayerPropPerformanceTotals(
    var picks: Int = 0,
    var won: Int = 0,
    var lost: Int = 0,
    var push: Int = 0,
    var unitsStaked: Double = 0.0,
    var unitsWon: Double = 0.0,
) {
    val settled: Int get() = won + lost + push

    val winPct: Double?
        get() {
            val graded = won + lost
            if (graded <= 0) return null
            return (won.toDouble() / graded) * 100
        }

    val roiPct: Double?
        get() {
            if (unitsStaked <= 0) return null
            return (unitsWon / unitsStaked) * 100
        }

    companion object {
        fun aggregate(rows: List<MLBPlayerPropGradeSummary>): MLBPlayerPropPerformanceTotals {
            val totals = MLBPlayerPropPerformanceTotals()
            for (row in rows) {
                totals.picks += row.picksTotal
                totals.won += row.picksWon
                totals.lost += row.picksLost
                totals.push += row.picksPush
                totals.unitsStaked += row.unitsStaked ?: 0.0
                totals.unitsWon += row.unitsWon ?: 0.0
            }
            return totals
        }
    }
}

data class MLBPlayerPropTierSummary(
    val tier: MLBPlayerPropPickTier,
    val totals: MLBPlayerPropPerformanceTotals,
    val markets: List<MLBPlayerPropGradeSummary>,
) {
    val id: String get() = tier.raw
}

object MLBPlayerPropPerformanceFormatting {
    fun formatUnits(value: Double?, signed: Boolean = true): String {
        if (value == null || !value.isFinite()) return "—"
        val rounded = roundAwayFromZero(value * 100) / 100
        val body = String.format(Locale.US, "%.2f", abs(rounded))
        if (!signed) return "${body}u"
        return if (rounded >= 0) "+${body}u" else "-${body}u"
    }

    fun formatPct(value: Double?): String {
        if (value == null || !value.isFinite()) return "—"
        return String.format(Locale.US, "%.1f%%", value)
    }

    fun unitsColor(value: Double?): String {
        if (value == null || !value.isFinite()) return "muted"
        if (value > 0) return "win"
        if (value < 0) return "loss"
        return "muted"
    }

    // Swift Double.rounded() is ties-away-from-zero; kotlin.math.round is ties-to-even.
    private fun roundAwayFromZero(v: Double): Double =
        if (v >= 0) floor(v + 0.5) else ceil(v - 0.5)
}
