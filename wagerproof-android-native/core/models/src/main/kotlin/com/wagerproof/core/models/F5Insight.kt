package com.wagerproof.core.models

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

// First-5-innings digest for the MLB game sheet widget + search teaser chips.
// Pure math over `MLBF5Matchup` — see spec §1c. The away team is judged by its
// AWAY games vs tonight's opposing starter hand; the home team by HOME games.
// Port of iOS F5Insight.swift — thresholds and strings are the product; keep verbatim.

data class MLBF5Matchup(
    val game: MLBF5Game,
    val awaySplit: MLBF5SplitRow?,
    val homeSplit: MLBF5SplitRow?,
) {
    val id: Int get() = game.gamePk
}

data class F5CompareRow(
    val metric: Metric,
    /** "F5 WIN %" */
    val title: String,
    /** Normalized bar inputs. */
    val awayValue: Double?,
    val homeValue: Double?,
    val awayNumeral: String,
    val homeNumeral: String,
    /** Null for the winPct row. */
    val awayDelta: Double?,
    val homeDelta: Double?,
    val goodWhenNegative: Boolean,
    val advantage: MatchupSide?,
) {
    enum class Metric(val raw: String) {
        WIN_PCT("winPct"),
        RUNS_SCORED("runsScored"),
        RUNS_ALLOWED("runsAllowed"),
    }

    val id: String get() = metric.raw
}

data class F5InsightSummary(
    val verdicts: List<InsightVerdict>,
    val badge: InsightVerdictBadge,
    val qualifier: String,
    /** Exactly the 3 rows of §1c. */
    val rows: List<F5CompareRow>,
    val sampleWarning: String?,
)

/** Own-starter-hand runs-allowed slice used by the RUNS ALLOWED row. */
private data class OwnRaSplit(val value: Double?, val delta: Double?, val games: Int)

private data class F5TeaserCandidate(
    val abbr: String,
    val delta: Double,
    val phrase: String,
    val positive: Boolean,
    val games: Int,
)

object MLBF5Insight {

    /** null → widget hidden (no split clears the 2-game showable floor). */
    fun summary(matchup: MLBF5Matchup): F5InsightSummary? {
        val game = matchup.game
        val away = matchup.awaySplit
        val home = matchup.homeSplit
        val awayOk = MLBF5.isShowable(away?.games)
        val homeOk = MLBF5.isShowable(home?.games)
        if (!awayOk && !homeOk) return null

        val awayShown = if (awayOk) away else null
        val homeShown = if (homeOk) home else null

        val verdicts = mutableListOf<InsightVerdict>()

        // Side verdict — suppressed entirely when either side lacks a sample.
        var sideVerdict: InsightVerdict? = null
        val awayWinPct = awayShown?.f5WinPct
        val homeWinPct = homeShown?.f5WinPct
        if (awayWinPct != null && homeWinPct != null) {
            val gap = awayWinPct - homeWinPct
            val leaderIsAway = gap > 0
            val abbr = if (leaderIsAway) game.awayAbbr else game.homeAbbr
            val leader = if (leaderIsAway) awayShown else homeShown
            val record = leader?.f5Record ?: "-"
            var strength: Int
            val text: String
            val absGap = abs(gap)
            when {
                absGap >= InsightThresholds.f5Own -> {
                    text = "$abbr owns the F5 ($record)"; strength = 3
                }
                absGap >= InsightThresholds.f5Edge -> {
                    text = "$abbr has the F5 edge ($record)"; strength = 2
                }
                absGap >= InsightThresholds.f5Slight -> {
                    text = "Slight F5 lean $abbr"; strength = 1
                }
                else -> {
                    text = "Even F5 matchup"; strength = 0
                }
            }
            // Thin leader sample (under 10 games) downgrades confidence a dot.
            if (strength > 0 && (leader?.games ?: 0) < MLBF5.Sample.SMALL) {
                strength = max(1, strength - 1)
            }
            sideVerdict = InsightVerdict(
                text = text,
                lean = if (strength > 0) {
                    InsightVerdict.Lean.Team(abbr, if (leaderIsAway) MatchupSide.AWAY else MatchupSide.HOME)
                } else {
                    InsightVerdict.Lean.None
                },
                strength = strength,
            )
            verdicts += sideVerdict
        }

        // O/U verdict — two conditions (over% consensus + season delta): both met
        // → s2/s3, exactly one met → s1, neither → omitted (spec §1c).
        val overPcts = listOfNotNull(awayShown?.f5OverPct, homeShown?.f5OverPct)
        val degraded = !(awayOk && homeOk)
        if (overPcts.isNotEmpty()) {
            val avgOver = overPcts.sum() / overPcts.size
            val deltaSum = (awayShown?.totalDiffVsSeason ?: 0.0) + (homeShown?.totalDiffVsSeason ?: 0.0)
            var ouVerdict: InsightVerdict? = null
            if (avgOver >= InsightThresholds.ouHigh) {
                var s = if (deltaSum > 0) (if (avgOver >= 60) 3 else 2) else 1
                if (degraded) s = min(s, 1) // single-sided sample caps confidence
                ouVerdict = InsightVerdict("F5 OVER lean", InsightVerdict.Lean.Over, s)
            } else if (avgOver <= InsightThresholds.ouLow) {
                var s = if (deltaSum < 0) (if (avgOver <= 40) 3 else 2) else 1
                if (degraded) s = min(s, 1)
                ouVerdict = InsightVerdict("F5 UNDER lean", InsightVerdict.Lean.Under, s)
            } else if (deltaSum > 0) {
                // Delta-only lean: season deltas point over without over% consensus.
                ouVerdict = InsightVerdict("F5 OVER lean", InsightVerdict.Lean.Over, 1)
            } else if (deltaSum < 0) {
                ouVerdict = InsightVerdict("F5 UNDER lean", InsightVerdict.Lean.Under, 1)
            }
            ouVerdict?.let { verdicts += it }
        }

        if (verdicts.isEmpty()) {
            verdicts += InsightVerdict("Even F5 matchup", InsightVerdict.Lean.None, 0)
        }

        // Badge — side edge wins, then O/U lean, else EVEN.
        val sideLean = sideVerdict?.lean as? InsightVerdict.Lean.Team
        val badge: InsightVerdictBadge = if (sideVerdict != null && sideVerdict.strength > 0 && sideLean != null) {
            InsightVerdictBadge("${sideLean.abbr} EDGE", 0x22C55EL)
        } else {
            val ou = verdicts.firstOrNull { it.lean == InsightVerdict.Lean.Over || it.lean == InsightVerdict.Lean.Under }
            when {
                ou == null -> InsightVerdictBadge("EVEN", 0x9CA3AFL)
                ou.lean == InsightVerdict.Lean.Over -> InsightVerdictBadge("F5 OVER LEAN", 0x22C55EL)
                else -> InsightVerdictBadge("F5 UNDER LEAN", 0x3B82F6L)
            }
        }

        val qualifier = "${game.awayAbbr} away vs ${MLBF5.pitchHandLabel(game.homeSpHand)} · " +
            "${game.homeAbbr} home vs ${MLBF5.pitchHandLabel(game.awaySpHand)}"

        val rows = compareRows(game = game, away = awayShown, home = homeShown)
        val warning = sampleWarning(game = game, away = away, home = home, awayOk = awayOk, homeOk = homeOk)

        return F5InsightSummary(
            verdicts = verdicts,
            badge = badge,
            qualifier = qualifier,
            rows = rows,
            sampleWarning = warning,
        )
    }

    fun teaser(matchup: MLBF5Matchup, matchedAbbr: String?): InsightTeaser? {
        val candidates = mutableListOf<F5TeaserCandidate>()

        fun collect(split: MLBF5SplitRow?, abbr: String, ownHand: MLBF5PitchHand?, oppHand: MLBF5PitchHand?) {
            if (split == null || !MLBF5.isShowable(split.games)) return
            val hand = MLBF5.pitchHandLabel(oppHand)
            split.rsDiffVsSeason?.let { rs ->
                candidates += F5TeaserCandidate(abbr, rs, "F5 runs vs $hand", rs > 0, split.games)
            }
            split.totalDiffVsSeason?.let { total ->
                candidates += F5TeaserCandidate(abbr, total, "F5 total vs $hand", total > 0, split.games)
            }
            val ownRa = if (ownHand == MLBF5PitchHand.LEFT) split.raDiffVsSeasonWhenOwnLhp else split.raDiffVsSeasonWhenOwnRhp
            val ownGames = if (ownHand == MLBF5PitchHand.LEFT) split.gamesWithOwnLhp else split.gamesWithOwnRhp
            if (ownRa != null && ownGames > 0) {
                candidates += F5TeaserCandidate(abbr, ownRa, "F5 runs allowed", ownRa < 0, ownGames)
            }
        }

        val game = matchup.game
        if (matchedAbbr == null || matchedAbbr.equals(game.awayAbbr, ignoreCase = true)) {
            collect(matchup.awaySplit, game.awayAbbr, game.awaySpHand, game.homeSpHand)
        }
        if (matchedAbbr == null || matchedAbbr.equals(game.homeAbbr, ignoreCase = true)) {
            collect(matchup.homeSplit, game.homeAbbr, game.homeSpHand, game.awaySpHand)
        }

        val best = candidates.maxByOrNull { abs(it.delta) }
        if (best == null || abs(best.delta) < InsightThresholds.f5DeltaMin) {
            return InsightTeaser(InsightTeaser.Kind.F5, null, InsightTeaser.Signal.NEUTRAL, smallSample = false)
        }
        val headline = "${best.abbr} ${MLBF5.formatDiff(best.delta, digits = 1)} ${best.phrase}"
        return InsightTeaser(
            kind = InsightTeaser.Kind.F5,
            headline = headline,
            signal = if (best.positive) InsightTeaser.Signal.POSITIVE else InsightTeaser.Signal.NEGATIVE,
            smallSample = best.games < MLBF5.Sample.SMALL,
        )
    }

    // Rows -----------------------------------------------------------------

    private fun compareRows(game: MLBF5Game, away: MLBF5SplitRow?, home: MLBF5SplitRow?): List<F5CompareRow> {
        // 1. F5 WIN %
        val awayWin = away?.f5WinPct
        val homeWin = home?.f5WinPct
        val winAdvantage: MatchupSide? = when {
            awayWin == null || homeWin == null || awayWin == homeWin -> null
            awayWin > homeWin -> MatchupSide.AWAY
            else -> MatchupSide.HOME
        }
        val winRow = F5CompareRow(
            metric = F5CompareRow.Metric.WIN_PCT, title = "F5 WIN %",
            awayValue = away?.f5WinPct, homeValue = home?.f5WinPct,
            awayNumeral = if (away != null) MLBF5.recordWithPct(away) else "—",
            homeNumeral = if (home != null) MLBF5.recordWithPct(home) else "—",
            awayDelta = null, homeDelta = null,
            goodWhenNegative = false, advantage = winAdvantage,
        )

        // 2. RUNS SCORED — normalized so the longer half maxes at ~83% of track.
        val awayRs = away?.avgF5Rs
        val homeRs = home?.avgF5Rs
        val rsMax = max(awayRs ?: 0.0, homeRs ?: 0.0)
        val rsScale = if (rsMax > 0) rsMax * 1.2 else 1.0
        val rsAdvantage: MatchupSide? = when {
            awayRs == null || homeRs == null || awayRs == homeRs -> null
            awayRs > homeRs -> MatchupSide.AWAY
            else -> MatchupSide.HOME
        }
        val rsRow = F5CompareRow(
            metric = F5CompareRow.Metric.RUNS_SCORED, title = "RUNS SCORED",
            awayValue = awayRs?.let { it / rsScale },
            homeValue = homeRs?.let { it / rsScale },
            awayNumeral = if (awayRs != null) MLBF5.formatNumber(awayRs, digits = 1) else "—",
            homeNumeral = if (homeRs != null) MLBF5.formatNumber(homeRs, digits = 1) else "—",
            awayDelta = away?.rsDiffVsSeason, homeDelta = home?.rsDiffVsSeason,
            goodWhenNegative = false, advantage = rsAdvantage,
        )

        // 3. RUNS ALLOWED — own starter hand split; lower is better.
        fun ownRa(split: MLBF5SplitRow?, hand: MLBF5PitchHand?): OwnRaSplit {
            if (split == null || hand == null) return OwnRaSplit(null, null, 0)
            val games = if (hand == MLBF5PitchHand.LEFT) split.gamesWithOwnLhp else split.gamesWithOwnRhp
            if (games <= 0) return OwnRaSplit(null, null, 0)
            val value = if (hand == MLBF5PitchHand.LEFT) split.avgF5RaWhenOwnLhp else split.avgF5RaWhenOwnRhp
            val delta = if (hand == MLBF5PitchHand.LEFT) split.raDiffVsSeasonWhenOwnLhp else split.raDiffVsSeasonWhenOwnRhp
            return OwnRaSplit(value, delta, games)
        }

        val awayRa = ownRa(away, game.awaySpHand)
        val homeRa = ownRa(home, game.homeSpHand)
        val awayRaValue = awayRa.value
        val homeRaValue = homeRa.value
        val raMax = max(awayRaValue ?: 0.0, homeRaValue ?: 0.0)
        val raScale = if (raMax > 0) raMax * 1.2 else 1.0
        val raAdvantage: MatchupSide? = when {
            awayRaValue == null || homeRaValue == null || awayRaValue == homeRaValue -> null
            awayRaValue < homeRaValue -> MatchupSide.AWAY
            else -> MatchupSide.HOME
        }
        val raRow = F5CompareRow(
            metric = F5CompareRow.Metric.RUNS_ALLOWED, title = "RUNS ALLOWED",
            awayValue = awayRa.value?.let { it / raScale },
            homeValue = homeRa.value?.let { it / raScale },
            awayNumeral = if (awayRa.value != null) MLBF5.formatNumber(awayRa.value, digits = 1) else "—",
            homeNumeral = if (homeRa.value != null) MLBF5.formatNumber(homeRa.value, digits = 1) else "—",
            awayDelta = awayRa.delta, homeDelta = homeRa.delta,
            goodWhenNegative = true, advantage = raAdvantage,
        )

        return listOf(winRow, rsRow, raRow)
    }

    private fun sampleWarning(
        game: MLBF5Game,
        away: MLBF5SplitRow?,
        home: MLBF5SplitRow?,
        awayOk: Boolean,
        homeOk: Boolean,
    ): String? {
        val parts = mutableListOf<String>()
        if (!awayOk) {
            parts += "Not enough ${game.awayAbbr} games in this split (${away?.games ?: 0})"
        } else if (away != null && away.games < MLBF5.Sample.SMALL) {
            parts += "${game.awayAbbr}: only ${away.games} away games vs ${MLBF5.pitchHandLabel(game.homeSpHand)}"
        }
        if (!homeOk) {
            parts += "Not enough ${game.homeAbbr} games in this split (${home?.games ?: 0})"
        } else if (home != null && home.games < MLBF5.Sample.SMALL) {
            parts += "${game.homeAbbr}: only ${home.games} home games vs ${MLBF5.pitchHandLabel(game.awaySpHand)}"
        }
        return if (parts.isEmpty()) null else parts.joinToString(" · ")
    }
}
