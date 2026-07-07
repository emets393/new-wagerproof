package com.wagerproof.core.models

import kotlin.math.abs

/**
 * One entry in a unified bet feed — a straight pick OR a parlay ticket.
 * Lets the pick-history folder, today's rail, and performance chart operate
 * on one interleaved list without caring which shape each row is.
 * Client-only; never serialized.
 */
sealed interface AgentBetItem {
    data class Pick(val pick: AgentPick) : AgentBetItem
    data class Parlay(val parlay: AgentParlay) : AgentBetItem

    // Prefixed so a pick and a parlay can never collide in list identity.
    val id: String
        get() = when (this) {
            is Pick -> "pick_${pick.id}"
            is Parlay -> "parlay_${parlay.id}"
        }

    /**
     * The date used for today/history bucketing (pick: game date;
     * parlay: target date, falling back to the earliest leg date).
     */
    val gameDate: String
        get() = when (this) {
            is Pick -> pick.gameDate
            is Parlay -> parlay.displayDate
        }

    val createdAt: String
        get() = when (this) {
            is Pick -> pick.createdAt
            is Parlay -> parlay.createdAt
        }

    /**
     * Ticket-level result. A parlay's per-leg results live on its legs; this
     * is the rolled-up outcome, so W-L-P style filtering counts each parlay once.
     */
    val result: AgentPick.PickResultStatus
        get() = when (this) {
            is Pick -> pick.result
            is Parlay -> parlay.result
        }

    /** Stake for the whole item — a parlay has ONE stake for the whole ticket. */
    val units: Double
        get() = when (this) {
            is Pick -> pick.units
            is Parlay -> parlay.units
        }

    val confidence: Int
        get() = when (this) {
            is Pick -> pick.confidence
            is Parlay -> parlay.confidence
        }

    /**
     * Sport for filter pills. Null for a true multi-sport parlay — those only
     * surface under "All", never under a specific sport's filter.
     */
    val sportForFilter: AgentSport?
        get() = when (this) {
            is Pick -> pick.sport
            is Parlay -> parlay.sport.asAgentSport
        }

    /**
     * Signed net-units effect of this settled item (0 while pending/push).
     * Matches the server's Formula B (`recalculate_avatar_performance`):
     *   pick   won → units × american multiplier(odds), lost → −units
     *   parlay won → units × (settled decimal − 1), lost → −units
     * A won parlay prefers the grader's `settled_decimal` (drop-and-reprice on
     * pushed legs) over the pre-grade `combined_odds`; each settled parlay
     * contributes exactly once — never per leg.
     */
    val netUnitsContribution: Double
        get() = when (this) {
            is Pick -> when (pick.result) {
                // Missing odds default to a -110 payout (parity with the chart's
                // old local formula and the SQL fallback).
                AgentPick.PickResultStatus.WON ->
                    pick.units * (americanWinMultiplier(pick.odds) ?: (100.0 / 110.0))
                AgentPick.PickResultStatus.LOST -> -pick.units
                AgentPick.PickResultStatus.PUSH,
                AgentPick.PickResultStatus.PENDING -> 0.0
            }
            is Parlay -> when (parlay.result) {
                AgentPick.PickResultStatus.WON -> {
                    val settled = parlay.settledDecimalOdds
                    if (settled != null && settled > 1) {
                        parlay.units * (settled - 1)
                    } else {
                        // Fallback chain matches SQL: combined_odds, then even money.
                        parlay.units * (americanWinMultiplier(parlay.combinedOdds) ?: 1.0)
                    }
                }
                AgentPick.PickResultStatus.LOST -> -parlay.units
                AgentPick.PickResultStatus.PUSH,
                AgentPick.PickResultStatus.PENDING -> 0.0
            }
        }

    companion object {
        /**
         * Profit multiplier for a 1-unit win at the given American odds
         * (+150 → 1.5, -200 → 0.5). Null when the odds string doesn't parse.
         */
        fun americanWinMultiplier(odds: String?): Double? {
            val oddsInt = odds?.replace("+", "")?.toIntOrNull() ?: return null
            if (oddsInt == 0) return null
            return if (oddsInt > 0) oddsInt / 100.0 else 100.0 / abs(oddsInt)
        }
    }
}
