package com.wagerproof.core.models

import kotlin.math.abs

// Player-props digest for the MLB game sheet widget + search teaser chips.
// Pure math over `MLBPropMatchup` — see spec §1b for the slot algorithm.
// Port of iOS PropsInsight.swift — thresholds and strings are the product; keep verbatim.

data class PropSignal(
    val playerId: Int,
    val playerName: String,
    val isPitcher: Boolean,
    val teamAbbr: String,
    val side: MatchupSide,
    val battingOrder: Int?,
    /** Carries row + computed (l10, miniStrip, line). */
    val headline: MLBHeadlineProp,
    val slot: Slot,
) {
    enum class Slot { STARTER_K, HOT_BAT, COLD_BAT, LINEUP_FILL }

    val id: Int get() = playerId
}

data class PropsInsightSummary(
    val verdict: InsightVerdict,
    /** null = no header accessory. */
    val badge: InsightVerdictBadge?,
    /** ≤ 5, slot-ordered (starters → extremes → fill). */
    val signals: List<PropSignal>,
    /** Players with a headline (footer count). */
    val totalProps: Int,
)

object MLBPropsInsight {

    /** null = no headline props at all → widget hidden. */
    fun summary(matchup: MLBPropMatchup, maxRows: Int = 5): PropsInsightSummary? {
        val pool = buildPool(matchup)
        if (pool.isEmpty()) return null

        // Slot 1 — starters' K-market headline, always shown (even at 50%).
        val signals = pool.filter { it.slot == PropSignal.Slot.STARTER_K }.toMutableList()

        // Slot 2 — extreme bats: ≥5-game sample AND ≥70 hot / ≤30 cold.
        val extremes = pool
            .filter { it.slot == PropSignal.Slot.HOT_BAT || it.slot == PropSignal.Slot.COLD_BAT }
            .sortedWith(
                compareByDescending<PropSignal> { distance(it) }
                    // Tiebreak: batting order asc, nil last, then playerId.
                    .then(compareBy<PropSignal, Int?>(nullsLast()) { it.battingOrder })
                    .thenBy { it.playerId },
            )
        val extremeSlots = extremes.take(3)
        signals += extremeSlots

        // Slot 3 — lineup backfill (top of the order, pct desc). The only
        // place lowConfidence items may enter.
        if (extremeSlots.size < 3) {
            val taken = signals.map { it.playerId }.toSet()
            val fills = pool
                .filter { it.slot == PropSignal.Slot.LINEUP_FILL && it.playerId !in taken }
                .filter { (it.battingOrder ?: 99) <= 3 && (it.battingOrder ?: 0) >= 1 }
                .sortedByDescending { pct(it) }
            signals += fills.take(3 - extremeSlots.size)
        }

        val rendered = signals.take(maxRows)

        // Streak counts across the WHOLE pool, not just rendered rows.
        val hot = pool.count { it.slot == PropSignal.Slot.HOT_BAT }
        val cold = pool.count { it.slot == PropSignal.Slot.COLD_BAT }
        val streaks = hot + cold

        val best = extremes.firstOrNull()
        val verdict: InsightVerdict
        if (best != null) {
            val l10 = best.headline.computed.l10
            var text = "${lastName(best.playerName)} ${l10.fractionLabel} over " +
                "${MLBPlayerProps.formatLine(best.headline.computed.line)} ${marketShort(best.headline.row.market)}"
            if (streaks > 1) {
                text += " · ${streaks - 1} more streak${if (streaks - 1 == 1) "" else "s"}"
            }
            verdict = InsightVerdict(
                text = text,
                lean = if (best.slot == PropSignal.Slot.HOT_BAT) InsightVerdict.Lean.Over else InsightVerdict.Lean.Under,
                strength = InsightThresholds.dots(distance(best)),
            )
        } else {
            verdict = InsightVerdict("Starter K props + top of the order", InsightVerdict.Lean.None, 0)
        }

        // "NO EDGE" reads wrong over starter rows — omit the accessory instead.
        val badge: InsightVerdictBadge? = if (streaks >= 1) {
            InsightVerdictBadge("$streaks STREAK${if (streaks == 1) "" else "S"}", 0x22C55EL)
        } else {
            null
        }

        return PropsInsightSummary(verdict = verdict, badge = badge, signals = rendered, totalProps = pool.size)
    }

    fun teaser(matchup: MLBPropMatchup): InsightTeaser? {
        val pool = buildPool(matchup)
        if (pool.isEmpty()) return null
        val candidates = pool.filter { it.headline.computed.l10.games > 0 }
        val top = candidates.maxByOrNull { pct(it) }
        if (top == null || pct(top) < InsightThresholds.leaderFloor) {
            return InsightTeaser(InsightTeaser.Kind.PROPS, null, InsightTeaser.Signal.NEUTRAL, smallSample = false)
        }
        val computed = top.headline.computed
        val headline = "${lastName(top.playerName)} ${marketShort(top.headline.row.market)} " +
            "o${MLBPlayerProps.formatLine(computed.line)} · ${pct(top).toInt()}% L10"
        return InsightTeaser(
            kind = InsightTeaser.Kind.PROPS,
            headline = headline,
            signal = if (pct(top) >= InsightThresholds.propHot) InsightTeaser.Signal.POSITIVE else InsightTeaser.Signal.NEUTRAL,
            smallSample = computed.l10.games < InsightThresholds.propSampleMin,
        )
    }

    /** Compact market label shared by the widget rows + verdict + teaser. */
    fun marketShort(market: String): String = when (market) {
        "pitcher_strikeouts" -> "Ks"
        "batter_total_bases" -> "TB"
        "batter_hits" -> "H"
        "batter_home_runs" -> "HR"
        "batter_runs_scored" -> "R"
        "batter_rbis" -> "RBI"
        "batter_hits_runs_rbis" -> "H+R+RBI"
        else -> MLBPlayerProps.marketLabel(market)
    }

    // Pool -------------------------------------------------------------------

    /**
     * Every player with a headline prop, pre-classified into their slot
     * candidacy (starterK / hotBat / coldBat / lineupFill).
     */
    private fun buildPool(m: MLBPropMatchup): List<PropSignal> {
        val out = mutableListOf<PropSignal>()

        for ((starter, side, abbr) in listOf(
            Triple(m.awayStarter, MatchupSide.AWAY, m.awayAbbr),
            Triple(m.homeStarter, MatchupSide.HOME, m.homeAbbr),
        )) {
            val props = m.pitcherProps(starter.pitcherId)
            val kProps = props.filter { it.market == "pitcher_strikeouts" }
            val headline = MLBPlayerProps.pickHeadlineProp(if (kProps.isEmpty()) props else kProps) ?: continue
            out += PropSignal(
                playerId = starter.pitcherId, playerName = starter.name, isPitcher = true,
                teamAbbr = abbr, side = side, battingOrder = null, headline = headline,
                slot = PropSignal.Slot.STARTER_K,
            )
        }

        fun appendBatter(playerId: Int, name: String, side: MatchupSide, abbr: String, order: Int?, props: List<MLBPlayerPropRow>) {
            val headline = MLBPlayerProps.pickHeadlineProp(props) ?: return
            val l10 = headline.computed.l10
            val p = l10.pct?.toDouble()
            val slot = when {
                l10.games >= InsightThresholds.propSampleMin && p != null && p >= InsightThresholds.propHot ->
                    PropSignal.Slot.HOT_BAT
                l10.games >= InsightThresholds.propSampleMin && p != null && p <= InsightThresholds.propCold ->
                    PropSignal.Slot.COLD_BAT
                else -> PropSignal.Slot.LINEUP_FILL
            }
            out += PropSignal(
                playerId = playerId, playerName = name, isPitcher = false,
                teamAbbr = abbr, side = side, battingOrder = order, headline = headline, slot = slot,
            )
        }

        for (row in m.awayLineup) {
            appendBatter(row.playerId, row.playerName, MatchupSide.AWAY, m.awayAbbr, row.battingOrder, m.batterProps(row.playerId))
        }
        for (row in m.homeLineup) {
            appendBatter(row.playerId, row.playerName, MatchupSide.HOME, m.homeAbbr, row.battingOrder, m.batterProps(row.playerId))
        }
        // Posted-but-unlisted batters — team side unknown, no batting order, so
        // they only ever surface through the extreme slots.
        for (group in m.extraBatterGroups) {
            appendBatter(group.playerId, group.props.firstOrNull()?.playerName ?: "Player", MatchupSide.AWAY, "", null, group.props)
        }
        return out
    }

    private fun pct(s: PropSignal): Double = (s.headline.computed.l10.pct ?: 0).toDouble()

    private fun distance(s: PropSignal): Double = abs(pct(s) - 50)

    private val nameSuffixes = setOf("jr.", "jr", "sr.", "sr", "ii", "iii", "iv")

    private fun lastName(full: String): String {
        val tokens = full.split(" ").filter { it.isNotEmpty() }
        val last = tokens.lastOrNull() ?: return full
        if (last.lowercase() in nameSuffixes && tokens.size >= 2) {
            return tokens[tokens.size - 2]
        }
        return last
    }
}
