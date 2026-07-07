package com.wagerproof.core.models

import kotlin.math.abs

/**
 * Canonical unit math — cross-platform LOCKSTEP contract. Matches SQL
 * `recalculate_avatar_performance()`, web, and iOS byte-for-byte.
 * **Do not invent variants.** When tweaks are needed, update web, mobile,
 * SQL, iOS, and this file in lockstep.
 *
 * Risk model: the bettor always risks `units` (typically 1.0 for agents,
 * editor-supplied for editor picks).
 *
 *   Negative odds (favorite, e.g. -110):
 *     Win  -> +units * (100 / |odds|)
 *     Loss -> -units
 *
 *   Positive odds (underdog, e.g. +150):
 *     Win  -> +units * (odds / 100)
 *     Loss -> -units
 *
 *   Push / Pending -> 0
 */
data class UnitsCalculationResult(
    val unitsWon: Double,
    val unitsLost: Double,
    val netUnits: Double,
) {
    companion object {
        val ZERO = UnitsCalculationResult(unitsWon = 0.0, unitsLost = 0.0, netUnits = 0.0)
    }
}

object UnitsCalculation {
    /**
     * Parse American odds string (e.g. "-110", "+180"). Decimal odds rejected.
     * Unsigned strings ("110") are treated as positive per US convention.
     */
    fun parseOdds(string: String?): Int? {
        val s = string?.trim().takeUnless { it.isNullOrEmpty() } ?: return null
        // Reject decimals (American odds are always integers).
        if (s.contains(".")) return null
        val n = s.removePrefix("+").toIntOrNull() ?: return null
        return if (n == 0) null else n
    }

    /** Canonical calculator. `odds` may be a string like "-110" or "+150". */
    fun calculate(
        result: PickResult?,
        odds: String?,
        units: Double?,
    ): UnitsCalculationResult {
        if (result == null || result == PickResult.PENDING) return UnitsCalculationResult.ZERO
        if (units == null || units == 0.0 || !units.isFinite()) return UnitsCalculationResult.ZERO
        if (result == PickResult.PUSH) return UnitsCalculationResult.ZERO

        val oddsNum = parseOdds(odds) ?: return UnitsCalculationResult.ZERO

        return when (result) {
            PickResult.WON -> {
                val won = if (oddsNum < 0) {
                    units * (100.0 / abs(oddsNum).toDouble())
                } else {
                    units * (oddsNum.toDouble() / 100.0)
                }
                UnitsCalculationResult(unitsWon = won, unitsLost = 0.0, netUnits = won)
            }
            PickResult.LOST -> UnitsCalculationResult(unitsWon = 0.0, unitsLost = units, netUnits = -units)
            else -> UnitsCalculationResult.ZERO
        }
    }
}
