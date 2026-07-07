package com.wagerproof.core.models

// Shared vocabulary for the matchup insight widgets (trends / props / F5).
// Lives in core-models because both the game-sheet widgets and search teaser
// chips must derive from the same summaries — one source of truth for every
// threshold (see InsightThresholds). Port of iOS MatchupInsightCore.swift.

enum class MatchupSide(val raw: String) {
    AWAY("away"),
    HOME("home"),
}

/** One verdict sentence rendered in a widget's verdict line. */
data class InsightVerdict(
    val text: String,
    val lean: Lean,
    /** 0 informational, 1...3 dots. */
    val strength: Int,
) {
    sealed class Lean {
        data class Team(val abbr: String, val side: MatchupSide) : Lean()
        data object Over : Lean()
        data object Under : Lean()
        data object None : Lean()
    }

    val id: String get() = text
}

/** Categorical header badge ("3 SIGNALS" / "NYY EDGE" / "NO EDGE"). */
data class InsightVerdictBadge(
    val text: String,
    val tintHex: Long,
)

/**
 * One search-chip teaser. `headline == null` renders the neutral chip copy
 * (the chip still navigates — never hide the door).
 */
data class InsightTeaser(
    val kind: Kind,
    val headline: String?,
    val signal: Signal,
    /** Amber dot suffix. */
    val smallSample: Boolean,
) {
    enum class Kind(val raw: String) {
        TRENDS("trends"),
        F5("f5"),
        PROPS("props"),
    }

    enum class Signal { POSITIVE, NEGATIVE, NEUTRAL }
}

/** Single source of truth for every insight threshold (spec §1). */
object InsightThresholds {
    const val minGamesBasketball = 5
    const val sideGap = 10.0
    const val leaderFloor = 55.0
    const val ouHigh = 55.0
    const val ouLow = 45.0
    const val propSampleMin = 5
    const val propHot = 70.0
    const val propCold = 30.0
    const val f5Slight = 5.0
    const val f5Edge = 10.0
    const val f5Own = 15.0
    const val f5DeltaMin = 0.5

    /** Strength → 0–3 dot scale shared by every verdict line. */
    fun dots(strength: Double): Int {
        if (strength >= 25) return 3
        if (strength >= 15) return 2
        if (strength > 0) return 1
        return 0
    }
}
