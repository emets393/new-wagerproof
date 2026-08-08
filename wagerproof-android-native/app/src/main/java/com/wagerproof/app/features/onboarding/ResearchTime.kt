package com.wagerproof.app.features.onboarding

import java.text.NumberFormat
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

// Port of iOS `Wagerproof/Features/Onboarding/ResearchTime.swift`.
//
// Single source of truth for the personalized time-value arc (steps 6–9): the
// self-reported DAILY sports-app-checking bucket, the weekly bet-amount bucket,
// the projection formulas, and every piece of branched copy. Pages render this —
// they never do math or own copy, so the numbers on the cost/reclaim reveals, the
// pitch-intro marker slide, the time summary, and the paywall reprise can never
// drift apart.
//
// The frame is per-DAY (scores, odds, lines, sports apps — the repetitive checking
// an agent replaces), projected across a betting lifetime and expressed as "years
// of your life" (÷16 waking hours × 46-year horizon). Checking is a daily habit,
// so every bucket clears a full year on the cost reveal.
//
// Estimates quantify TIME ONLY. The cost reveal is just the user's own reported
// time projected; the reclaim is scoped to the repetitive checking an agent
// automates (a disclosed fraction) and always carries an on-screen disclosure.
// Never present these as outcomes, and never attach them to profit/win language.
//
// This lives in the app module (not core:stores) exactly like iOS keeps it in the
// app target: the store persists RAW bucket ids, and every consumer — onboarding
// pages and the post-onboarding paywall — resolves them through here.

/**
 * Self-reported DAILY time spent checking scores, odds, lines, and sports apps.
 * [raw] values are PERSISTED in `profiles.onboarding_data.researchTimeBucket` —
 * never rename a case. (The persisted KEY is still `researchTimeBucket` for
 * continuity; the old weekly-research values `lt1`/`h6to10`/… no longer match a
 * case, so they resolve tolerantly to [UNKNOWN].)
 */
enum class ResearchTimeBucket(val raw: String) {
    LT30M("lt30m"),
    M30TO60("m30to60"),
    H1TO2("h1to2"),
    H2TO3("h2to3"),
    H3TO4("h3to4"),
    H4PLUS("h4plus"),
    UNKNOWN("unknown");

    /** Pill label on the question page. */
    val optionLabel: String
        get() = when (this) {
            LT30M -> "< 30 min"
            M30TO60 -> "30–60 min"
            H1TO2 -> "1–2 hours"
            H2TO3 -> "2–3 hours"
            H3TO4 -> "3–4 hours"
            H4PLUS -> "4+ hours"
            UNKNOWN -> "Honestly, no idea"
        }

    /**
     * Conservative midpoint (hours/day) used by every projection. [UNKNOWN] sits
     * near an engaged bettor's median rather than forcing fake precision.
     */
    val hoursPerDay: Double
        get() = when (this) {
            LT30M -> 0.5
            M30TO60 -> 0.75
            H1TO2 -> 1.5
            H2TO3 -> 2.5
            H3TO4 -> 3.5
            H4PLUS -> 5.0
            UNKNOWN -> 1.5
        }

    /**
     * Weekly checking hours (7× the daily midpoint) — used by the paywall's
     * before/after chart, which reads in hours/week.
     */
    val hoursPerWeek: Double get() = hoursPerDay * 7

    /** First-person echo of the tapped answer (rendered dimmed). */
    val echoLine: String
        get() = when (this) {
            LT30M -> "Under half an hour a day."
            M30TO60 -> "Half an hour to an hour a day."
            H1TO2 -> "One to two hours a day."
            H2TO3 -> "Two to three hours a day."
            H3TO4 -> "Three to four hours a day."
            H4PLUS -> "Four or more hours a day."
            UNKNOWN -> "Honestly, not sure."
        }

    /** Branched conversational acknowledgment (rendered bright, accent ring). */
    val replyLine: String
        get() = when (this) {
            LT30M -> "Disciplined. Let's keep it that way."
            M30TO60 -> "Not bad — but that's still real time we can hand back."
            H1TO2 -> "That adds up faster than it feels. Most of it is the same checks on repeat."
            H2TO3 -> "That's a part-time habit — scores, lines, and refreshes, over and over."
            H3TO4 -> "That's a second job you never applied for. Almost all of it is repeatable."
            H4PLUS -> "That's a huge chunk of your day going to the scroll. Let's win it back."
            UNKNOWN -> "Most bettors underestimate it. Score checks and line refreshes add up fast."
        }

    companion object {
        /**
         * Tolerant resolve — null / unrecognized (older weekly payloads, future
         * renames) land on [UNKNOWN] so downstream math always has a basis.
         */
        fun resolve(raw: String?): ResearchTimeBucket =
            entries.firstOrNull { it.raw == raw } ?: UNKNOWN
    }
}

/**
 * Derived projections for one bucket. All display values are pre-rounded here so
 * every surface shows identical numbers.
 */
data class ResearchTimeEstimates(val bucket: ResearchTimeBucket) {

    /** Calendar days of THIS year spent checking, at this pace: hours/day × 365 ÷ 24. */
    val daysThisYear: Int = (bucket.hoursPerDay / 24.0 * DAYS_PER_YEAR).roundToInt()

    /**
     * Years of life spent checking, projected across a betting lifetime and
     * expressed against waking hours (the "bad news" figure).
     */
    val yearsOfLife: Int = max(1, yearsExact(bucket).roundToInt())

    /**
     * Years an agent hands back — [RECLAIM_FRACTION] of the years-of-life figure,
     * floored (min 1) and shown as "N+ years".
     */
    val reclaimYears: Int = max(1, (yearsExact(bucket) * RECLAIM_FRACTION).toInt())

    /**
     * Weekly hours the agent's checking replaces — the concrete anchor under the
     * big abstract "years" number.
     */
    val reclaimHoursPerWeek: Int =
        max(1, (bucket.hoursPerDay * RECLAIM_FRACTION * 7).roundToInt())

    companion object {
        // Disclosed assumptions (owner-approved): a betting lifetime projected
        // across ~46 years, with a 16-waking-hours-a-day basis for the "years of
        // your life" equivalence. Reclaim is scoped to the repetitive checking an
        // agent automates — conservative, and always shown with the disclosure.
        const val WAKING_HOURS_PER_DAY = 16.0
        const val LIFETIME_HORIZON_YEARS = 46.0
        const val DAYS_PER_YEAR = 365.0
        const val RECLAIM_FRACTION = 0.75

        private fun yearsExact(bucket: ResearchTimeBucket): Double =
            bucket.hoursPerDay / WAKING_HOURS_PER_DAY * LIFETIME_HORIZON_YEARS

        operator fun invoke(rawBucket: String?): ResearchTimeEstimates =
            ResearchTimeEstimates(ResearchTimeBucket.resolve(rawBucket))

        /** "year" / "years" — keeps every surface's pluralization in one place. */
        fun yearsWord(n: Int): String = if (n == 1) "year" else "years"

        /**
         * Goal-branched close for the reclaim reveal. Keys match the persisted
         * goal ids on the primary-goal page verbatim.
         */
        fun reclaimClose(goal: String?): String = when (goal) {
            "Find profitable edges faster" ->
                "Time you could spend acting on edges while they're live instead of hunting for them."
            "Analyze data to improve strategy" ->
                "Time you could spend refining strategy instead of gathering inputs."
            "Track my performance over time" ->
                "Time you could spend reviewing what works instead of redoing the same checks."
            "Get timely alerts for model picks" ->
                "Your agent watches the board, so you only step in when something's worth your attention."
            else -> "Time back for the parts of betting you actually enjoy."
        }

        /** Always visible with the cost reveal's final block. */
        const val COST_FOOTNOTE =
            "Projection of your current habits, at about 16 waking hours a day."

        /**
         * Required disclosure — always on screen with the reclaim figure, never
         * behind a tap. Sells time only; explicitly disclaims outcomes.
         */
        const val RECLAIM_DISCLOSURE =
            "Estimated from your answer and the checking WagerProof automates: score, line, " +
                "and model updates, projected across a betting lifetime at about 16 waking hours " +
                "a day. Estimates aren't guarantees. Actual time savings vary, and WagerProof " +
                "does not promise betting profits or outcomes."
    }
}

// MARK: - Weekly bet-amount (money-in-play) arc

/**
 * Self-reported weekly bet amount. Powers the "money in play" figures woven into
 * the cost/reclaim/summary/paywall alongside the time numbers. The frame is
 * RISK-SIZING ONLY: it projects how much a small weekly stake becomes over a year
 * and a betting lifetime (turnover — total wagered), never winnings, losses, or
 * returns. [raw] values are PERSISTED in
 * `profiles.onboarding_data.weeklyStakesBucket` — never rename a case.
 */
enum class StakesBucket(val raw: String) {
    LT50("lt50"),
    H50TO150("h50to150"),
    H150TO400("h150to400"),
    H400TO1000("h400to1000"),
    H1000PLUS("h1000plus"),
    UNKNOWN("unknown");

    /** Pill label on the question page. */
    val optionLabel: String
        get() = when (this) {
            LT50 -> "Under $50"
            H50TO150 -> "$50–$150"
            H150TO400 -> "$150–$400"
            H400TO1000 -> "$400–$1,000"
            H1000PLUS -> "$1,000+"
            UNKNOWN -> "Prefer not to say"
        }

    /**
     * Conservative weekly midpoint (dollars). [UNKNOWN] ("prefer not to say") sits
     * near an engaged bettor's median rather than forcing fake precision.
     */
    val weeklyDollars: Double
        get() = when (this) {
            LT50 -> 25.0
            H50TO150 -> 100.0
            H150TO400 -> 250.0
            H400TO1000 -> 650.0
            H1000PLUS -> 1500.0
            UNKNOWN -> 150.0
        }

    /** First-person echo of the tapped answer (rendered dimmed). */
    val echoLine: String
        get() = when (this) {
            LT50 -> "Under $50 a week."
            H50TO150 -> "Around $50 to $150 a week."
            H150TO400 -> "About $150 to $400 a week."
            H400TO1000 -> "About $400 to $1,000 a week."
            H1000PLUS -> "A thousand or more a week."
            UNKNOWN -> "I'd rather not say."
        }

    /**
     * Branched acknowledgment (bright, accent ring). Sizes the risk — no judgment,
     * no returns talk.
     */
    val replyLine: String
        get() = when (this) {
            LT50 -> "Keeping it light. Still adds up over a year."
            H50TO150 -> "A steady habit — bigger over a year than it feels."
            H150TO400 -> "That adds up faster than it feels."
            H400TO1000 -> "Serious action, every single week."
            H1000PLUS -> "High stakes. The yearly number is going to be eye-opening."
            UNKNOWN -> "No problem — we'll use a middle estimate."
        }

    companion object {
        /** Tolerant resolve — null / unrecognized lands on [UNKNOWN]. */
        fun resolve(raw: String?): StakesBucket = entries.firstOrNull { it.raw == raw } ?: UNKNOWN
    }
}

/**
 * Derived "money in play" projections. All display values are pre-rounded and
 * pre-formatted here so every surface shows identical figures. Turnover only —
 * never winnings/losses. Lifetime uses the SAME horizon as the years-of-life
 * figure ([ResearchTimeEstimates.LIFETIME_HORIZON_YEARS]) so the two reveals share
 * one timeframe.
 */
data class StakesEstimates(val bucket: StakesBucket) {

    /** Total wagered this year: weekly × 52. */
    val yearlyAction: Int = roundTo(bucket.weeklyDollars * 52, 100)

    /** Total wagered across a betting lifetime: yearly × horizon years. */
    val lifetimeAction: Int = roundTo(
        bucket.weeklyDollars * 52 * ResearchTimeEstimates.LIFETIME_HORIZON_YEARS,
        10_000,
    )

    /** "$13,000" — this year's total wagered. */
    val yearlyActionDisplay: String get() = money(yearlyAction)

    /** "$600,000" — lifetime total wagered (the "you read that right" figure). */
    val lifetimeActionDisplay: String get() = money(lifetimeAction)

    companion object {
        operator fun invoke(rawBucket: String?): StakesEstimates =
            StakesEstimates(StakesBucket.resolve(rawBucket))

        private fun roundTo(value: Double, step: Int): Int =
            (value / step).roundToInt() * step

        // Grouped with US separators to match the English-only onboarding copy;
        // Swift's Int.formatted() is locale-driven but every string around these
        // figures is hardcoded en-US anyway, so a mixed-locale render would look
        // worse than a consistent one.
        private val GROUPING: NumberFormat = NumberFormat.getIntegerInstance(Locale.US)

        fun money(value: Int): String = "$" + GROUPING.format(value.toLong())

        /**
         * Always visible with any money figure. Names it as turnover and disclaims
         * outcomes — the money is risk-sizing, never a projection of results.
         */
        const val DISCLOSURE =
            "Total amount wagered — money in play, not winnings or losses. Projected from your " +
                "answer across a betting lifetime. WagerProof does not promise profits or outcomes."
    }
}
